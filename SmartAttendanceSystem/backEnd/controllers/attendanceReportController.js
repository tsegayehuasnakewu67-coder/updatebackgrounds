const Attendance = require('../models/Attendance');
const { getAttendanceDate } = require('../utils/shiftTime');
const { getShiftSettings } = require('../services/shiftSettingsService');

const isDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const reportQuery = (req, res) => {
  const { from, to, department, status, employeeId } = req.query;
  if (!isDateKey(from) || !isDateKey(to)) {
    res.status(400).json({ success: false, message: 'from and to must be valid Gregorian YYYY-MM-DD dates.' });
    return null;
  }
  if (from > to) {
    res.status(400).json({ success: false, message: 'from must be on or before to.' });
    return null;
  }
  const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (rangeDays > 366) {
    res.status(400).json({ success: false, message: 'Attendance reports are limited to a 367-day inclusive date range.' });
    return null;
  }

  const query = { date: { $gte: from, $lte: to } };
  if (status) query.status = status;
  if (department) query.department = new RegExp(String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (employeeId) query.employeeId = new RegExp(String(employeeId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return query;
};

const getTodayAttendance = async (req, res, next) => {
  try {
    const now = new Date();
    const shift = await getShiftSettings();
    const date = getAttendanceDate(now, shift);
    const records = await Attendance.find({ date })
      .sort({ checkInTime: 1, employeeId: 1 })
      .populate('employee', 'employeeId firstName lastName department position')
      .lean();
    return res.json({ success: true, data: { date, records, total: records.length } });
  } catch (error) {
    return next(error);
  }
};

const getAttendanceReport = async (req, res, next) => {
  const query = reportQuery(req, res);
  if (!query) return;
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 50;
  try {
    const [records, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1, checkInTime: -1, employeeId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('employee', 'employeeId firstName lastName department position')
        .lean(),
      Attendance.countDocuments(query),
    ]);
    return res.json({
      success: true,
      data: {
        records,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    return next(error);
  }
};

const csvCell = (value) => {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const formatReportTime = (value, shift) => {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: shift.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: shift.timeFormat === '12-hour' ? 'h12' : 'h23',
  }).formatToParts(value).map(({ type, value: part }) => [type, part]));
  const dayPeriod = shift.timeFormat === '12-hour' ? ` ${parts.dayPeriod}` : '';
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}${dayPeriod}`;
};

const exportAttendanceReport = async (req, res, next) => {
  const query = reportQuery(req, res);
  if (!query) return;
  const { from, to } = req.query;
  try {
    const shift = await getShiftSettings();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${from}-to-${to}.csv"`);
    res.write('\uFEFFemployeeId,fullName,department,date,status,checkInTime,checkOutTime,confidence,method,ipAddress,deviceInfo\r\n');
    const cursor = Attendance.find(query)
      .select('employeeId fullName department date status checkInTime checkOutTime confidence recognitionMethod ipAddress deviceInfo')
      .sort({ date: -1, checkInTime: -1, employeeId: 1 })
      .lean()
      .cursor();
    for await (const record of cursor) {
      if (res.destroyed) return;
      const values = [
        record.employeeId,
        record.fullName,
        record.department,
        record.date,
        record.status,
        formatReportTime(record.checkInTime, shift),
        formatReportTime(record.checkOutTime, shift),
        record.confidence,
        record.recognitionMethod,
        record.ipAddress,
        record.deviceInfo,
      ];
      if (!res.write(`${values.map(csvCell).join(',')}\r\n`)) {
        await new Promise((resolve) => {
          const resume = () => {
            res.off('drain', resume);
            res.off('close', resume);
            resolve();
          };
          res.once('drain', resume);
          res.once('close', resume);
        });
      }
      if (res.destroyed) return;
    }
    return res.end();
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    return next(error);
  }
};

module.exports = { getTodayAttendance, getAttendanceReport, exportAttendanceReport };
