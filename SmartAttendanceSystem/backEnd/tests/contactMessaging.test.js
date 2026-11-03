const test = require('node:test');
const assert = require('node:assert/strict');
const ContactMessage = require('../models/ContactMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('../services/emailService');
const {
  submitContactMessage,
  getMyContactMessage,
  replyToContactMessage,
} = require('../controllers/contactMessageController');
const { adminOnly, employeeOnly } = require('../middleware/authMiddleware');

const originalUserFind = User.find;
const originalNotificationInsertMany = Notification.insertMany;
User.find = () => ({ select: async () => [{ _id: '64b000000000000000000099' }] });
Notification.insertMany = async () => [];

test.after(() => {
  User.find = originalUserFind;
  Notification.insertMany = originalNotificationInsertMany;
});

const responseMock = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('contact message schema creates pending unread records with IDs and dates', () => {
  const record = new ContactMessage({
    fullName: 'Ada Example',
    email: 'ada@example.test',
    subject: 'Attendance question',
    message: 'Please tell me how attendance works.',
  });
  assert.equal(record.validateSync(), undefined);
  assert.match(record.messageId, /^SAT-/);
  assert.equal(record.ticketId, record.messageId);
  assert.equal(record.status, 'pending');
  assert.equal(record.isRead, false);
  assert.ok(record.submittedAt instanceof Date);
  assert.equal(record.lastRepliedAt, null);
  assert.deepEqual(record.replies, []);
});

test('public contact endpoint refuses empty fields before persistence', async () => {
  const originalCreate = ContactMessage.create;
  ContactMessage.create = async () => { throw new Error('Should not persist invalid message.'); };
  try {
    const res = responseMock();
    await submitContactMessage({ body: { fullName: '', email: '', subject: '', message: '' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  } finally {
    ContactMessage.create = originalCreate;
  }
});

test('valid contact submission persists submitted content and returns only public confirmation', async () => {
  const originalCreate = ContactMessage.create;
  const originalInsertMany = Notification.insertMany;
  let saved;
  let adminNotifications;
  ContactMessage.create = async payload => {
    saved = payload;
    return { _id: '64b000000000000000000098', messageId: 'SAT-123-ABCD' };
  };
  Notification.insertMany = async docs => { adminNotifications = docs; };
  try {
    const res = responseMock();
    await submitContactMessage({ body: {
      fullName: ' Ada Example ',
      email: 'ADA@EXAMPLE.TEST',
      subject: ' Attendance question ',
      message: ' Please tell me how attendance works. ',
    } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(saved.fullName, 'Ada Example');
    assert.equal(saved.email, 'ada@example.test');
    assert.equal(saved.subject, 'Attendance question');
    assert.equal(saved.message, 'Please tell me how attendance works.');
    assert.equal(res.body.data.messageId, 'SAT-123-ABCD');
    assert.equal(res.body.data.ticketId, 'SAT-123-ABCD');
    assert.equal(adminNotifications.length, 1);
    assert.equal(adminNotifications[0].type, 'contact_message');
    assert.equal(adminNotifications[0].recipientUserId, '64b000000000000000000099');
    assert.equal(adminNotifications[0].relatedMessageId, '64b000000000000000000098');
    assert.equal(adminNotifications[0].isRead, false);
    assert.equal(JSON.stringify(res.body).includes('MAIL_PASSWORD'), false);
  } finally {
    ContactMessage.create = originalCreate;
    Notification.insertMany = originalInsertMany;
  }
});

test('repeated contact submissions with the same idempotency key return the existing ticket', async () => {
  const originalFindOne = ContactMessage.findOne;
  const originalCreate = ContactMessage.create;
  ContactMessage.findOne = async query => {
    assert.equal(query.submissionKey, '550e8400-e29b-41d4-a716-446655440000');
    return { ticketId: 'SAT-EXISTING-1', messageId: 'SAT-EXISTING-1' };
  };
  ContactMessage.create = async () => { throw new Error('Duplicate message must not be created.'); };
  try {
    const res = responseMock();
    await submitContactMessage({ body: {
      fullName: 'Ada Example',
      email: 'ada@example.test',
      subject: 'Attendance question',
      message: 'Please tell me how attendance works.',
      submissionId: '550e8400-e29b-41d4-a716-446655440000',
    } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.duplicate, true);
    assert.equal(res.body.data.ticketId, 'SAT-EXISTING-1');
  } finally {
    ContactMessage.findOne = originalFindOne;
    ContactMessage.create = originalCreate;
  }
});

test('authenticated employee submissions use the account identity and are linked to the account', async () => {
  const originalCreate = ContactMessage.create;
  let saved;
  ContactMessage.create = async payload => {
    saved = payload;
    return { ticketId: 'SAT-EMPLOYEE-1', messageId: 'SAT-EMPLOYEE-1' };
  };
  try {
    const res = responseMock();
    await submitContactMessage({
      user: { _id: '64b000000000000000000001', role: 'employee', fullName: 'Account Employee', email: 'account@example.test' },
      body: {
        fullName: 'Impersonated Name',
        email: 'attacker@example.test',
        subject: 'Help with attendance',
        message: 'I need assistance with my attendance record.',
      },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(saved.userId, '64b000000000000000000001');
    assert.equal(saved.fullName, 'Account Employee');
    assert.equal(saved.email, 'account@example.test');
  } finally {
    ContactMessage.create = originalCreate;
  }
});

test('employee ticket lookup scopes the database query to the authenticated owner', async () => {
  const originalFindOne = ContactMessage.findOne;
  let query;
  ContactMessage.findOne = async value => {
    query = value;
    return null;
  };
  try {
    const res = responseMock();
    await getMyContactMessage({
      params: { id: '64b000000000000000000002' },
      user: { _id: '64b000000000000000000001', role: 'employee' },
    }, res);
    assert.deepEqual(query, {
      _id: '64b000000000000000000002',
      userId: '64b000000000000000000001',
    });
    assert.equal(res.statusCode, 404);
  } finally {
    ContactMessage.findOne = originalFindOne;
  }
});

test('authenticated admin reply is persisted when notification creation fails', async () => {
  const originalFindById = ContactMessage.findById;
  const originalNotificationCreate = Notification.create;
  const originalEmailConfigured = emailService.isEmailConfigured;
  const originalSendEmail = emailService.sendContactReplyEmail;
  let saved = false;
  const ticket = {
    _id: '64b000000000000000000002',
    ticketId: 'SAT-REPLY-1',
    messageId: 'SAT-REPLY-1',
    userId: '64b000000000000000000001',
    fullName: 'Ada Example',
    email: 'ada@example.test',
    subject: 'Attendance question',
    message: 'Please explain my attendance entry.',
    status: 'pending',
    isRead: false,
    submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    replies: [],
    save: async () => { saved = true; },
  };
  ContactMessage.findById = async () => ticket;
  Notification.create = async () => { throw new Error('Notification store unavailable'); };
  emailService.isEmailConfigured = () => true;
  emailService.sendContactReplyEmail = async () => { throw new Error('Authenticated replies should not be emailed.'); };
  try {
    const res = responseMock();
    await replyToContactMessage({
      params: { id: ticket._id },
      body: { message: 'We are reviewing the record for you.' },
      user: { _id: '64b000000000000000000003', fullName: 'Admin User', email: 'admin@example.test' },
    }, res);
    assert.equal(saved, true);
    assert.equal(ticket.replies.length, 1);
    assert.equal(ticket.replies[0].senderRole, 'admin');
    assert.equal(ticket.status, 'replied');
    assert.ok(ticket.lastRepliedAt instanceof Date);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.emailSent, false);
    assert.equal(res.body.data.emailError, '');
    assert.equal(res.body.data.message.emailDeliveryStatus, 'not_required');
    assert.equal(res.body.data.notificationCreated, false);
    assert.match(res.body.data.notificationError, /could not be created/);
  } finally {
    ContactMessage.findById = originalFindById;
    Notification.create = originalNotificationCreate;
    emailService.isEmailConfigured = originalEmailConfigured;
    emailService.sendContactReplyEmail = originalSendEmail;
  }
});

test('anonymous admin reply stays saved when configured email delivery fails', async () => {
  const originalFindById = ContactMessage.findById;
  const originalEmailConfigured = emailService.isEmailConfigured;
  const originalSendEmail = emailService.sendContactReplyEmail;
  const ticket = {
    _id: '64b000000000000000000052',
    ticketId: 'SAT-EMAIL-FAIL',
    userId: null,
    fullName: 'Anonymous Sender',
    email: 'visitor@example.test',
    subject: 'Contact question',
    message: 'I need help with an attendance record.',
    status: 'pending',
    isRead: false,
    replies: [],
    save: async () => {},
  };
  ContactMessage.findById = async () => ticket;
  emailService.isEmailConfigured = () => true;
  emailService.sendContactReplyEmail = async () => { throw new Error('SMTP unavailable'); };
  try {
    const res = responseMock();
    await replyToContactMessage({
      params: { id: ticket._id },
      body: { message: 'Please contact the attendance office.' },
      user: { _id: '64b000000000000000000053', fullName: 'Admin User' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(ticket.replies.length, 1);
    assert.equal(ticket.status, 'replied');
    assert.equal(res.body.data.emailSent, false);
    assert.match(res.body.data.emailError, /could not be delivered/);
    assert.equal(res.body.data.message.emailDeliveryStatus, 'failed');
  } finally {
    ContactMessage.findById = originalFindById;
    emailService.isEmailConfigured = originalEmailConfigured;
    emailService.sendContactReplyEmail = originalSendEmail;
  }
});

test('admin replies notify the authenticated ticket owner', async () => {
  const originalFindById = ContactMessage.findById;
  const originalNotificationCreate = Notification.create;
  const originalEmailConfigured = emailService.isEmailConfigured;
  const ticket = {
    _id: '64b000000000000000000012',
    ticketId: 'SAT-NOTIFY-1',
    messageId: 'SAT-NOTIFY-1',
    userId: '64b000000000000000000011',
    fullName: 'Ada Example',
    email: 'ada@example.test',
    subject: 'Attendance question',
    message: 'Please explain my attendance entry.',
    status: 'pending',
    isRead: false,
    submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    replies: [],
    save: async () => {},
  };
  let notification;
  ContactMessage.findById = async () => ticket;
  Notification.create = async value => { notification = value; };
  emailService.isEmailConfigured = () => false;
  try {
    const res = responseMock();
    await replyToContactMessage({
      params: { id: ticket._id },
      body: { message: 'Your attendance entry has been reviewed.' },
      user: { _id: '64b000000000000000000013', fullName: 'Admin User', email: 'admin@example.test' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(notification.recipient, ticket.userId);
    assert.equal(notification.recipientUserId, ticket.userId);
    assert.equal(notification.sender, '64b000000000000000000013');
    assert.equal(notification.type, 'contact_reply');
    assert.equal(notification.relatedMessageId, ticket._id);
    assert.equal(res.body.data.notificationCreated, true);
    assert.equal(res.body.data.message.replies[0].senderRole, 'admin');
    assert.equal(res.body.data.message.emailDeliveryStatus, 'not_required');
  } finally {
    ContactMessage.findById = originalFindById;
    Notification.create = originalNotificationCreate;
    emailService.isEmailConfigured = originalEmailConfigured;
  }
});

test('authenticated ticket replies use in-app delivery without also emailing the sender', async () => {
  const originalFindById = ContactMessage.findById;
  const originalNotificationCreate = Notification.create;
  const originalEmailConfigured = emailService.isEmailConfigured;
  const originalSendEmail = emailService.sendContactReplyEmail;
  const ticket = {
    _id: '64b000000000000000000042',
    ticketId: 'SAT-ACCOUNT-DELIVERY',
    userId: '64b000000000000000000041',
    fullName: 'Account Sender',
    email: 'account@example.test',
    subject: 'Account question',
    message: 'Please review my account ticket.',
    status: 'pending',
    isRead: false,
    replies: [],
    save: async () => {},
  };
  ContactMessage.findById = async () => ticket;
  Notification.create = async () => {};
  emailService.isEmailConfigured = () => true;
  emailService.sendContactReplyEmail = async () => {
    throw new Error('Authenticated account replies should not be sent by email.');
  };
  try {
    const res = responseMock();
    await replyToContactMessage({
      params: { id: ticket._id },
      body: { message: 'Your account ticket has been reviewed.' },
      user: { _id: '64b000000000000000000043', fullName: 'Admin User' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.notificationCreated, true);
    assert.equal(res.body.data.emailSent, false);
    assert.equal(res.body.data.emailError, '');
    assert.equal(res.body.data.message.emailDeliveryStatus, 'not_required');
  } finally {
    ContactMessage.findById = originalFindById;
    Notification.create = originalNotificationCreate;
    emailService.isEmailConfigured = originalEmailConfigured;
    emailService.sendContactReplyEmail = originalSendEmail;
  }
});

test('anonymous replies retain the saved reply and report unconfigured email delivery', async () => {
  const originalFindById = ContactMessage.findById;
  const originalEmailConfigured = emailService.isEmailConfigured;
  const ticket = {
    _id: '64b000000000000000000022',
    ticketId: 'SAT-ANON-1',
    fullName: 'Anonymous Sender',
    email: 'anonymous@example.test',
    subject: 'Contact request',
    message: 'Please help with attendance.',
    userId: null,
    status: 'pending',
    isRead: false,
    replies: [],
    save: async () => {},
  };
  ContactMessage.findById = async () => ticket;
  emailService.isEmailConfigured = () => false;
  try {
    const res = responseMock();
    await replyToContactMessage({
      params: { id: ticket._id },
      body: { message: 'Please contact the attendance office.' },
      user: { _id: '64b000000000000000000023', fullName: 'Admin User' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(ticket.replies.length, 1);
    assert.equal(res.body.data.emailSent, false);
    assert.match(res.body.data.emailError, /not configured/i);
    assert.equal(res.body.data.message.emailDeliveryStatus, 'not_configured');
  } finally {
    ContactMessage.findById = originalFindById;
    emailService.isEmailConfigured = originalEmailConfigured;
  }
});

test('anonymous reply email status is sent only after the email provider confirms delivery', async () => {
  const originalFindById = ContactMessage.findById;
  const originalEmailConfigured = emailService.isEmailConfigured;
  const originalSendEmail = emailService.sendContactReplyEmail;
  const ticket = {
    _id: '64b000000000000000000032',
    ticketId: 'SAT-ANON-2',
    fullName: 'Anonymous Sender',
    email: 'anonymous@example.test',
    subject: 'Contact request',
    message: 'Please help with attendance.',
    userId: null,
    status: 'pending',
    isRead: false,
    replies: [],
    save: async () => {},
  };
  let delivery;
  ContactMessage.findById = async () => ticket;
  emailService.isEmailConfigured = () => true;
  emailService.sendContactReplyEmail = async value => { delivery = value; return { accepted: [value.email] }; };
  try {
    const res = responseMock();
    await replyToContactMessage({
      params: { id: ticket._id },
      body: { message: 'The attendance office can help you.' },
      user: { _id: '64b000000000000000000033', fullName: 'Admin User' },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(delivery.email, ticket.email);
    assert.equal(delivery.originalMessage, ticket.message);
    assert.equal(res.body.data.emailSent, true);
    assert.equal(res.body.data.message.emailDeliveryStatus, 'sent');
  } finally {
    ContactMessage.findById = originalFindById;
    emailService.isEmailConfigured = originalEmailConfigured;
    emailService.sendContactReplyEmail = originalSendEmail;
  }
});

test('empty admin replies are rejected before looking up a ticket', async () => {
  const originalFindById = ContactMessage.findById;
  ContactMessage.findById = async () => { throw new Error('Ticket lookup should not run'); };
  try {
    const res = responseMock();
    await replyToContactMessage({
      params: { id: '64b000000000000000000002' },
      body: { message: '   ' },
      user: { _id: '64b000000000000000000003' },
    }, res);
    assert.equal(res.statusCode, 400);
  } finally {
    ContactMessage.findById = originalFindById;
  }
});

test('admin routes reject non-admin roles and employee routes reject non-employees', () => {
  for (const [middleware, role] of [[adminOnly, 'hr'], [employeeOnly, 'admin']]) {
    const res = responseMock();
    let nextCalled = false;
    middleware({ user: { role } }, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  }
});