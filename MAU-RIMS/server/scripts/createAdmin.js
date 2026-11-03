import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/index.js";

const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  throw new Error("Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 12 characters) in server/.env");
}

try {
  await mongoose.connect(MONGODB_URI);
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) throw new Error("An account with ADMIN_EMAIL already exists");
  await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "super_admin" });
  console.log(`Created super administrator ${ADMIN_EMAIL}`);
} finally {
  await mongoose.disconnect();
}
