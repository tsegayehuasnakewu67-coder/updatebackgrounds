import { Router } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { body, validationResult } from "express-validator";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { RESOURCES, ROLES, User, Researcher, Proposal, Review, Project, ProjectMember, Publication, AuditLog, Notification, Activity, SystemSetting } from "../models/index.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);
const privileged = ["super_admin", "directorate_admin", "research_coordinator"];
const defaultProposalStageRoles = {
  submitted: ["department_coordinator"],
  department_screening: ["college_coordinator"],
  college_review: ["research_coordinator"],
  directorate_review: ["directorate_admin"]
};
const configurableProposalRoles = ["department_coordinator", "college_coordinator", "research_coordinator", "directorate_admin", "super_admin"];
async function getProposalStageRoles() {
  const setting = await SystemSetting.findOne({ key: "proposalStageRoles" }).lean();
  const stageRoles = { ...defaultProposalStageRoles, ...(setting?.value || {}) };
  if (Object.entries(defaultProposalStageRoles).some(([stage]) => !Array.isArray(stageRoles[stage])
    || stageRoles[stage].length === 0
    || stageRoles[stage].some((role) => !configurableProposalRoles.includes(role)))) {
    throw new Error("Stored proposal workflow configuration is invalid");
  }
  return stageRoles;
}
const validateBody = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });
  next();
};
const isPrivileged = (user) => privileged.includes(user.role);
const canAccess = (req, resource, document) => {
  if (isPrivileged(req.user)) return true;
  if (resource.reviewerWideRead && ["college_coordinator", "department_coordinator"].includes(req.user.role)) return true;
  if (resource.ethicsReviewerWideRead && req.user.role === "ethics_reviewer") return true;
  if (resource.memberField && (String(document[resource.ownerField]?._id || document[resource.ownerField]) === String(req.user._id)
    || document[resource.memberField]?.some((member) => String(member?._id || member) === String(req.user._id)))) return true;
  if (!resource.ownerField) return true;
  const value = document[resource.ownerField];
  return String(value?._id || value) === String(req.user._id);
};
const parsePage = (value, fallback, max) => Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

router.get("/users", authorize("super_admin", "directorate_admin"), async (req, res, next) => {
  try {
    const page = parsePage(req.query.page, 1, 100000);
    const limit = parsePage(req.query.limit, 20, 100);
    const filter = { isActive: req.query.includeInactive === "true" ? { $in: [true, false] } : true };
    if (req.query.search) {
      const term = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = ["name", "email", "department", "role"].map((key) => ({ [key]: { $regex: term, $options: "i" } }));
    }
    if (req.query.role) {
      if (!ROLES.includes(req.query.role)) return res.status(400).json({ message: "Invalid user role filter" });
      filter.role = req.query.role;
    }
    const [items, total] = await Promise.all([
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter)
    ]);
    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
});

router.get("/users/:id", authorize("super_admin", "directorate_admin"), async (req, res, next) => {
  try {
    const item = await User.findById(req.params.id).select("-password");
    if (!item) return res.status(404).json({ message: "User not found" });
    res.json({ item });
  } catch (error) { next(error); }
});

router.post("/users", authorize("super_admin", "directorate_admin"), [
  body("name").trim().isLength({ min: 2, max: 120 }),
  body("email").trim().isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }),
  body("role").isIn(["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "principal_investigator", "co_researcher", "ethics_reviewer", "finance_officer", "management"]),
  validateBody
], async (req, res, next) => {
  try {
    const { name, email, password, role, department, phone } = req.body;
    if (req.user.role !== "super_admin" && ["super_admin", "directorate_admin"].includes(role)) {
      return res.status(403).json({ message: "Only a super administrator can create administrator accounts" });
    }
    const user = await User.create({ name, email, password, role, department, phone });
    await log(req, "user.created", "User", user._id);
    res.status(201).json({ item: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, isActive: user.isActive } });
  } catch (error) { next(error); }
});

