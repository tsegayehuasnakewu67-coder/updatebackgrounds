import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ROLES = [
  "super_admin",
  "directorate_admin",
  "research_coordinator",
  "college_coordinator",
  "department_coordinator",
  "principal_investigator",
  "co_researcher",
  "ethics_reviewer",
  "finance_officer",
  "management"
];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false, minlength: 8 },
  role: { type: String, enum: ROLES, default: "principal_investigator" },
  department: { type: String, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 40 },
  isActive: { type: Boolean, default: true },
  authVersion: { type: Number, default: 0, select: false }
}, { timestamps: true });

userSchema.pre("save", async function hashPassword() {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};
export const User = mongoose.model("User", userSchema);
export const PasswordReset = mongoose.model("PasswordReset", new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true }));

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });
const common = {
  title: { type: String, trim: true, maxlength: 240 },
  description: { type: String, trim: true, maxlength: 10000 },
  owner: ref("User"),
  createdBy: ref("User")
};
const makeModel = (name, fields, indexes = []) => {
  const schema = new mongoose.Schema({ ...common, ...fields }, { timestamps: true, strict: true });
  for (const index of indexes) {
    if (Array.isArray(index)) schema.index(index[0], index[1]);
    else schema.index(index);
  }
  return mongoose.model(name, schema);
};

export const Researcher = makeModel("Researcher", {
  user: { ...ref("User"), required: true, unique: true },
  department: { type: String, trim: true },
  campus: { type: String, trim: true },
  qualifications: [{ type: String, trim: true }],
  researchInterests: [{ type: String, trim: true }],
  experience: { type: String, maxlength: 5000 },
  orcid: { type: String, trim: true }
});
export const Campus = makeModel("Campus", { name: { type: String, required: true, unique: true }, location: String });
export const College = makeModel("College", { name: { type: String, required: true }, campus: { type: String, required: true } }, [[{ name: 1, campus: 1 }, { unique: true }]]);
export const Department = makeModel("Department", { name: { type: String, required: true }, college: { type: String, required: true }, campus: String }, [[{ name: 1, college: 1 }, { unique: true }]]);
export const ResearchArea = makeModel("ResearchArea", { name: { type: String, required: true, unique: true }, active: { type: Boolean, default: true } });
export const Proposal = makeModel("Proposal", {
  title: { type: String, required: true, trim: true, maxlength: 240 },
  proposalNumber: { type: String, unique: true, sparse: true },
  abstract: { type: String, maxlength: 10000 },
  researchArea: String,
  status: { type: String, enum: ["draft", "submitted", "department_screening", "college_review", "directorate_review", "revision_required", "approved", "rejected"], default: "draft" },
  assignments: [{
    reviewer: ref("User"),
    stage: { type: String, enum: ["submitted", "department_screening", "college_review", "directorate_review"] },
    assignedBy: ref("User"),
    assignedAt: { type: Date, default: Date.now }
  }],
  requestedBudget: { type: Number, min: 0, default: 0 },
  history: [{ actor: ref("User"), action: String, comment: String, at: { type: Date, default: Date.now } }]
}, [{ owner: 1, status: 1 }, { createdAt: -1 }]);
export const Review = makeModel("Review", {
  proposal: { ...ref("Proposal"), required: true },
  reviewer: { ...ref("User"), required: true },
  stage: { type: String, required: true },
  decision: { type: String, enum: ["approve", "reject", "revision"], required: true },
  comments: { type: String, required: true, maxlength: 10000 }
});
export const EthicsApplication = makeModel("EthicsApplication", {
  title: { type: String, required: true, trim: true, maxlength: 240 },
  project: ref("Project"),
  proposal: ref("Proposal"),
  status: { type: String, enum: ["draft", "submitted", "under_review", "revision_required", "approved", "rejected"], default: "draft" },
  decision: String,
  comments: String,
  certificateNumber: String
});
export const Project = makeModel("Project", {
  title: { type: String, required: true, trim: true, maxlength: 240 },
  proposal: { ...ref("Proposal"), unique: true, sparse: true },
  principalInvestigator: ref("User"),
  members: [ref("User")],
  objectives: [{ type: String, trim: true, maxlength: 1000 }],
  startDate: Date,
  endDate: Date,
  status: { type: String, enum: ["planned", "active", "on_hold", "completed", "cancelled"], default: "planned" },
  progress: { type: Number, min: 0, max: 100, default: 0 }
}, [{ principalInvestigator: 1, status: 1 }]);
export const ProjectMember = makeModel("ProjectMember", {
  project: { ...ref("Project"), required: true },
  user: { ...ref("User"), required: true },
  role: { type: String, enum: ["co_researcher", "collaborator"], default: "co_researcher" },
  addedBy: ref("User")
}, [[{ project: 1, user: 1 }, { unique: true }]]);
export const ProgressReport = makeModel("ProgressReport", {
  title: { type: String, required: true, trim: true, maxlength: 240 },
  project: { ...ref("Project"), required: true },
  period: { type: String, required: true },
  progress: { type: Number, min: 0, max: 100, required: true },
  accomplishments: String,
  challenges: String,
  nextSteps: String,
  feedback: String,
  status: { type: String, enum: ["submitted", "reviewed", "revision_required"], default: "submitted" }
});
export const Milestone = makeModel("Milestone", {
  project: { ...ref("Project"), required: true },
  dueDate: Date,
  completedAt: Date,
  status: { type: String, enum: ["pending", "in_progress", "completed", "delayed"], default: "pending" }
});
export const Budget = makeModel("Budget", {
  project: { ...ref("Project"), required: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true },
  fiscalYear: String
});
export const Expenditure = makeModel("Expenditure", {
  project: { ...ref("Project"), required: true },
  budget: ref("Budget"),
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true },
  incurredAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  reviewedBy: ref("User"),
  reviewedAt: Date,
  reviewComment: String,
  receiptDocument: ref("Document")
});
export const Document = makeModel("Document", {
  originalName: { type: String, required: true },
  storedName: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  category: String,
  relatedType: String,
  relatedId: mongoose.Schema.Types.ObjectId,
  previousVersion: ref("Document"),
  versionGroup: { type: String, required: true, index: true },
  version: { type: Number, default: 1, min: 1 },
  isLatest: { type: Boolean, default: true },
  access: { type: String, enum: ["private", "project", "university"], default: "private" }
});
export const Publication = makeModel("Publication", {
  title: { type: String, required: true, trim: true, maxlength: 240 },
  authors: [{ type: String, trim: true }],
  journal: String,
  year: { type: Number, min: 1900, max: 2200 },
  doi: String,
  type: String,
  abstract: { type: String, maxlength: 10000 },
  keywords: [{ type: String, trim: true }]
});
export const Collaboration = makeModel("Collaboration", {
  partnerInstitution: { type: String, required: true },
  project: ref("Project"),
  agreementDate: Date,
  contactEmail: String,
  status: { type: String, enum: ["proposed", "active", "completed"], default: "proposed" }
});
export const Notification = makeModel("Notification", {
  recipient: { ...ref("User"), required: true },
  message: { type: String, required: true },
  readAt: Date,
  link: String
});
export const Activity = makeModel("Activity", { action: String, targetType: String, targetId: mongoose.Schema.Types.ObjectId });
export const AuditLog = makeModel("AuditLog", {
  actor: ref("User"),
  action: { type: String, required: true },
  targetType: String,
  targetId: mongoose.Schema.Types.ObjectId,
  ip: String,
  details: String
});
export const SystemSetting = makeModel("SystemSetting", { key: { type: String, required: true, unique: true }, value: mongoose.Schema.Types.Mixed });

