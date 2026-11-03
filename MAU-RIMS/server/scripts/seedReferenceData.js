import "dotenv/config";
import mongoose from "mongoose";
import { Campus, ResearchArea } from "../models/index.js";

if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in server/.env");

const campuses = [
  { name: "Tulu Awuliya", location: "Tulu Awuliya" },
  { name: "Mekane Selam", location: "Mekane Selam" }
];
const researchAreas = [
  "Agriculture",
  "Technology",
  "Mineral Mining",
  "Tourism",
  "Natural Resources",
  "Education",
  "Health",
  "Engineering",
  "Social Sciences",
  "Environmental Studies"
];

try {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(campuses.map((campus) => Campus.updateOne({ name: campus.name }, { $setOnInsert: campus }, { upsert: true })));
  await Promise.all(researchAreas.map((name) => ResearchArea.updateOne({ name }, { $setOnInsert: { name, active: true } }, { upsert: true })));
  console.log(`Reference data ready: ${campuses.length} campuses and ${researchAreas.length} research areas`);
} finally {
  await mongoose.disconnect();
}
