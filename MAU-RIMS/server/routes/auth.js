import { Router } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { PasswordReset, User } from "../models/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  maxAge: 24 * 60 * 60 * 1000
});
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  phone: user.phone
});
const issueToken = (user, res) => {
  const token = jwt.sign({ sub: user._id.toString(), ver: user.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
  res.cookie("token", token, cookieOptions());
  return token;
};
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: "Invalid input", errors: errors.array() });
  next();
};
const resetEmailConfigured = () => ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "CLIENT_URL"].every((key) => process.env[key]);
const hashResetToken = (token) => createHash("sha256").update(token).digest("hex");

router.post("/register", [
  body("name").trim().isLength({ min: 2, max: 120 }),
  body("email").trim().isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }).withMessage("Password must contain at least 8 characters"),
  body("department").optional().trim().isLength({ max: 120 }),
  validate
], async (req, res, next) => {
  try {
    const { name, email, password, department, phone } = req.body;
    const user = await User.create({ name, email, password, department, phone, role: "principal_investigator" });
    issueToken(user, res);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post("/login", [
  body("email").trim().isEmail().normalizeEmail(),
  body("password").isString().notEmpty(),
  validate
], async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select("+password +authVersion");
    if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ message: "Email or password is incorrect" });
    }
    issueToken(user, res);
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "strict" });
  res.json({ message: "Signed out" });
});

router.get("/me", authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
router.patch("/profile", authenticate, [
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("department").optional({ values: "falsy" }).trim().isLength({ max: 120 }),
  body("phone").optional({ values: "falsy" }).trim().isLength({ max: 40 }),
  validate
], async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    for (const key of ["name", "department", "phone"]) if (req.body[key] !== undefined) user[key] = req.body[key];
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});
router.post("/change-password", authenticate, [
  body("currentPassword").isString().notEmpty(),
  body("newPassword").isString().isLength({ min: 8, max: 200 }),
  validate
], async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+password +authVersion");
    if (!(await user.comparePassword(req.body.currentPassword))) return res.status(400).json({ message: "Current password is incorrect" });
    user.password = req.body.newPassword;
    user.authVersion += 1;
    await user.save();
    res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "strict" });
    res.json({ message: "Password changed. Sign in again with your new password." });
  } catch (error) { next(error); }
});
router.post("/forgot-password", [
  body("email").trim().isEmail().normalizeEmail(),
  validate
], async (req, res, next) => {
  try {
    if (!resetEmailConfigured()) {
      return res.status(503).json({ message: "Password recovery email is not configured. Contact a system administrator." });
    }
    const user = await User.findOne({ email: req.body.email, isActive: true });
    if (user) {
      const token = randomBytes(32).toString("base64url");
      await PasswordReset.findOneAndDelete({ user: user._id });
      await PasswordReset.create({
        user: user._id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      });
      const link = new URL("/reset-password", process.env.CLIENT_URL);
      link.searchParams.set("token", token);
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Reset your MAU-RIMS password",
        text: `Use this link within 30 minutes to reset your MAU-RIMS password: ${link.toString()}`
      });
    }
    res.json({ message: "If an active account matches that email, a password reset link has been sent." });
  } catch (error) { next(error); }
});
router.post("/reset-password", [
  body("token").isString().isLength({ min: 32, max: 128 }),
  body("password").isString().isLength({ min: 8, max: 200 }),
  validate
], async (req, res, next) => {
  try {
    const reset = await PasswordReset.findOne({
      tokenHash: hashResetToken(req.body.token),
      expiresAt: { $gt: new Date() }
    });
    if (!reset) return res.status(400).json({ message: "The reset link is invalid or has expired" });
    const user = await User.findOne({ _id: reset.user, isActive: true }).select("+password +authVersion");
    if (!user) {
      await PasswordReset.deleteOne({ _id: reset._id });
      return res.status(400).json({ message: "The reset link is invalid or has expired" });
    }
    user.password = req.body.password;
    user.authVersion += 1;
    await user.save();
    await PasswordReset.deleteOne({ _id: reset._id });
    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) { next(error); }
});

export default router;
