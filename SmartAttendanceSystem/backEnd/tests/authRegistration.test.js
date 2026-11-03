const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const employeeSync = require('../utils/employeeSync');
const faceRegistration = require('../utils/faceRegistration');
const { adminOnly, protect } = require('../middleware/authMiddleware');

const responseMock = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const originalFindOne = User.findOne;
const originalFindById = User.findById;
const originalCreate = User.create;
const originalSyncEmployeeForUser = employeeSync.syncEmployeeForUser;
const originalFindDuplicateFace = faceRegistration.findDuplicateFace;
const originalDefaultPassword = process.env.DEFAULT_EMPLOYEE_PASSWORD;
let createdUsers = [];

User.findOne = async () => null;
User.create = async payload => {
  const created = {
    _id: `created-${createdUsers.length + 1}`,
    ...payload,
    faceDescriptor: payload.faceDescriptor || [],
    isActive: true,
    createdAt: new Date(),
  };
  createdUsers.push(created);
  return created;
};
employeeSync.syncEmployeeForUser = async () => {};
faceRegistration.findDuplicateFace = async () => null;
process.env.DEFAULT_EMPLOYEE_PASSWORD = 'TempPassword1!';
const { register, registerHr, signup } = require('../controllers/authController');
const { updateUser } = require('../controllers/userController');

test.after(() => {
  User.findOne = originalFindOne;
  User.create = originalCreate;
  employeeSync.syncEmployeeForUser = originalSyncEmployeeForUser;
  faceRegistration.findDuplicateFace = originalFindDuplicateFace;
  if (originalDefaultPassword === undefined) delete process.env.DEFAULT_EMPLOYEE_PASSWORD;
  else process.env.DEFAULT_EMPLOYEE_PASSWORD = originalDefaultPassword;
});

test.beforeEach(() => {
  createdUsers = [];
});

test('legacy public signup endpoint is disabled and does not persist accounts', async () => {
  const res = responseMock();
  await signup({ body: { fullName: 'Public User', role: 'admin' } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /contact your administrator/i);
  assert.equal(createdUsers.length, 0);
});

test('Admin registration always creates an Employee with a server temporary password', async () => {
  const res = responseMock();
  await register({ body: {
    fullName: 'New Employee',
    employeeId: ' emp-100 ',
    email: 'NEW.EMPLOYEE@example.test',
    department: 'Operations',
    position: 'Coordinator',
    faceDescriptor: Array(128).fill(0.1),
  } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(createdUsers.length, 1);
  assert.equal(createdUsers[0].role, 'employee');
  assert.equal(createdUsers[0].employeeId, 'EMP-100');
  assert.equal(createdUsers[0].email, 'new.employee@example.test');
  assert.equal(createdUsers[0].password, 'TempPassword1!');
  assert.equal(createdUsers[0].mustChangePassword, true);
  assert.deepEqual(createdUsers[0].faceDescriptor, Array(128).fill(0.1));
});

test('Admin employee registration rejects attempts to set HR or Admin roles', async () => {
  for (const role of ['hr', 'admin']) {
    const res = responseMock();
    await register({ body: { role } }, res);
    assert.equal(res.statusCode, 403);
  }
  assert.equal(createdUsers.length, 0);
});

test('the dedicated Admin HR workflow assigns HR regardless of client role fields', async () => {
  const res = responseMock();
  await registerHr({ body: {
    fullName: 'HR Manager',
    employeeId: ' hr-100 ',
    email: 'HR@example.test',
    department: 'Human Resources',
    position: 'HR Manager',
    password: 'StrongHrPassword1!',
    confirmPassword: 'StrongHrPassword1!',
    role: 'admin',
  } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(createdUsers[0].role, 'hr');
  assert.equal(createdUsers[0].employeeId, 'HR-100');
  assert.equal(createdUsers[0].email, 'hr@example.test');
  assert.equal(createdUsers[0].mustChangePassword, true);
  assert.equal(createdUsers[0].passwordChangedAt, null);
  assert.equal(Object.hasOwn(res.body.data.user, 'password'), false);
});

test('HR registration rejects departments and positions outside the approved options', async () => {
  for (const invalidField of ['department', 'position']) {
    const res = responseMock();
    const body = {
      fullName: 'HR Manager',
      employeeId: 'HR-101',
      email: 'hr101@example.test',
      department: 'Human Resources',
      position: 'HR Manager',
      password: 'StrongHrPassword1!',
      confirmPassword: 'StrongHrPassword1!',
    };
    body[invalidField] = 'Unapproved option';
    await registerHr({ body }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(createdUsers.length, 0);
});

test('generic account updates cannot promote an account to a privileged role', async () => {
  const existingUser = { role: 'employee' };
  User.findById = () => ({ select: async () => existingUser });
  const res = responseMock();
  try {
    await updateUser({ params: { id: 'employee-1' }, body: { role: 'hr' } }, res);
  } finally {
    User.findById = originalFindById;
  }
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /dedicated Admin workflow/i);
});

test('missing authentication returns 401 and non-admin registration attempts return 403', async () => {
  const unauthenticatedResponse = responseMock();
  await protect({ headers: {} }, unauthenticatedResponse, () => {});
  assert.equal(unauthenticatedResponse.statusCode, 401);

  for (const role of ['employee', 'hr']) {
    const res = responseMock();
    let nextCalled = false;
    adminOnly({ user: { role } }, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  }

  const adminResponse = responseMock();
  let adminNextCalled = false;
  adminOnly({ user: { role: 'admin' } }, adminResponse, () => { adminNextCalled = true; });
  assert.equal(adminNextCalled, true);
});
