const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getShiftBounds,
  getAttendanceDate,
  getGrossDurationMinutes,
  getNetDurationMinutes,
  getCompletedWorkMinutes,
  validateShiftSettings,
} = require('../utils/shiftTime');
const { calcStatus, resolveSessionAction } = require('../controllers/attendanceController');
const { createAddisAbabaDateTime } = require('../utils/ethiopianTime');

const normalShift = {
  startHour: 8,
  startMinute: 30,
  gracePeriod: 5,
  endHour: 17,
  endMinute: 0,
  lunchEnabled: false,
  lunchStartHour: 12,
  lunchStartMinute: 0,
  lunchDuration: 60,
  beforeLunchStartHour: 8,
  beforeLunchStartMinute: 30,
  beforeLunchEndHour: 12,
  beforeLunchEndMinute: 0,
  afterLunchStartHour: 13,
  afterLunchStartMinute: 0,
  afterLunchEndHour: 17,
  afterLunchEndMinute: 0,
};

test('same-day shift durations subtract lunch only when enabled', () => {
  assert.equal(getGrossDurationMinutes(normalShift), 510);
  assert.equal(getNetDurationMinutes(normalShift), 510);
  assert.equal(getNetDurationMinutes({ ...normalShift, lunchEnabled: true }), 450);
});

test('present deadline is inclusive and the first minute after it is late', () => {
  const start = { ...normalShift, startHour: 11, startMinute: 19 };
  assert.deepEqual(calcStatus(createAddisAbabaDateTime('2026-10-13', 11, 24), start), {
    status: 'Present',
    lateMinutes: 0,
  });
  assert.deepEqual(calcStatus(createAddisAbabaDateTime('2026-10-13', 11, 25), start), {
    status: 'Late',
    lateMinutes: 1,
  });
  assert.equal(calcStatus(new Date('2026-10-13T08:24:00.000Z'), start).status, 'Present');
  assert.deepEqual(calcStatus(new Date('2026-10-13T08:24:01.000Z'), start), {
    status: 'Late',
    lateMinutes: 1,
  });
});

test('kiosk closes at the configured after-lunch window end', () => {
  const shift = { ...normalShift, afterLunchEndHour: 16, afterLunchEndMinute: 0 };
  assert.equal(
    resolveSessionAction(null, createAddisAbabaDateTime('2026-10-13', 16, 1), shift),
    'closed',
  );
});

test('overnight shift duration and attendance date remain anchored to shift start', () => {
  const shift = {
    ...normalShift,
    startHour: 22,
    startMinute: 0,
    endHour: 6,
    endMinute: 0,
    beforeLunchStartHour: 22,
    beforeLunchStartMinute: 0,
    beforeLunchEndHour: 2,
    beforeLunchEndMinute: 0,
    afterLunchStartHour: 3,
    afterLunchStartMinute: 0,
    afterLunchEndHour: 6,
    afterLunchEndMinute: 0,
  };
  assert.deepEqual(getShiftBounds(shift), {
    start: 1320,
    end: 360,
    endOffset: 1800,
    duration: 480,
    overnight: true,
  });
  const afterMidnight = createAddisAbabaDateTime('2026-10-14', 0, 10);
  assert.equal(getAttendanceDate(afterMidnight, shift), '2026-10-13');
  assert.equal(resolveSessionAction(null, afterMidnight, shift), 'morning_checkin');
  assert.equal(resolveSessionAction(
    null,
    createAddisAbabaDateTime('2026-10-14', 6, 1),
    shift,
  ), 'closed');
});

test('shift settings reject an end time that is not later than the start time', () => {
  const shift = {
    ...normalShift,
    startHour: 22,
    startMinute: 0,
    endHour: 6,
    endMinute: 0,
    lunchEnabled: true,
    lunchStartHour: 2,
    lunchStartMinute: 0,
    lunchDuration: 60,
    beforeLunchStartHour: 22,
    beforeLunchStartMinute: 0,
    beforeLunchEndHour: 2,
    beforeLunchEndMinute: 0,
    afterLunchStartHour: 3,
    afterLunchStartMinute: 0,
    afterLunchEndHour: 6,
    afterLunchEndMinute: 0,
  };
  assert.equal(validateShiftSettings(shift), 'Official shift start must be earlier than the shift end.');
});

