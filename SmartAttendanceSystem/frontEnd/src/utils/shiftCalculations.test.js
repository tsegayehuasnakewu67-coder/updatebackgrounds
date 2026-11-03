import test from 'node:test';
import assert from 'node:assert/strict';
import { getShiftPreview, validateShiftForm } from './shiftCalculations.js';
import { formatEthiopianDate, getAddisAbabaDateString } from './ethiopianDateTime.js';

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
  timeZone: 'Africa/Addis_Ababa',
  timeFormat: '24-hour',
};

test('preview reports positive same-day and overnight durations and wraps the deadline', () => {
  assert.deepEqual(getShiftPreview(normalShift), {
    grossMinutes: 510,
    netMinutes: 510,
    deadlineHour: 8,
    deadlineMinute: 35,
  });
  const overnight = getShiftPreview({
    ...normalShift,
    startHour: 22,
    startMinute: 0,
    endHour: 6,
    endMinute: 0,
    gracePeriod: 5,
    lunchEnabled: true,
    lunchDuration: 60,
  });
  assert.equal(overnight.grossMinutes, 480);
  assert.equal(overnight.netMinutes, 420);
  assert.equal(overnight.deadlineHour, 22);
  assert.equal(overnight.deadlineMinute, 5);
  assert.ok(overnight.grossMinutes >= 0 && overnight.netMinutes >= 0);
});

test('11:19 start with five-minute grace previews an 11:24 deadline', () => {
  const preview = getShiftPreview({
    ...normalShift,
    startHour: 11,
    startMinute: 19,
    gracePeriod: 5,
  });
  assert.equal(`${preview.deadlineHour}:${String(preview.deadlineMinute).padStart(2, '0')}`, '11:24');
});

test('settings validation accepts configured windows and rejects invalid lunch ordering', () => {
  assert.equal(validateShiftForm(normalShift), '');
  assert.notEqual(validateShiftForm({
    ...normalShift,
    lunchEnabled: true,
    lunchStartHour: 11,
    lunchDuration: 120,
  }), '');
});

test('requested A-E schedules validate consistently in total minutes', () => {
  const valid = {
    ...normalShift,
    endMinute: 30,
    lunchEnabled: true,
    lunchStartMinute: 30,
    beforeLunchEndMinute: 30,
    afterLunchStartMinute: 30,
    afterLunchEndMinute: 30,
  };
  assert.equal(validateShiftForm(valid), '');
  assert.equal(validateShiftForm({ ...valid, afterLunchEndMinute: 30 }), '');
  assert.notEqual(validateShiftForm({
    ...valid,
    afterLunchStartHour: 17,
    afterLunchStartMinute: 0,
    afterLunchEndHour: 16,
    afterLunchEndMinute: 30,
  }), '');
  assert.notEqual(validateShiftForm({ ...valid, afterLunchEndHour: 18, afterLunchEndMinute: 0 }), '');
  assert.equal(validateShiftForm({ ...valid, endHour: 12 }), 'Afternoon window ends at 17:30, after the official shift end at 12:30.');
  assert.notEqual(validateShiftForm({ ...valid, beforeLunchEndHour: 14, beforeLunchEndMinute: 0 }), '');
});

test('date display uses Ethiopian calendar while date keys remain Gregorian', () => {
  assert.equal(getAddisAbabaDateString(new Date('2026-10-13T09:00:00.000Z')), '2026-10-13');
  assert.match(formatEthiopianDate('2026-10-13'), /2019/);
});