const updateUser = async (req, res, next) => {
  try {
    const allowed = ["name", "role", "department", "phone", "isActive"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (updates.role && !["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "principal_investigator", "co_researcher", "ethics_reviewer", "finance_officer", "management"].includes(updates.role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (String(req.user._id) === req.params.id && updates.role && updates.role !== req.user.role) {
      return res.status(403).json({ message: "You cannot change your own role" });
    }
    if (req.user.role !== "super_admin" && ["super_admin", "directorate_admin"].includes(updates.role)) {
      return res.status(403).json({ message: "Only a super administrator can assign administrator roles" });
    }
    if (req.user.role !== "super_admin") {
      const target = await User.findById(req.params.id).select("role");
      if (target?.role === "super_admin") return res.status(403).json({ message: "Only a super administrator can manage this account" });
    }
    const item = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "User not found" });
    await log(req, "user.updated", "User", item._id);
    res.json({ item: { id: item._id, name: item.name, email: item.email, role: item.role, department: item.department, phone: item.phone, isActive: item.isActive } });
  } catch (error) { next(error); }
};
router.patch("/users/:id", authorize("super_admin", "directorate_admin"), updateUser);
router.put("/users/:id", authorize("super_admin", "directorate_admin"), updateUser);

router.delete("/users/:id", authorize("super_admin"), async (req, res, next) => {
  try {
    if (String(req.user._id) === req.params.id) return res.status(400).json({ message: "You cannot deactivate your own account" });
    const item = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!item) return res.status(404).json({ message: "User not found" });
    await log(req, "user.deactivated", "User", item._id);
    res.json({ message: "User deactivated" });
  } catch (error) { next(error); }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const scoped = (Model, extra = {}) => {
      const filter = { ...extra };
      if (!isPrivileged(req.user)) {
        if (Model === Proposal || Model === Review || Model === Notification) filter[Model === Review ? "reviewer" : Model === Notification ? "recipient" : "owner"] = req.user._id;
        if (Model === Project) filter.$or = [{ principalInvestigator: req.user._id }, { members: req.user._id }];
      }
      return Model.countDocuments(filter);
    };
    const [users, researchers, proposals, pendingProposals, projects, publications, notifications, activities] = await Promise.all([
      isPrivileged(req.user) ? User.countDocuments({ isActive: true }) : Promise.resolve(0),
      scoped(Researcher),
      scoped(Proposal),
      scoped(Proposal, { status: { $in: ["submitted", "department_screening", "college_review", "directorate_review", "revision_required"] } }),
      scoped(Project),
      scoped(Publication),
      scoped(Notification, { readAt: null }),
      Activity.find(isPrivileged(req.user) ? {} : { createdBy: req.user._id }).sort({ createdAt: -1 }).limit(8).populate("createdBy", "name").lean()
    ]);
    const statusRows = await Proposal.aggregate([{ $match: isPrivileged(req.user) || ["college_coordinator", "department_coordinator"].includes(req.user.role) ? {} : { owner: req.user._id } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
    res.json({ totals: { users, researchers, proposals, pendingProposals, projects, publications, unreadNotifications: notifications }, proposalStatuses: statusRows, recentActivity: activities });
  } catch (error) { next(error); }
});

router.get("/notifications", async (req, res, next) => {
  try {
    const items = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ items, total: items.length });
  } catch (error) { next(error); }
});
router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const item = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { readAt: new Date() }, { new: true });
    if (!item) return res.status(404).json({ message: "Notification not found" });
    res.json({ item });
  } catch (error) { next(error); }
});

