const {
  getAddisAbabaDateString,
  getAddisAbabaMinutes,
  createAddisAbabaDateTime,
} = require('./ethiopianTime');

const MINUTES_PER_DAY = 24 * 60;

const toMinutes = (hour, minute) => Number(hour) * 60 + Number(minute);

const getShiftBounds = (shift) => {
  const start = toMinutes(shift.startHour, shift.startMinute);
  const end = toMinutes(shift.endHour, shift.endMinute);
  const overnight = end < start;
  const endOffset = end + (overnight ? MINUTES_PER_DAY : 0);
  return { start, end, endOffset, duration: endOffset - start, overnight };
};

const getSessionEndMinutes = (shift) => toMinutes(
  shift.afterLunchEndHour ?? shift.endHour,
  shift.afterLunchEndMinute ?? shift.endMinute,
);

const getShiftElapsedMinutes = (date, shift) => {
  const bounds = getShiftBounds(shift);
  const clockMinutes = getAddisAbabaMinutes(date, shift.timeZone);
  const sessionEnd = getSessionEndMinutes(shift);
  const overnight = sessionEnd < bounds.start;
  const sessionDuration = sessionEnd + (overnight ? MINUTES_PER_DAY : 0) - bounds.start;
  if (!overnight || clockMinutes >= bounds.start) return clockMinutes - bounds.start;
  if (clockMinutes < sessionEnd) return clockMinutes + MINUTES_PER_DAY - bounds.start;

  const beforeStartWindow = bounds.start - 60;
  if (clockMinutes >= beforeStartWindow && beforeStartWindow >= sessionEnd) {
    return clockMinutes - bounds.start;
  }
  return sessionDuration + clockMinutes - sessionEnd;
};

const getShiftOffset = (hour, minute, shift) => {
  const { start, overnight } = getShiftBounds(shift);
  const clockMinutes = toMinutes(hour, minute);
  return clockMinutes < start && overnight
    ? clockMinutes + MINUTES_PER_DAY - start
    : clockMinutes - start;
};

const getSignedShiftOffset = (hour, minute, shift) => {
  const { start, overnight } = getShiftBounds(shift);
  let offset = toMinutes(hour, minute) - start;
  if (overnight && offset < -MINUTES_PER_DAY / 2) offset += MINUTES_PER_DAY;
  else if (overnight && offset > MINUTES_PER_DAY / 2) offset -= MINUTES_PER_DAY;
  return offset;
};

const getAttendanceDate = (date, shift) => {
  const today = getAddisAbabaDateString(date, shift.timeZone);
  const bounds = getShiftBounds(shift);
  const sessionEnd = getSessionEndMinutes(shift);
  if (sessionEnd >= bounds.start || getAddisAbabaMinutes(date) >= sessionEnd) return today;

  const previousDay = new Date(`${today}T00:00:00.000Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  return previousDay.toISOString().slice(0, 10);
};

const getGrossDurationMinutes = (shift) => getShiftBounds(shift).duration;

const getNetDurationMinutes = (shift) => Math.max(
  0,
  getGrossDurationMinutes(shift) - (shift.lunchEnabled ? Number(shift.lunchDuration) : 0),
);

const getCompletedWorkMinutes = (record, shift) => {
  const minutesBetween = (start, end) => {
    if (!start || !end) return 0;
    return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  };

  const hasMorningSession = record.checkInTime && record.checkOutTime;
  const hasAfternoonSession = record.afterLunchCheckIn && record.afterLunchCheckOut;
  if (hasAfternoonSession) {
    return minutesBetween(record.checkInTime, record.checkOutTime)
      + minutesBetween(record.afterLunchCheckIn, record.afterLunchCheckOut);
  }
  if (!hasMorningSession) return null;

  const workedMinutes = minutesBetween(record.checkInTime, record.checkOutTime);
  if (!shift.lunchEnabled) return workedMinutes;

  const attendanceDate = getAttendanceDate(record.checkInTime, shift);
  const lunchOffset = getShiftOffset(shift.lunchStartHour, shift.lunchStartMinute, shift);
  const lunchClockMinutes = toMinutes(shift.startHour, shift.startMinute) + lunchOffset;
  const lunchStart = createAddisAbabaDateTime(
    attendanceDate,
    Math.floor(lunchClockMinutes / 60),
    lunchClockMinutes % 60,
    shift.timeZone,
  ).getTime();
  const lunchEnd = lunchStart + Number(shift.lunchDuration) * 60_000;
  const checkIn = new Date(record.checkInTime).getTime();
  const checkOut = new Date(record.checkOutTime).getTime();
  const lunchOverlap = Math.max(0, Math.min(checkOut, lunchEnd) - Math.max(checkIn, lunchStart));
  return Math.max(0, workedMinutes - Math.ceil(lunchOverlap / 60_000));
};

const calculateAttendanceStatus = (date, shift) => {
  const elapsed = getShiftElapsedMinutes(date, shift);
  const lateMinutes = Math.max(
    0,
    elapsed > Number(shift.gracePeriod || 0)
      ? Math.max(1, Math.floor(elapsed) - Number(shift.gracePeriod || 0))
      : 0,
  );
  return lateMinutes === 0
    ? { status: 'Present', lateMinutes: 0 }
    : { status: 'Late', lateMinutes };
};

const validateShiftSettings = (shift) => {
  const bounds = getShiftBounds(shift);
  if (bounds.start >= bounds.end) {
    return 'Official shift start must be earlier than the shift end.';
  }

  const beforeStart = toMinutes(shift.beforeLunchStartHour, shift.beforeLunchStartMinute);
  const beforeEnd = toMinutes(shift.beforeLunchEndHour, shift.beforeLunchEndMinute);
  const afterStart = toMinutes(shift.afterLunchStartHour, shift.afterLunchStartMinute);
  const afterEnd = toMinutes(shift.afterLunchEndHour, shift.afterLunchEndMinute);

  if (beforeStart < bounds.start || beforeStart >= beforeEnd || beforeEnd > bounds.end) {
    return 'The before-lunch window must be ordered and fall within the official shift.';
  }
  if (afterStart < bounds.start || afterStart >= afterEnd) {
    return 'The after-lunch window must be ordered and end within the shift.';
  }
  if (afterEnd > bounds.end) {
    const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return `Afternoon window ends at ${formatTime(afterEnd)}, after the official shift end at ${formatTime(bounds.end)}.`;
  }
  if (beforeEnd > afterStart) {
    return 'The before-lunch window must end before the after-lunch window starts.';
  }

  if (shift.lunchEnabled) {
    if (!Number.isInteger(Number(shift.lunchDuration)) || Number(shift.lunchDuration) < 1) {
      return 'Lunch duration must be between 1 and 180 minutes when lunch is enabled.';
    }
    const lunchStart = toMinutes(shift.lunchStartHour, shift.lunchStartMinute);
    const lunchEnd = lunchStart + Number(shift.lunchDuration);
    if (
      lunchStart < beforeEnd
      || lunchEnd > afterStart
      || lunchStart < bounds.start
      || lunchEnd > bounds.end
    ) {
      return 'Lunch must fit between the attendance windows and within the official shift.';
    }
  }

  return null;
};

module.exports = {
  getShiftBounds,
  getSessionEndMinutes,
  getShiftElapsedMinutes,
  getShiftOffset,
  getSignedShiftOffset,
  getAttendanceDate,
  getGrossDurationMinutes,
  getNetDurationMinutes,
  getCompletedWorkMinutes,
  calculateAttendanceStatus,
  validateShiftSettings,
};
