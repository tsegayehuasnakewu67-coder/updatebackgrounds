const test = require('node:test');
const assert = require('node:assert/strict');
const Notification = require('../models/Notification');
const {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationRead,
} = require('../controllers/notificationController');

const responseMock = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('notification unread count is scoped to the signed-in recipient and requested type', async () => {
  const originalCountDocuments = Notification.countDocuments;
  let filter;
  Notification.countDocuments = async value => {
    filter = value;
    return 2;
  };
  try {
    const res = responseMock();
    await getUnreadNotificationCount({
      user: { _id: '64b000000000000000000001' },
      query: { type: 'contact_reply' },
    }, res);
    assert.equal(res.body.data.count, 2);
    assert.deepEqual(filter.$or, [
      { recipient: '64b000000000000000000001' },
      { recipientUserId: '64b000000000000000000001' },
    ]);
    assert.ok(filter.$and.some(condition => condition.type === 'contact_reply'));
  } finally {
    Notification.countDocuments = originalCountDocuments;
  }
});

test('marking a notification read is restricted to its recipient', async () => {
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  let filter;
  let update;
  Notification.findOneAndUpdate = async (query, changes) => {
    filter = query;
    update = changes;
    return { _id: query._id, readAt: update.$set.readAt, isRead: true };
  };
  try {
    const res = responseMock();
    await markNotificationRead({
      params: { id: '64b000000000000000000002' },
      user: { _id: '64b000000000000000000001' },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(filter.$or, [
      { recipient: '64b000000000000000000001' },
      { recipientUserId: '64b000000000000000000001' },
    ]);
    assert.equal(update.$set.isRead, true);
    assert.ok(update.$set.readAt instanceof Date);
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('notification listing returns recipient notifications and an unread count', async () => {
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;
  let query;
  const docs = [{ _id: 'notification-1', type: 'contact_message' }];
  const chain = {
    populate() { return this; },
    sort() { return this; },
    limit() { return Promise.resolve(docs); },
  };
  Notification.find = value => {
    query = value;
    return chain;
  };
  Notification.countDocuments = async () => 1;
  try {
    const res = responseMock();
    await listNotifications({
      user: { _id: '64b000000000000000000001' },
      query: { limit: '8' },
    }, res);
    assert.deepEqual(res.body.data.notifications, docs);
    assert.equal(res.body.data.unreadCount, 1);
    assert.deepEqual(query.$or, [
      { recipient: '64b000000000000000000001' },
      { recipientUserId: '64b000000000000000000001' },
    ]);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  }
});