const reportRoles = ["super_admin", "directorate_admin", "research_coordinator", "management", "finance_officer"];
const generateReportData = async () => {
  const [proposalStatuses, projectsByStatus, publicationYears, budgets, ethicsStatuses, expenditureStatuses, counts] = await Promise.all([
    RESOURCES.proposals.model.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    RESOURCES.projects.model.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    RESOURCES.publications.model.aggregate([{ $group: { _id: "$year", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    RESOURCES.budgets.model.aggregate([{ $group: { _id: null, allocated: { $sum: "$amount" } } }]),
    RESOURCES.ethicsApplications.model.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    RESOURCES.expenditures.model.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }]),
    Promise.all([
      RESOURCES.researchers.model.countDocuments(),
      RESOURCES.projects.model.countDocuments({ status: "active" }),
      RESOURCES.projects.model.countDocuments({ status: "completed" }),
      RESOURCES.publications.model.countDocuments()
    ])
  ]);
  return {
    proposalStatuses,
    projectsByStatus,
    publicationYears,
    budgetAllocated: budgets[0]?.allocated || 0,
    ethicsStatuses,
    expenditureStatuses,
    researcherCount: counts[0],
    activeProjects: counts[1],
    completedProjects: counts[2],
    publicationCount: counts[3]
  };
};

router.get("/reports/summary", authorize(...reportRoles), async (req, res, next) => {
  try {
    res.json(await generateReportData());
  } catch (error) { next(error); }
});

router.get("/reports/export/:format", authorize(...reportRoles), async (req, res, next) => {
  try {
    const report = await generateReportData();
    const sheets = [
      ["Overview", [
        ["Measure", "Value"],
        ["Researchers", report.researcherCount],
        ["Active projects", report.activeProjects],
        ["Completed projects", report.completedProjects],
        ["Publications", report.publicationCount],
        ["Total budget allocation", report.budgetAllocated]
      ]],
      ["Proposal status", [["Status", "Count"], ...report.proposalStatuses.map((row) => [row._id, row.count])]],
      ["Project status", [["Status", "Count"], ...report.projectsByStatus.map((row) => [row._id, row.count])]],
      ["Ethics status", [["Status", "Count"], ...report.ethicsStatuses.map((row) => [row._id, row.count])]],
      ["Publications by year", [["Year", "Count"], ...report.publicationYears.map((row) => [row._id || "Not specified", row.count])]],
      ["Expenditure", [["Status", "Count", "Total amount"], ...report.expenditureStatuses.map((row) => [row._id, row.count, row.amount])]]
    ];
    if (req.params.format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "MAU-RIMS";
      workbook.created = new Date();
      for (const [name, rows] of sheets) {
        const worksheet = workbook.addWorksheet(name);
        worksheet.addRows(rows);
        worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10233F" } };
        worksheet.columns = rows[0].map((_, index) => ({
          width: Math.min(42, Math.max(16, ...rows.map((row) => String(row[index] ?? "").length + 2)))
        }));
      }
      const buffer = await workbook.xlsx.writeBuffer();
      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="mau-rims-research-report.xlsx"'
      });
      return res.send(Buffer.from(buffer));
    }
    if (req.params.format === "pdf") {
      const pdf = new PDFDocument({ margin: 48, size: "A4" });
      const chunks = [];
      const buffer = await new Promise((resolve, reject) => {
        pdf.on("data", (chunk) => chunks.push(chunk));
        pdf.on("end", () => resolve(Buffer.concat(chunks)));
        pdf.on("error", reject);
        pdf.fontSize(20).fillColor("#10233f").text("MAU-RIMS Research Report");
        pdf.moveDown(0.35).fontSize(9).fillColor("#667085").text(`Generated ${new Date().toLocaleString()}`);
        for (const [name, rows] of sheets) {
          pdf.moveDown().fontSize(13).fillColor("#147d54").text(name);
          pdf.moveDown(0.3).fontSize(9).fillColor("#344054");
          for (const row of rows.slice(0, 101)) pdf.text(row.map((cell) => String(cell ?? "—")).join("  |  "));
        }
        pdf.end();
      });
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="mau-rims-research-report.pdf"'
      });
      return res.send(buffer);
    }
    res.status(400).json({ message: "Export format must be pdf or xlsx" });
  } catch (error) { next(error); }
});

router.get("/workflow/proposals", async (req, res, next) => {
  try { res.json({ stageRoles: await getProposalStageRoles() }); }
  catch (error) { next(error); }
});

