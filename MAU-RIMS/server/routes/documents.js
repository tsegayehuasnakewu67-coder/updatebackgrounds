import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { authenticate } from "../middleware/auth.js";
import { Document, Project } from "../models/index.js";

const router = Router();
const uploadDirectory = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });
const allowedTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = allowedTypes.has(file.mimetype) && allowedExtensions.has(path.extname(file.originalname).toLowerCase());
    callback(accepted ? null : Object.assign(new Error("Only PDF, DOC, and DOCX files are allowed"), { status: 400 }), accepted);
  }
});

async function validateFileSignature(file) {
  const handle = await fs.promises.open(file.path, "r");
  try {
    const signature = Buffer.alloc(8);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    const header = signature.subarray(0, bytesRead);
    if (file.mimetype === "application/pdf") return header.subarray(0, 5).toString() === "%PDF-";
    if (file.mimetype === "application/msword") return header.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    }
    return false;
  } finally { await handle.close(); }
}

router.post("/", authenticate, upload.single("file"), async (req, res, next) => {
  let created;
  let previousVersion;
  try {
    if (!req.file) return res.status(400).json({ message: "A document file is required" });
    if (!await validateFileSignature(req.file)) {
      await fs.promises.unlink(req.file.path);
      return res.status(400).json({ message: "The uploaded file content does not match its document type" });
    }
    if (req.body.relatedType === "Project" && req.body.relatedId) {
      const project = await Project.findById(req.body.relatedId).select("principalInvestigator members");
      const allowed = project && (String(project.principalInvestigator) === String(req.user._id)
        || project.members.some((member) => String(member) === String(req.user._id))
        || ["super_admin", "directorate_admin", "research_coordinator"].includes(req.user.role));
      if (!allowed) {
        await fs.promises.unlink(req.file.path);
        return res.status(403).json({ message: "You cannot attach a document to this project" });
      }
    }
    let access = "private";
    if (req.body.access === "university" && ["super_admin", "directorate_admin"].includes(req.user.role)) access = "university";
    if (req.body.access === "project" && req.body.relatedType === "Project" && req.body.relatedId) access = "project";
    let version = 1;
    if (req.body.previousVersionId) {
      previousVersion = await Document.findOne({ _id: req.body.previousVersionId, owner: req.user._id, isLatest: true });
      if (!previousVersion) {
        await fs.promises.unlink(req.file.path);
        return res.status(404).json({ message: "Latest document version not found" });
      }
      if (previousVersion.relatedId?.toString() !== (req.body.relatedId || "")
        || previousVersion.category !== (req.body.category || "")) {
        await fs.promises.unlink(req.file.path);
        return res.status(400).json({ message: "A new version must keep the original document category and project" });
      }
      version = previousVersion.version + 1;
    }
    created = await Document.create({
      originalName: path.basename(req.file.originalname),
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category: req.body.category,
      relatedType: req.body.relatedType,
      relatedId: req.body.relatedId,
      previousVersion: previousVersion?._id,
      versionGroup: previousVersion?.versionGroup || randomUUID(),
      version,
      access,
      owner: req.user._id,
      createdBy: req.user._id
    });
    if (previousVersion) {
      await Document.updateOne({ _id: previousVersion._id }, { $set: { isLatest: false } });
      await Document.updateMany({ versionGroup: previousVersion.versionGroup, _id: { $ne: created._id } }, { $set: { isLatest: false } });
    }
    res.status(201).json({ item: created });
  } catch (error) {
    if (created) {
      await Document.deleteOne({ _id: created._id });
      if (previousVersion) await Document.updateOne({ _id: previousVersion._id }, { $set: { isLatest: true } });
    }
    if (req.file) await fs.promises.unlink(req.file.path).catch((unlinkError) => console.error("Could not remove rejected upload", unlinkError));
    next(error);
  }
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const privileged = ["super_admin", "directorate_admin", "research_coordinator"].includes(req.user.role);
    const projects = privileged ? [] : await Project.find({ $or: [{ principalInvestigator: req.user._id }, { members: req.user._id }] }).distinct("_id");
    const filter = privileged ? { isLatest: true } : {
      isLatest: true,
      $or: [{ owner: req.user._id }, { access: "university" }, { access: "project", relatedId: { $in: projects } }]
    };
    if (req.query.search) {
      const term = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const search = { $or: [{ originalName: { $regex: term, $options: "i" } }, { category: { $regex: term, $options: "i" } }] };
      filter.$and = filter.$or ? [search, { $or: filter.$or }] : [search];
      delete filter.$or;
    }
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const [items, total] = await Promise.all([
      Document.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Document.countDocuments(filter)
    ]);
    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
});

router.get("/:id/versions", authenticate, async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (!await canReadDocument(req.user, document)) return res.status(403).json({ message: "You cannot access this document" });
    const items = await Document.find({ versionGroup: document.versionGroup }).sort({ version: -1 }).lean();
    res.json({ items });
  } catch (error) { next(error); }
});

async function canReadDocument(user, item) {
  const isOwner = String(item.owner) === String(user._id);
  const isAdmin = ["super_admin", "directorate_admin", "research_coordinator"].includes(user.role);
  if (isOwner || isAdmin || item.access === "university") return true;
  if (item.access === "project" && item.relatedType === "Project" && item.relatedId) {
    const project = await Project.findById(item.relatedId).select("principalInvestigator members");
    return Boolean(project && (String(project.principalInvestigator) === String(user._id)
      || project.members.some((member) => String(member) === String(user._id))));
  }
  return false;
}

router.get("/:id/download", authenticate, async (req, res, next) => {
  try {
    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Document not found" });
    if (!await canReadDocument(req.user, item)) return res.status(403).json({ message: "You cannot access this document" });
    res.download(path.join(uploadDirectory, item.storedName), item.originalName, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) { next(error); }
});

router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const item = await Document.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Document not found" });
    if (String(item.owner) !== String(req.user._id) && !["super_admin", "directorate_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "You cannot delete this document" });
    }
    await Document.deleteOne({ _id: item._id });
    await fs.promises.unlink(path.join(uploadDirectory, item.storedName)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    res.json({ message: "Document deleted" });
  } catch (error) { next(error); }
});

export default router;