test('requested A-E schedules validate consistently in total minutes', () => {
  const valid = {
    ...normalShift,
    endHour: 17,
    endMinute: 30,
    lunchEnabled: true,
    lunchStartHour: 12,
    lunchStartMinute: 30,
    lunchDuration: 60,
    beforeLunchEndHour: 12,
    beforeLunchEndMinute: 30,
    afterLunchStartHour: 13,
    afterLunchStartMinute: 30,
    afterLunchEndHour: 17,
    afterLunchEndMinute: 30,
  };
  assert.equal(validateShiftSettings(valid), null);
  assert.equal(validateShiftSettings({
    ...valid,
    afterLunchStartHour: 17,
    afterLunchStartMinute: 0,
    afterLunchEndHour: 16,
    afterLunchEndMinute: 30,
  }) !== null, true);
  assert.equal(validateShiftSettings({ ...valid, afterLunchEndHour: 18, afterLunchEndMinute: 0 }) !== null, true);
  assert.equal(
    validateShiftSettings({ ...valid, endHour: 12 }),
    'Afternoon window ends at 17:30, after the official shift end at 12:30.',
  );
  assert.equal(validateShiftSettings({ ...valid, beforeLunchEndHour: 14, beforeLunchEndMinute: 0 }) !== null, true);
  assert.equal(validateShiftSettings({ ...valid, afterLunchEndHour: 17, afterLunchEndMinute: 30 }), null);
});

test('attendance day and late status follow the configured timezone', () => {
  const shift = { ...normalShift, timeZone: 'America/New_York' };
  const beforeLocalMidnight = new Date('2026-10-14T03:45:00.000Z');
  assert.equal(getAttendanceDate(beforeLocalMidnight, shift), '2026-10-13');
  assert.deepEqual(calcStatus(new Date('2026-10-13T12:36:00.000Z'), shift), {
    status: 'Late',
    lateMinutes: 1,
  });
});

test('completed work uses recorded sessions and never invents a missing checkout', () => {
  const checkInTime = createAddisAbabaDateTime('2026-10-13', 8, 30);
  assert.equal(getCompletedWorkMinutes({ checkInTime, checkOutTime: null }, normalShift), null);
  assert.equal(getCompletedWorkMinutes({
    checkInTime,
    checkOutTime: createAddisAbabaDateTime('2026-10-13', 17, 15),
  }, normalShift), 525);

  const lunchShift = {
    ...normalShift,
    endMinute: 30,
    lunchEnabled: true,
    lunchStartMinute: 30,
    beforeLunchEndMinute: 30,
    afterLunchStartMinute: 30,
    afterLunchEndMinute: 30,
  };
  assert.equal(getCompletedWorkMinutes({
    checkInTime,
    checkOutTime: createAddisAbabaDateTime('2026-10-13', 17, 30),
  }, lunchShift), 480);
  assert.equal(getCompletedWorkMinutes({
    checkInTime,
    checkOutTime: createAddisAbabaDateTime('2026-10-13', 15, 30),
  }, lunchShift), 360);
  assert.equal(getCompletedWorkMinutes({
    checkInTime,
    checkOutTime: createAddisAbabaDateTime('2026-10-13', 12, 15),
  }, lunchShift), 225);
  assert.equal(getCompletedWorkMinutes({
    checkInTime,
    checkOutTime: createAddisAbabaDateTime('2026-10-13', 12, 0),
    afterLunchCheckIn: createAddisAbabaDateTime('2026-10-13', 13, 0),
    afterLunchCheckOut: createAddisAbabaDateTime('2026-10-13', 17, 15),
  }, lunchShift), 465);
});