router.put("/workflow/proposals", authorize("super_admin"), [
  body("stageRoles").isObject(),
  validateBody
], async (req, res, next) => {
  try {
    const stages = Object.keys(defaultProposalStageRoles);
    if (stages.some((stage) => !Array.isArray(req.body.stageRoles[stage])
      || req.body.stageRoles[stage].length === 0
      || req.body.stageRoles[stage].some((role) => !configurableProposalRoles.includes(role)))) {
      return res.status(400).json({ message: "Each proposal stage needs at least one valid coordinator role" });
    }
    const stageRoles = Object.fromEntries(stages.map((stage) => [stage, [...new Set(req.body.stageRoles[stage])]]));
    await SystemSetting.findOneAndUpdate(
      { key: "proposalStageRoles" },
      { $set: { value: stageRoles, createdBy: req.user._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await log(req, "workflow.proposal_stages_updated", "SystemSetting", undefined);
    res.json({ stageRoles });
  } catch (error) { next(error); }
});

router.get("/researchers/directory", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.search) {
      const term = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ department: { $regex: term, $options: "i" } }, { campus: { $regex: term, $options: "i" } }, { researchInterests: { $regex: term, $options: "i" } }];
    }
    const profiles = await Researcher.find(filter).populate("user", "name role department isActive").sort({ createdAt: -1 }).limit(100).lean();
    const items = profiles.filter((profile) => profile.user?.isActive).map((profile) => ({
      userId: profile.user._id,
      name: profile.user.name,
      role: profile.user.role,
      department: profile.department || profile.user.department || "",
      campus: profile.campus || "",
      researchInterests: profile.researchInterests || []
    }));
    res.json({ items, total: items.length });
  } catch (error) { next(error); }
});

router.get("/projects/:id/members", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).select("principalInvestigator members");
    if (!project) return res.status(404).json({ message: "Project not found" });
    const canManage = isPrivileged(req.user) || ["super_admin", "directorate_admin"].includes(req.user.role);
    const isMember = String(project.principalInvestigator) === String(req.user._id)
      || project.members.some((id) => String(id) === String(req.user._id));
    if (!canManage && !isMember) return res.status(403).json({ message: "You cannot access this project team" });
    const items = await ProjectMember.find({ project: project._id }).populate("user", "name role department").sort({ createdAt: 1 }).lean();
    res.json({ items });
  } catch (error) { next(error); }
});

router.post("/projects/:id/members", authorize("super_admin", "directorate_admin", "research_coordinator", "principal_investigator"), [
  body("userId").isMongoId(),
  body("role").optional().isIn(["co_researcher", "collaborator"]),
  validateBody
], async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!isPrivileged(req.user) && String(project.principalInvestigator) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the project PI or an administrator can manage this team" });
    }
    if (String(project.principalInvestigator) === req.body.userId) return res.status(400).json({ message: "The project PI is already a team member" });
    const user = await User.findOne({ _id: req.body.userId, isActive: true });
    if (!user || !["principal_investigator", "co_researcher"].includes(user.role)) {
      return res.status(400).json({ message: "Select an active researcher account" });
    }
    const member = await ProjectMember.create({
      project: project._id,
      user: user._id,
      role: req.body.role || "co_researcher",
      addedBy: req.user._id,
      owner: project.principalInvestigator,
      createdBy: req.user._id
    });
    project.members.addToSet(user._id);
    await project.save();
    await Notification.create({ recipient: user._id, message: `You were added to research project "${project.title}".`, link: `/projects/${project._id}` });
    await log(req, "project.member_added", "Project", project._id);
    res.status(201).json({ item: await member.populate("user", "name role department") });
  } catch (error) { next(error); }
});

router.delete("/projects/:id/members/:userId", authorize("super_admin", "directorate_admin", "research_coordinator", "principal_investigator"), async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!isPrivileged(req.user) && String(project.principalInvestigator) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the project PI or an administrator can manage this team" });
    }
    const member = await ProjectMember.findOneAndDelete({ project: project._id, user: req.params.userId });
    if (!member) return res.status(404).json({ message: "Project member not found" });
    project.members.pull(req.params.userId);
    await project.save();
    await log(req, "project.member_removed", "Project", project._id);
    res.json({ message: "Project member removed" });
  } catch (error) { next(error); }
});

