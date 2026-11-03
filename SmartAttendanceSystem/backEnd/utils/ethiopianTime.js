const TIME_ZONE = 'Africa/Addis_Ababa';

const getDateParts = (date = new Date(), timeZone = TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const getTimeParts = (date = new Date(), timeZone = TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const getAddisAbabaDateString = (date = new Date(), timeZone = TIME_ZONE) => {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
};

const getAddisAbabaMinutes = (date = new Date(), timeZone = TIME_ZONE) => {
  const { hour, minute } = getTimeParts(date, timeZone);
  const { second } = getTimeParts(date, timeZone);
  return Number(hour) * 60 + Number(minute) + Number(second) / 60;
};

const createAddisAbabaDateTime = (date, hour, minute, timeZone = TIME_ZONE) => {
  const [year, month, day] = date.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let result = desired;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(result)).map(({ type, value }) => [type, value]));
    const observed = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    result += desired - observed;
  }

  return new Date(result);
};

module.exports = {
  TIME_ZONE,
  getAddisAbabaDateString,
  getAddisAbabaMinutes,
  createAddisAbabaDateTime,
};
