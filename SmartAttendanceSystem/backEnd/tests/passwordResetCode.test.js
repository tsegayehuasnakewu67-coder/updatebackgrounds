const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyPasswordResetCode, resetPassword } = require('../controllers/authController');

const responseMock = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const codeHash = (email, code, secret) => crypto.createHmac('sha256', secret)
  .update(`${email}:${code}`).digest('hex');

test('valid reset code becomes a short-lived, hashed, single-use reset grant', async () => {
  const originalFindOne = User.findOne;
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-for-password-reset-challenge';
  const email = 'staff@example.test';
  const record = {
    _id: '507f191e810c19729de860ea',
    email,
    passwordResetCodeHash: codeHash(email, '042581', process.env.JWT_SECRET),
    passwordResetCodeExpiresAt: new Date(Date.now() + 60_000),
    passwordResetCodeAttempts: 0,
  };
  let atomicFilter;
  let atomicUpdate;
  User.findOne = () => ({ select: async () => record });
  User.findOneAndUpdate = async (filter, update) => {
    atomicFilter = filter;
    atomicUpdate = update;
    return { _id: record._id };
  };

  try {
    const res = responseMock();
    await verifyPasswordResetCode({ body: { email, code: '042581' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.data.resetToken, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(res.body).includes('042581'), false);
    assert.equal(atomicFilter.passwordResetCodeHash, record.passwordResetCodeHash);
    assert.equal(atomicUpdate.$set.passwordResetCodeHash, null);
    assert.equal(atomicUpdate.$set.passwordResetGrantHash.length, 64);
    assert.notEqual(atomicUpdate.$set.passwordResetGrantHash, res.body.data.resetToken);
    assert.ok(atomicUpdate.$set.passwordResetGrantExpiresAt > new Date());
  } finally {
    User.findOne = originalFindOne;
    User.findOneAndUpdate = originalFindOneAndUpdate;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

test('incorrect reset code increments attempts and does not issue a grant', async () => {
  const originalFindOne = User.findOne;
  const originalUpdateOne = User.updateOne;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-for-password-reset-challenge';
  const email = 'staff@example.test';
  const record = {
    _id: '507f191e810c19729de860ea',
    email,
    passwordResetCodeHash: codeHash(email, '042581', process.env.JWT_SECRET),
    passwordResetCodeExpiresAt: new Date(Date.now() + 60_000),
    passwordResetCodeAttempts: 0,
  };
  let update;
  User.findOne = () => ({ select: async () => record });
  User.updateOne = async (_filter, updateDoc) => { update = updateDoc; return { modifiedCount: 1 }; };

  try {
    const res = responseMock();
    await verifyPasswordResetCode({ body: { email, code: '123456' } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(update.$inc, { passwordResetCodeAttempts: 1 });
    assert.equal(res.body.data, undefined);
  } finally {
    User.findOne = originalFindOne;
    User.updateOne = originalUpdateOne;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

test('expired reset code is rejected without issuing a grant', async () => {
  const originalFindOne = User.findOne;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-for-password-reset-challenge';
  const email = 'staff@example.test';
  User.findOne = () => ({ select: async () => ({
    _id: '507f191e810c19729de860ea',
    email,
    passwordResetCodeHash: codeHash(email, '042581', process.env.JWT_SECRET),
    passwordResetCodeExpiresAt: new Date(Date.now() - 1000),
    passwordResetCodeAttempts: 0,
  }) });

  try {
    const res = responseMock();
    await verifyPasswordResetCode({ body: { email, code: '042581' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.data, undefined);
  } finally {
    User.findOne = originalFindOne;
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

test('verified reset grant changes the password and cannot be reused', async () => {
  const originalFindOne = User.findOne;
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const grant = 'c'.repeat(64);
  const user = {
    _id: '507f191e810c19729de860ea',
    password: '$2a$existing-hash',
    authVersion: 2,
    comparePassword: async () => false,
  };
  const updatedUser = { _id: user._id, authVersion: 3 };
  let atomicFilter;
  let atomicUpdate;
  User.findOne = () => ({ select: async () => user });
  User.findOneAndUpdate = async (filter, update) => {
    atomicFilter = filter;
    atomicUpdate = update;
    return updatedUser;
  };

  try {
    const body = {
      resetToken: grant,
      newPassword: 'NewStrongPassword123!',
      confirmPassword: 'NewStrongPassword123!',
    };
    const res = responseMock();
    await resetPassword({ body }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(atomicFilter.passwordResetGrantHash.length, 64);
    assert.notEqual(atomicFilter.passwordResetGrantHash, grant);
    assert.equal(await bcrypt.compare(body.newPassword, atomicUpdate.$set.password), true);
    assert.equal(atomicUpdate.$set.passwordResetGrantHash, null);
    assert.equal(atomicUpdate.$set.passwordResetCodeHash, null);
    assert.equal(atomicUpdate.$set.authVersion, 3);

    User.findOne = () => ({ select: async () => null });
    const reuseResponse = responseMock();
    await resetPassword({ body }, reuseResponse);
    assert.equal(reuseResponse.statusCode, 400);
  } finally {
    User.findOne = originalFindOne;
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }
});