router.post("/proposals/:id/submit", authorize("principal_investigator", "super_admin", "directorate_admin"), async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, status: { $in: ["draft", "revision_required"] } };
    if (!isPrivileged(req.user)) filter.owner = req.user._id;
    const proposal = await Proposal.findOne(filter);
    if (!proposal) return res.status(404).json({ message: "Editable proposal not found" });
    proposal.status = "submitted";
    proposal.proposalNumber ||= `MAU-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    proposal.history.push({ actor: req.user._id, action: "submitted" });
    await proposal.save();
    const reviewers = await User.find({ role: "department_coordinator", isActive: true }).select("_id");
    if (reviewers.length) {
      await Notification.insertMany(reviewers.map(({ _id }) => ({
        recipient: _id,
        message: `Proposal "${proposal.title}" is awaiting department screening.`,
        link: `/proposals/${proposal._id}`
      })));
    }
    await log(req, "proposal.submitted", "Proposal", proposal._id);
    res.json({ item: proposal });
  } catch (error) { next(error); }
});

router.post("/proposals/:id/assign", authorize("super_admin", "directorate_admin", "research_coordinator"), [
  body("reviewerIds").isArray({ min: 1, max: 20 }),
  body("reviewerIds.*").isMongoId(),
  body("stage").isIn(["submitted", "department_screening", "college_review", "directorate_review"]),
  validateBody
], async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    const expectedRoles = (await getProposalStageRoles())[req.body.stage] || [];
    const reviewers = await User.find({
      _id: { $in: [...new Set(req.body.reviewerIds.map(String))] },
      role: { $in: expectedRoles },
      isActive: true
    }).select("_id name");
    if (reviewers.length !== new Set(req.body.reviewerIds.map(String)).size) {
      return res.status(400).json({ message: "Select active coordinator accounts configured for this stage" });
    }
    proposal.assignments = proposal.assignments.filter((entry) => entry.stage !== req.body.stage);
    proposal.assignments.push(...reviewers.map((reviewer) => ({
      reviewer: reviewer._id,
      stage: req.body.stage,
      assignedBy: req.user._id,
      assignedAt: new Date()
    })));
    await proposal.save();
    await Notification.insertMany(reviewers.map((reviewer) => ({
      recipient: reviewer._id,
      message: `You were assigned to review proposal "${proposal.title}" at ${req.body.stage.replaceAll("_", " ")}.`,
      link: `/proposals/${proposal._id}`
    })));
    await log(req, "proposal.reviewers_assigned", "Proposal", proposal._id);
    res.json({ item: proposal });
  } catch (error) { next(error); }
});

router.post("/ethicsApplications/:id/submit", authorize("principal_investigator", "super_admin", "directorate_admin"), async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, status: { $in: ["draft", "revision_required"] } };
    if (!isPrivileged(req.user)) filter.owner = req.user._id;
    const application = await RESOURCES.ethicsApplications.model.findOne(filter);
    if (!application) return res.status(404).json({ message: "Editable ethics application not found" });
    application.status = "submitted";
    await application.save();
    await log(req, "ethics.submitted", "EthicsApplication", application._id);
    res.json({ item: application });
  } catch (error) { next(error); }
});

router.post("/proposals/:id/review", authorize("super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator"), [
  body("decision").isIn(["approve", "reject", "revision"]),
  body("comments").optional().trim().isLength({ max: 10000 }),
  body("stage").optional().trim().isLength({ max: 80 }),
  validateBody
], async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid proposal identifier" });
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    const configuredRoles = await getProposalStageRoles();
    const requiredReviewer = [...new Set([...(configuredRoles[proposal.status] || []), "super_admin", "directorate_admin"])];
    if (!requiredReviewer.includes(req.user.role)) {
      return res.status(403).json({ message: "Your role cannot review this proposal at its current stage" });
    }
    const stageAssignment = proposal.assignments.filter((assignment) => assignment.stage === proposal.status);
    if (stageAssignment.length && !stageAssignment.some((assignment) => String(assignment.reviewer) === String(req.user._id))
      && !["super_admin", "directorate_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "This proposal is assigned to another reviewer" });
    }
    const nextApprovalStage = {
      submitted: "department_screening",
      department_screening: "college_review",
      college_review: "directorate_review",
      directorate_review: "approved"
    };
    proposal.status = req.body.decision === "approve"
      ? nextApprovalStage[proposal.status]
      : req.body.decision === "reject" ? "rejected" : "revision_required";
    proposal.history.push({ actor: req.user._id, action: req.body.decision, comment: req.body.comments || "" });
    await proposal.save();
    await Review.create({ proposal: proposal._id, reviewer: req.user._id, stage: req.body.stage || req.user.role, decision: req.body.decision, comments: req.body.comments || "No comment provided" });
    await Notification.create({ recipient: proposal.owner, message: `Proposal "${proposal.title}" was ${req.body.decision === "revision" ? "returned for revision" : `${req.body.decision}d`}.`, link: `/proposals/${proposal._id}` });
    await log(req, `proposal.${req.body.decision}`, "Proposal", proposal._id);
    res.json({ item: proposal });
  } catch (error) { next(error); }
});

router.post("/ethicsApplications/:id/review", authorize("super_admin", "directorate_admin", "ethics_reviewer"), [
  body("decision").isIn(["approve", "reject", "revision"]),
  body("comments").optional().trim().isLength({ max: 10000 }),
  validateBody
], async (req, res, next) => {
  try {
    const application = await RESOURCES.ethicsApplications.model.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Ethics application not found" });
    if (application.status !== "submitted" && application.status !== "under_review" && application.status !== "revision_required") {
      return res.status(409).json({ message: "This ethics application is not awaiting review" });
    }
    const nextStatus = { approve: "approved", reject: "rejected", revision: "revision_required" };
    application.status = nextStatus[req.body.decision];
    application.comments = req.body.comments || "";
    application.decision = req.body.decision;
    if (req.body.decision === "approve" && !application.certificateNumber) {
      application.certificateNumber = `MAU-ETH-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    }
    await application.save();
    await Notification.create({ recipient: application.owner, message: `Ethics application "${application.title}" was ${req.body.decision === "revision" ? "returned for revision" : `${req.body.decision}d`}.`, link: `/ethicsApplications/${application._id}` });
    await log(req, `ethics.${req.body.decision}`, "EthicsApplication", application._id);
    res.json({ item: application });
  } catch (error) { next(error); }
});

