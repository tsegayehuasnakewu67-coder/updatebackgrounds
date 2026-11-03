const MINUTES_PER_DAY = 24 * 60;

export const toMinutes = (hour, minute) => Number(hour) * 60 + Number(minute);

export const getShiftDurationMinutes = (startHour, startMinute, endHour, endMinute) => {
  const start = toMinutes(startHour, startMinute);
  const end = toMinutes(endHour, endMinute);
  return end > start ? end - start : end + MINUTES_PER_DAY - start;
};

export const getShiftPreview = (shift) => {
  const grossMinutes = getShiftDurationMinutes(
    shift.startHour,
    shift.startMinute,
    shift.endHour,
    shift.endMinute,
  );
  const lunchMinutes = shift.lunchEnabled ? Number(shift.lunchDuration) : 0;
  const deadlineTotal = toMinutes(shift.startHour, shift.startMinute) + Number(shift.gracePeriod);
  const deadlineMinute = deadlineTotal % MINUTES_PER_DAY;

  return {
    grossMinutes,
    netMinutes: Math.max(0, grossMinutes - lunchMinutes),
    deadlineHour: Math.floor(deadlineMinute / 60),
    deadlineMinute: deadlineMinute % 60,
  };
};

export const validateShiftForm = (shift) => {
  if (typeof shift.timeZone !== 'string' || !shift.timeZone.trim()) {
    return 'A valid IANA time zone is required.';
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: shift.timeZone.trim() });
  } catch {
    return 'A valid IANA time zone is required.';
  }
  if (!['24-hour', '12-hour'].includes(shift.timeFormat)) {
    return 'Choose a valid time display format.';
  }

  const fields = [
    ['startHour', 0, 23],
    ['startMinute', 0, 59],
    ['gracePeriod', 5, 20],
    ['endHour', 0, 23],
    ['endMinute', 0, 59],
    ['lunchStartHour', 0, 23],
    ['lunchStartMinute', 0, 59],
    ['lunchDuration', shift.lunchEnabled ? 1 : 0, 180],
    ['beforeLunchStartHour', 0, 23],
    ['beforeLunchStartMinute', 0, 59],
    ['beforeLunchEndHour', 0, 23],
    ['beforeLunchEndMinute', 0, 59],
    ['afterLunchStartHour', 0, 23],
    ['afterLunchStartMinute', 0, 59],
    ['afterLunchEndHour', 0, 23],
    ['afterLunchEndMinute', 0, 59],
  ];

  for (const [field, min, max] of fields) {
    if (
      shift[field] === ''
      || shift[field] === null
      || shift[field] === undefined
      || !Number.isInteger(Number(shift[field]))
      || Number(shift[field]) < min
      || Number(shift[field]) > max
    ) {
      return `${field} must be an integer between ${min} and ${max}.`;
    }
  }

  const start = toMinutes(shift.startHour, shift.startMinute);
  const end = toMinutes(shift.endHour, shift.endMinute);
  if (start >= end) {
    return 'Official shift start must be earlier than the shift end.';
  }

  const beforeStart = toMinutes(shift.beforeLunchStartHour, shift.beforeLunchStartMinute);
  const beforeEnd = toMinutes(shift.beforeLunchEndHour, shift.beforeLunchEndMinute);
  const afterStart = toMinutes(shift.afterLunchStartHour, shift.afterLunchStartMinute);
  const afterEnd = toMinutes(shift.afterLunchEndHour, shift.afterLunchEndMinute);

  if (beforeStart < start || beforeStart >= beforeEnd || beforeEnd > end) {
    return 'The before-lunch window must be ordered and fall within the official shift.';
  }
  if (afterStart < start || afterStart >= afterEnd) {
    return 'The after-lunch window must be ordered and end within the shift.';
  }
  if (afterEnd > end) {
    const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return `Afternoon window ends at ${formatTime(afterEnd)}, after the official shift end at ${formatTime(end)}.`;
  }
  if (beforeEnd > afterStart) {
    return 'The before-lunch window must end before the after-lunch window starts.';
  }

  if (shift.lunchEnabled) {
    const lunchStart = toMinutes(shift.lunchStartHour, shift.lunchStartMinute);
    const lunchEnd = lunchStart + Number(shift.lunchDuration);
    if (lunchStart < beforeEnd || lunchEnd > afterStart || lunchStart < start || lunchEnd > end) {
      return 'Lunch must fit between the attendance windows and within the official shift.';
    }
  }

  return '';
};
