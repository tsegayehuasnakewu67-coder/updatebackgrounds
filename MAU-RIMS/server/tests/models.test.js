import assert from "node:assert/strict";
import test from "node:test";
import { PasswordReset, Proposal, Project, ROLES, User } from "../models/index.js";

test("the system defines the requested role set", () => {
  assert.equal(ROLES.length, 10);
  assert.ok(ROLES.includes("super_admin"));
  assert.ok(ROLES.includes("ethics_reviewer"));
});

test("proposal title is required and workflow status is constrained", async () => {
  await assert.rejects(new Proposal({ status: "draft" }).validate(), (error) => error.errors.title?.kind === "required");
  await assert.rejects(new Proposal({ title: "Valid title", status: "unapproved" }).validate(), (error) => error.errors.status?.kind === "enum");
  await assert.doesNotReject(new Proposal({ title: "Valid title", status: "draft" }).validate());
});

test("user passwords are excluded from default query projections", () => {
  assert.equal(User.schema.path("password").options.select, false);
  assert.equal(User.schema.path("authVersion").options.select, false);
});

test("projects cannot be registered twice from the same proposal", () => {
  const proposalIndex = Project.schema.indexes().find(([fields, options]) => fields.proposal === 1 && options.unique);
  assert.ok(proposalIndex);
  assert.equal(proposalIndex[1].sparse, true);
});

test("password reset tokens have a database TTL index", () => {
  assert.ok(PasswordReset.schema.indexes().some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
});