router.post("/progressReports/:id/review", authorize("super_admin", "directorate_admin", "research_coordinator"), [
  body("feedback").trim().isLength({ min: 1, max: 10000 }),
  body("decision").isIn(["reviewed", "revision_required"]),
  validateBody
], async (req, res, next) => {
  try {
    const report = await RESOURCES.progressReports.model.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Progress report not found" });
    report.status = req.body.decision;
    report.feedback = req.body.feedback;
    await report.save();
    if (req.body.decision === "reviewed") {
      const project = await Project.findById(report.project);
      if (project) {
        project.progress = report.progress;
        if (report.progress === 100) project.status = "completed";
        else if (project.status === "planned") project.status = "active";
        await project.save();
      }
    }
    await Notification.create({ recipient: report.owner, message: `Progress report "${report.title}" was ${req.body.decision.replaceAll("_", " ")}.`, link: `/progressReports/${report._id}` });
    await log(req, `progressReport.${req.body.decision}`, "ProgressReport", report._id);
    res.json({ item: report });
  } catch (error) { next(error); }
});

router.post("/expenditures/:id/review", authorize("super_admin", "directorate_admin"), [
  body("decision").isIn(["approved", "rejected"]),
  body("comment").optional().trim().isLength({ max: 10000 }),
  validateBody
], async (req, res, next) => {
  try {
    const expenditure = await RESOURCES.expenditures.model.findById(req.params.id);
    if (!expenditure) return res.status(404).json({ message: "Expenditure not found" });
    if (expenditure.status !== "pending") return res.status(409).json({ message: "This expenditure has already been reviewed" });
    expenditure.status = req.body.decision;
    expenditure.reviewedBy = req.user._id;
    expenditure.reviewedAt = new Date();
    expenditure.reviewComment = req.body.comment || "";
    await expenditure.save();
    const recipient = expenditure.owner || expenditure.createdBy;
    if (recipient) await Notification.create({ recipient, message: `Expenditure "${expenditure.title}" was ${req.body.decision}.`, link: `/expenditures/${expenditure._id}` });
    await log(req, `expenditure.${req.body.decision}`, "Expenditure", expenditure._id);
    res.json({ item: expenditure });
  } catch (error) { next(error); }
});

