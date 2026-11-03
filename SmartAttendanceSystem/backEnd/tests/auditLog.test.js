const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const FaceScanAttempt = require('../models/FaceScanAttempt');
const { recordAuditEvent, sanitizeDetails } = require('../utils/auditLog');
const { listAuditLogs, listFaceScanFailures } = require('../controllers/auditLogController');

const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('audit detail sanitization excludes credentials and biometric data', () => {
  assert.deepEqual(sanitizeDetails({
    employeeId: 'E-12',
    password: 'do-not-store',
    nested: { accessToken: 'do-not-store', faceDescriptor: [1, 2, 3], changed: true },
  }), {
    employeeId: 'E-12',
    nested: { changed: true },
  });
});

test('audit event records actor and safe request context', async () => {
  const originalCreate = AuditLog.create;
  const originalReadyState = mongoose.connection.readyState;
  let stored;
  mongoose.connection.readyState = 1;
  AuditLog.create = async event => { stored = event; };
  try {
    const req = {
      user: { _id: 'user-1', role: 'admin' },
      ip: '192.0.2.10',
      headers: { 'user-agent': 'audit-test' },
    };
    const recorded = await recordAuditEvent(req, {
      action: 'USER_ROLE_CHANGED',
      resourceType: 'user',
      resourceId: 'user-2',
      summary: 'Changed a role.',
      details: { role: 'hr', password: 'never-store' },
    });
    assert.equal(recorded, true);
    assert.equal(stored.actor, 'user-1');
    assert.equal(stored.actorRole, 'admin');
    assert.equal(stored.details.role, 'hr');
    assert.equal(Object.hasOwn(stored.details, 'password'), false);
    assert.equal(stored.ipAddress, '192.0.2.10');
  } finally {
    AuditLog.create = originalCreate;
    mongoose.connection.readyState = originalReadyState;
  }
});

test('audit list is paginated and filters are bounded by query values', async () => {
  const originalFind = AuditLog.find;
  const originalCount = AuditLog.countDocuments;
  let capturedFilter;
  let capturedSkip;
  let capturedLimit;
  const query = {
    populate() { return this; },
    sort() { return this; },
    skip(value) { capturedSkip = value; return this; },
    limit(value) { capturedLimit = value; return this; },
    lean: async () => [{ _id: 'event-1' }],
  };
  AuditLog.find = filter => { capturedFilter = filter; return query; };
  AuditLog.countDocuments = async () => 26;
  try {
    const res = responseRecorder();
    await listAuditLogs({
      query: { page: '2', limit: '25', action: 'USER_UPDATED', resourceType: 'user', from: '2026-10-01' },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(capturedSkip, 25);
    assert.equal(capturedLimit, 25);
    assert.equal(capturedFilter.action, 'USER_UPDATED');
    assert.equal(capturedFilter.resourceType, 'user');
    assert.equal(capturedFilter.createdAt.$gte.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(res.body.data.pagination.totalPages, 2);
  } finally {
    AuditLog.find = originalFind;
    AuditLog.countDocuments = originalCount;
  }
});

test('face verification events omit biometric distance and device details', async () => {
  const originalFind = FaceScanAttempt.find;
  const originalCount = FaceScanAttempt.countDocuments;
  const query = {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => [{
      _id: 'scan-1',
      outcome: 'failed',
      reason: 'unknown_face',
      employeeId: 'EMP-1',
      distance: 0.7,
      deviceInfo: 'private device string',
      createdAt: new Date('2026-10-13T10:00:00.000Z'),
    }],
  };
  FaceScanAttempt.find = () => query;
  FaceScanAttempt.countDocuments = async () => 1;
  try {
    const res = responseRecorder();
    await listFaceScanFailures({ query: {} }, res);
    assert.equal(res.body.data.events[0].action, 'FACE_SCAN_FAILED');
    assert.deepEqual(res.body.data.events[0].details, { reason: 'unknown_face', employeeId: 'EMP-1' });
    assert.equal(Object.hasOwn(res.body.data.events[0], 'deviceInfo'), false);
  } finally {
    FaceScanAttempt.find = originalFind;
    FaceScanAttempt.countDocuments = originalCount;
  }
});
