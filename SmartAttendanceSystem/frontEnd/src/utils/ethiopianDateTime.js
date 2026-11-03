export const ETHIOPIAN_TIME_ZONE = 'Africa/Addis_Ababa';
let attendanceTimeZone = ETHIOPIAN_TIME_ZONE;
let attendanceTimeFormat = '24-hour';

export const setAttendanceTimePreferences = ({ timeZone, timeFormat } = {}) => {
  if (timeZone) attendanceTimeZone = timeZone;
  if (timeFormat === '12-hour' || timeFormat === '24-hour') attendanceTimeFormat = timeFormat;
};

const DATE_LOCALE = 'en-GB';

const asDate = value => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00Z`);
  }
  return value instanceof Date ? value : new Date(value);
};

export const formatEthiopianDate = (value, options = {}) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: attendanceTimeZone,
    calendar: 'ethiopic',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(asDate(value));
};

export const formatEthiopianTime = (value, { seconds = false } = {}) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: attendanceTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hourCycle: attendanceTimeFormat === '12-hour' ? 'h12' : 'h23',
  }).format(asDate(value));
};

export const formatEthiopianDateTime = value => {
  if (!value) return '—';
  return `${formatEthiopianDate(value, { year: 'numeric', month: 'short', day: 'numeric' })} ${formatEthiopianTime(value)}`;
};

export const getAddisAbabaDateString = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: attendanceTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const getAddisAbabaDateParts = (date = new Date()) => {
  const [year, month, day] = getAddisAbabaDateString(date).split('-').map(Number);
  return { year, month, day };
};
