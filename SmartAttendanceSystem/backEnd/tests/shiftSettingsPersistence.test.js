const test = require('node:test');
const assert = require('node:assert/strict');
const ShiftSettings = require('../models/ShiftSettings');
const { getSettings, updateSettings } = require('../controllers/shiftController');

const settingsPayload = {
  startHour: 8,
  startMinute: 30,
  gracePeriod: 5,
  endHour: 17,
  endMinute: 30,
  lunchEnabled: true,
  lunchStartHour: 12,
  lunchStartMinute: 30,
  lunchDuration: 60,
  beforeLunchStartHour: 8,
  beforeLunchStartMinute: 30,
  beforeLunchEndHour: 12,
  beforeLunchEndMinute: 30,
  afterLunchStartHour: 13,
  afterLunchStartMinute: 30,
  afterLunchEndHour: 17,
  afterLunchEndMinute: 30,
  timeZone: 'America/New_York',
  timeFormat: '12-hour',
  notifyCheckIn: true,
  notifyCheckOut: true,
};

const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  set() {
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('shift settings update returns saved values and GET reloads them', async () => {
  const originalFindOne = ShiftSettings.findOne;
  const originalFindOneAndUpdate = ShiftSettings.findOneAndUpdate;
  let stored;
  ShiftSettings.findOneAndUpdate = async (_query, values) => {
    if (values.$setOnInsert) {
      stored ||= { _key: 'default', ...values.$setOnInsert };
      return stored;
    }
    stored = { _key: 'default', ...values };
    return stored;
  };
  ShiftSettings.findOne = async () => stored;

  try {
    const firstLoadResponse = responseRecorder();
    await getSettings({}, firstLoadResponse);
    assert.equal(firstLoadResponse.body.data.startHour, 8);
    assert.equal(firstLoadResponse.body.data.startMinute, 30);
    assert.equal(firstLoadResponse.body.data.endMinute, 30);
    assert.equal(firstLoadResponse.body.data.lunchEnabled, true);
    assert.equal(firstLoadResponse.body.data.lunchStartMinute, 30);
    assert.equal(firstLoadResponse.body.data.beforeLunchEndMinute, 30);
    assert.equal(firstLoadResponse.body.data.afterLunchStartMinute, 30);
    assert.equal(firstLoadResponse.body.data.timeZone, 'Africa/Addis_Ababa');
    assert.equal(firstLoadResponse.body.data.timeFormat, '24-hour');

    const saveResponse = responseRecorder();
    await updateSettings({ body: settingsPayload }, saveResponse);
    assert.equal(saveResponse.statusCode, 200);
    assert.equal(saveResponse.body.data.startHour, 8);
    assert.equal(saveResponse.body.data.startMinute, 30);
    assert.equal(saveResponse.body.data.endMinute, 30);
    assert.equal(saveResponse.body.data.afterLunchEndMinute, 30);

    const reloadResponse = responseRecorder();
    await getSettings({}, reloadResponse);
    assert.equal(reloadResponse.body.data.startHour, 8);
    assert.equal(reloadResponse.body.data.gracePeriod, 5);
    assert.equal(reloadResponse.body.data.beforeLunchStartHour, 8);
    assert.equal(reloadResponse.body.data.timeZone, 'America/New_York');
    assert.equal(reloadResponse.body.data.timeFormat, '12-hour');

    stored = { _key: 'default', ...stored, startHour: 9, startMinute: 15 };
    const existingResponse = responseRecorder();
    await getSettings({}, existingResponse);
    assert.equal(existingResponse.body.data.startHour, 9);
    assert.equal(existingResponse.body.data.startMinute, 15);
  } finally {
    ShiftSettings.findOne = originalFindOne;
    ShiftSettings.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
