const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const LeaveRequest = require('../models/LeaveRequest');
const { createLeave, reviewLeave } = require('../controllers/leaveController');

const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('leave request rejects impossible dates before persistence', async () => {
  const originalCreate = LeaveRequest.create;
  let persisted = false;
  LeaveRequest.create = async () => { persisted = true; };
  try {
    const res = responseRecorder();
    await createLeave({
      user: { _id: 'employee-1', role: 'employee' },
      body: { startDate: '2026-02-30', endDate: '2026-03-01', reason: 'Leave' },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(persisted, false);
  } finally {
    LeaveRequest.create = originalCreate;
  }
});

test('leave request uses the authenticated account, not a client employee id', async () => {
  const originalCreate = LeaveRequest.create;
  const originalAuditCreate = AuditLog.create;
  const originalReadyState = mongoose.connection.readyState;
  let payload;
  mongoose.connection.readyState = 1;
  LeaveRequest.create = async value => { payload = value; return { _id: 'leave-1', ...value }; };
  AuditLog.create = async () => ({});
  try {
    const res = responseRecorder();
    await createLeave({
      user: { _id: 'employee-1', role: 'employee' },
      ip: '192.0.2.2',
      body: {
        employee: 'employee-2',
        type: 'annual',
        startDate: '2026-10-14',
        endDate: '2026-10-15',
        reason: 'Annual leave',
      },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(payload.employee, 'employee-1');
    assert.equal(Object.hasOwn(payload, 'employeeId'), false);
  } finally {
    LeaveRequest.create = originalCreate;
    AuditLog.create = originalAuditCreate;
    mongoose.connection.readyState = originalReadyState;
  }
});

test('leave review rejects requests already decided', async () => {
  const originalFindById = LeaveRequest.findById;
  let updated = false;
  const originalUpdate = LeaveRequest.findOneAndUpdate;
  LeaveRequest.findById = async () => ({ status: 'approved' });
  LeaveRequest.findOneAndUpdate = async () => { updated = true; };
  try {
    const res = responseRecorder();
    await reviewLeave({
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { status: 'rejected' },
      user: { _id: 'reviewer-1', role: 'admin' },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(updated, false);
  } finally {
    LeaveRequest.findById = originalFindById;
    LeaveRequest.findOneAndUpdate = originalUpdate;
  }
});