router.post("/:resource", async (req, res, next) => {
  const resource = RESOURCES[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Unknown resource" });
  if (!resource.write.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
  try {
    if (req.params.resource === "systemSettings" && req.body.key === "proposalStageRoles") {
      return res.status(400).json({ message: "Configure proposal reviewer roles through the workflow settings endpoint" });
    }
    const data = { ...req.body, createdBy: req.user._id };
    if (resource.ownerField && (!isPrivileged(req.user) || !data[resource.ownerField])) data[resource.ownerField] = req.user._id;
    if (req.params.resource === "researchers" && !isPrivileged(req.user)) data.user = req.user._id;
    if (req.params.resource === "projects") {
      if (!isPrivileged(req.user)) data.principalInvestigator = req.user._id;
      if (!data.proposal) return res.status(400).json({ message: "Create projects from an approved proposal" });
      const proposalFilter = { _id: data.proposal, status: "approved" };
      if (!isPrivileged(req.user)) proposalFilter.owner = req.user._id;
      if (!await Proposal.exists(proposalFilter)) return res.status(400).json({ message: "An approved proposal you can access is required" });
      data.status = "active";
    }
    if (["progressReports", "milestones", "budgets", "expenditures"].includes(req.params.resource)) {
      const projectId = data.project;
      if (!mongoose.isValidObjectId(projectId)) return res.status(400).json({ message: "A valid project ID is required" });
      const project = await Project.findById(projectId).select("principalInvestigator members");
      if (!project) return res.status(404).json({ message: "Project not found" });
      const isProjectMember = String(project.principalInvestigator) === String(req.user._id)
        || project.members.some((member) => String(member) === String(req.user._id));
      const financeAccess = ["budgets", "expenditures"].includes(req.params.resource) && req.user.role === "finance_officer";
      if (!isPrivileged(req.user) && !isProjectMember && !financeAccess) return res.status(403).json({ message: "You cannot add records to this project" });
    }
    if (req.params.resource === "proposals") {
      data.status = "draft";
      delete data.proposalNumber;
      delete data.history;
    }
    if (req.params.resource === "ethicsApplications") data.status = "draft";
    if (req.params.resource === "ethicsApplications") {
      delete data.decision;
      delete data.comments;
      delete data.certificateNumber;
    }
    if (req.params.resource === "progressReports") {
      data.status = "submitted";
      delete data.feedback;
    }
    if (req.params.resource === "expenditures") {
      data.status = "pending";
      delete data.reviewedBy;
      delete data.reviewedAt;
      delete data.reviewComment;
    }
    if (req.params.resource === "notifications" && !isPrivileged(req.user)) data.recipient = req.user._id;
    const item = await resource.model.create(data);
    await log(req, `${req.params.resource}.created`, req.params.resource, item._id);
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

router.get("/:resource", async (req, res, next) => {
  const resource = RESOURCES[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Unknown resource" });
  if (!resource.read.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
  try {
    const page = parsePage(req.query.page, 1, 100000);
    const limit = parsePage(req.query.limit, 20, 100);
    const filter = {};
    if (resource.memberField && !isPrivileged(req.user)) {
      filter.$or = [{ [resource.ownerField]: req.user._id }, { [resource.memberField]: req.user._id }];
    } else if (resource.ownerField && !isPrivileged(req.user)
      && !(resource.reviewerWideRead && ["college_coordinator", "department_coordinator"].includes(req.user.role))
      && !(resource.ethicsReviewerWideRead && req.user.role === "ethics_reviewer")) {
      filter[resource.ownerField] = req.user._id;
    }
    if (req.query.status) filter.status = String(req.query.status).slice(0, 80);
    if (req.query.search && resource.search.length) {
      const term = String(req.query.search).slice(0, 100);
      const searchConditions = resource.search.map((key) => ({ [key]: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }));
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }
    const sort = ["createdAt", "updatedAt", "title", "name", "year"].includes(req.query.sort) ? req.query.sort : "createdAt";
    const direction = req.query.order === "asc" ? 1 : -1;
    const [items, total] = await Promise.all([
      resource.model.find(filter).sort({ [sort]: direction }).skip((page - 1) * limit).limit(limit).lean(),
      resource.model.countDocuments(filter)
    ]);
    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
});

router.get("/:resource/:id", async (req, res, next) => {
  const resource = RESOURCES[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Unknown resource" });
  if (!resource.read.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
  try {
    const item = await resource.model.findById(req.params.id).lean();
    if (!item || !canAccess(req, resource, item)) return res.status(404).json({ message: "Record not found" });
    res.json({ item });
  } catch (error) { next(error); }
});

router.put("/:resource/:id", async (req, res, next) => {
  const resource = RESOURCES[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Unknown resource" });
  if (!resource.write.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
  try {
    const item = await resource.model.findById(req.params.id);
    if (!item || !canAccess(req, resource, item)) return res.status(404).json({ message: "Record not found" });
    if (req.params.resource === "systemSettings" && item.key === "proposalStageRoles") {
      return res.status(400).json({ message: "Configure proposal reviewer roles through the workflow settings endpoint" });
    }
    const protectedFields = new Set(["_id", "__v", "createdAt", "updatedAt", "createdBy", "owner", "history"]);
    if (req.params.resource === "proposals") protectedFields.add("assignments");
    if (resource.ownerField) protectedFields.add(resource.ownerField);
    if (req.params.resource === "projects") protectedFields.add("members");
    if (["proposals", "ethicsApplications", "progressReports", "expenditures"].includes(req.params.resource)) protectedFields.add("status");
    if (req.params.resource === "ethicsApplications") {
      protectedFields.add("decision");
      protectedFields.add("comments");
      protectedFields.add("certificateNumber");
    }
    if (req.params.resource === "progressReports") protectedFields.add("feedback");
    if (req.params.resource === "expenditures") {
      protectedFields.add("reviewedBy");
      protectedFields.add("reviewedAt");
      protectedFields.add("reviewComment");
    }
    if (req.params.resource === "projects") {
      protectedFields.add("proposal");
      protectedFields.add("status");
    }
    for (const [key, value] of Object.entries(req.body)) if (!protectedFields.has(key)) item.set(key, value);
    await item.save();
    await log(req, `${req.params.resource}.updated`, req.params.resource, item._id);
    res.json({ item });
  } catch (error) { next(error); }
});

router.delete("/:resource/:id", async (req, res, next) => {
  const resource = RESOURCES[req.params.resource];
  if (!resource) return res.status(404).json({ message: "Unknown resource" });
  const deletable = ["super_admin", "directorate_admin", "research_coordinator", "principal_investigator"];
  if (!deletable.includes(req.user.role) || !resource.write.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
  try {
    const item = await resource.model.findById(req.params.id);
    if (!item || !canAccess(req, resource, item)) return res.status(404).json({ message: "Record not found" });
    if (req.params.resource === "systemSettings" && item.key === "proposalStageRoles") {
      return res.status(400).json({ message: "Configure proposal reviewer roles through the workflow settings endpoint" });
    }
    await item.deleteOne();
    await log(req, `${req.params.resource}.deleted`, req.params.resource, item._id);
    res.json({ message: "Record deleted" });
  } catch (error) { next(error); }
});

async function log(req, action, targetType, targetId) {
  await Promise.all([
    AuditLog.create({ actor: req.user._id, action, targetType, targetId, ip: req.ip }),
    Activity.create({ createdBy: req.user._id, action, targetType, targetId })
  ]);
}

export default router;