export const RESOURCES = {
  researchers: { model: Researcher, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator"], ownerField: "user", search: ["department", "campus"] },
  campuses: { model: Campus, read: ["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "management", "principal_investigator", "co_researcher"], write: ["super_admin", "directorate_admin"], search: ["name", "location"] },
  colleges: { model: College, read: ["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "management", "principal_investigator", "co_researcher"], write: ["super_admin", "directorate_admin"], search: ["name", "campus"] },
  departments: { model: Department, read: ["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "management", "principal_investigator", "co_researcher"], write: ["super_admin", "directorate_admin"], search: ["name", "college", "campus"] },
  researchAreas: { model: ResearchArea, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator"], search: ["name"] },
  proposals: { model: Proposal, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "principal_investigator"], ownerField: "owner", reviewerWideRead: true, search: ["title", "proposalNumber", "status", "researchArea"] },
  reviews: { model: Review, read: ["super_admin", "directorate_admin", "research_coordinator", "college_coordinator", "department_coordinator", "ethics_reviewer"], write: ["super_admin", "directorate_admin", "research_coordinator"], ownerField: "reviewer", search: ["stage", "decision"] },
  ethicsApplications: { model: EthicsApplication, read: [...ROLES], write: ["super_admin", "directorate_admin", "principal_investigator", "ethics_reviewer"], ownerField: "owner", ethicsReviewerWideRead: true, search: ["title", "status", "certificateNumber"] },
  projects: { model: Project, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator", "principal_investigator"], ownerField: "principalInvestigator", memberField: "members", search: ["title", "status"] },
  progressReports: { model: ProgressReport, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator", "principal_investigator", "co_researcher"], ownerField: "owner", search: ["period", "status"] },
  milestones: { model: Milestone, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator", "principal_investigator"], ownerField: "owner", search: ["title", "status"] },
  budgets: { model: Budget, read: ["super_admin", "directorate_admin", "research_coordinator", "finance_officer", "management"], write: ["super_admin", "directorate_admin", "finance_officer"], search: ["category", "fiscalYear"] },
  expenditures: { model: Expenditure, read: ["super_admin", "directorate_admin", "research_coordinator", "finance_officer", "management"], write: ["super_admin", "directorate_admin", "finance_officer"], search: ["category", "status"] },
  publications: { model: Publication, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator", "principal_investigator", "co_researcher"], ownerField: "owner", search: ["title", "journal", "doi", "year"] },
  collaborations: { model: Collaboration, read: [...ROLES], write: ["super_admin", "directorate_admin", "research_coordinator"], search: ["title", "partnerInstitution", "status"] },
  notifications: { model: Notification, read: [...ROLES], write: ["super_admin", "directorate_admin"], ownerField: "recipient", search: ["message"] },
  activities: { model: Activity, read: ["super_admin", "directorate_admin", "research_coordinator", "management"], write: [], search: ["action", "targetType"] },
  auditLogs: { model: AuditLog, read: ["super_admin", "directorate_admin"], write: [], search: ["action", "targetType"] },
  systemSettings: { model: SystemSetting, read: ["super_admin", "directorate_admin"], write: ["super_admin"], search: ["key"] }
};
