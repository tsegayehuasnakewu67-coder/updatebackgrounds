const ShiftSettings = require('../models/ShiftSettings');
const { validateShiftSettings } = require('../utils/shiftTime');
const { recordAuditEvent, auditWarning } = require('../utils/auditLog');
const { getShiftSettings } = require('../services/shiftSettingsService');

// GET /api/shift  — admin only
const getSettings = async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const settings = await getShiftSettings();
    return res.json({ success: true, data: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/shift  — admin only
const updateSettings = async (req, res) => {
  try {
    const {
      startHour, startMinute, gracePeriod, endHour, endMinute,
      lunchEnabled, lunchStartHour, lunchStartMinute, lunchDuration,
      beforeLunchStartHour, beforeLunchStartMinute, beforeLunchEndHour, beforeLunchEndMinute,
      afterLunchStartHour, afterLunchStartMinute, afterLunchEndHour, afterLunchEndMinute,
      timeZone, timeFormat, notifyCheckIn, notifyCheckOut,
    } = req.body || {};

    if (typeof lunchEnabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'lunchEnabled must be a boolean.' });
    }
    for (const [name, value] of [['notifyCheckIn', notifyCheckIn], ['notifyCheckOut', notifyCheckOut]]) {
      if (value !== undefined && typeof value !== 'boolean') {
        return res.status(400).json({ success: false, message: `${name} must be a boolean.` });
      }
    }
    if (typeof timeZone !== 'string' || !timeZone.trim()) {
      return res.status(400).json({ success: false, message: 'A valid IANA time zone is required.' });
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() });
    } catch {
      return res.status(400).json({ success: false, message: 'A valid IANA time zone is required.' });
    }
    if (!['24-hour', '12-hour'].includes(timeFormat)) {
      return res.status(400).json({ success: false, message: 'timeFormat must be 24-hour or 12-hour.' });
    }

    const num = (v, lo, hi) => v !== null && v !== undefined && v !== ''
      && Number.isInteger(+v) && +v >= lo && +v <= hi;
    if (!num(startHour,   0, 23))  return res.status(400).json({ success: false, message: 'startHour must be 0-23.' });
    if (!num(startMinute, 0, 59))  return res.status(400).json({ success: false, message: 'startMinute must be 0-59.' });
    if (!num(gracePeriod, 5, 20))  return res.status(400).json({ success: false, message: 'Grace period must be between 5 and 20 minutes.' });
    if (!num(endHour,     0, 23))  return res.status(400).json({ success: false, message: 'endHour must be 0-23.' });
    if (!num(endMinute,   0, 59))  return res.status(400).json({ success: false, message: 'endMinute must be 0-59.' });

    if (lunchEnabled) {
      if (!num(lunchStartHour,   0, 23))  return res.status(400).json({ success: false, message: 'lunchStartHour must be 0-23.' });
      if (!num(lunchStartMinute, 0, 59))  return res.status(400).json({ success: false, message: 'lunchStartMinute must be 0-59.' });
      if (!num(lunchDuration,    1, 180)) return res.status(400).json({ success: false, message: 'lunchDuration must be 1-180 minutes.' });
    }

    const windowFields = [
      ['beforeLunchStartHour', beforeLunchStartHour, 0, 23], ['beforeLunchStartMinute', beforeLunchStartMinute, 0, 59],
      ['beforeLunchEndHour', beforeLunchEndHour, 0, 23], ['beforeLunchEndMinute', beforeLunchEndMinute, 0, 59],
      ['afterLunchStartHour', afterLunchStartHour, 0, 23], ['afterLunchStartMinute', afterLunchStartMinute, 0, 59],
      ['afterLunchEndHour', afterLunchEndHour, 0, 23], ['afterLunchEndMinute', afterLunchEndMinute, 0, 59],
    ];
    for (const [name, value, lo, hi] of windowFields) {
      if (!num(value, lo, hi)) return res.status(400).json({ success: false, message: `${name} is out of range.` });
    }

    const validationError = validateShiftSettings({
      startHour: +startHour,
      startMinute: +startMinute,
      endHour: +endHour,
      endMinute: +endMinute,
      lunchEnabled: !!lunchEnabled,
      lunchStartHour: lunchEnabled ? +lunchStartHour : 12,
      lunchStartMinute: lunchEnabled ? +lunchStartMinute : 0,
      lunchDuration: lunchEnabled ? +lunchDuration : 0,
      beforeLunchStartHour: +beforeLunchStartHour,
      beforeLunchStartMinute: +beforeLunchStartMinute,
      beforeLunchEndHour: +beforeLunchEndHour,
      beforeLunchEndMinute: +beforeLunchEndMinute,
      afterLunchStartHour: +afterLunchStartHour,
      afterLunchStartMinute: +afterLunchStartMinute,
      afterLunchEndHour: +afterLunchEndHour,
      afterLunchEndMinute: +afterLunchEndMinute,
      timeZone: timeZone.trim(),
      timeFormat,
    });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const previousSettingsQuery = ShiftSettings.findOne({ _key: 'default' });
    const previousSettings = typeof previousSettingsQuery.lean === 'function'
      ? await previousSettingsQuery.lean()
      : await previousSettingsQuery;
    const settings = await ShiftSettings.findOneAndUpdate(
      { _key: 'default' },
      {
        startHour: +startHour, startMinute: +startMinute,
        gracePeriod: +gracePeriod,
        endHour: +endHour, endMinute: +endMinute,
        lunchEnabled:     !!lunchEnabled,
        lunchStartHour:   lunchEnabled ? +lunchStartHour   : 12,
        lunchStartMinute: lunchEnabled ? +lunchStartMinute : 0,
        lunchDuration:    lunchEnabled ? +lunchDuration     : 60,
        beforeLunchStartHour: +beforeLunchStartHour,
        beforeLunchStartMinute: +beforeLunchStartMinute,
        beforeLunchEndHour: +beforeLunchEndHour,
        beforeLunchEndMinute: +beforeLunchEndMinute,
        afterLunchStartHour: +afterLunchStartHour,
        afterLunchStartMinute: +afterLunchStartMinute,
        afterLunchEndHour: +afterLunchEndHour,
        afterLunchEndMinute: +afterLunchEndMinute,
        timeZone: timeZone.trim(),
        timeFormat,
        notifyCheckIn: notifyCheckIn !== false,
        notifyCheckOut: notifyCheckOut !== false,
      },
      { upsert: true, new: true, runValidators: true }
    );

    const storedSettings = settings.toObject ? settings.toObject() : settings;
    const afterSettings = Object.fromEntries(
      Object.entries(storedSettings).filter(([field]) => !['_id', '_key', '__v', 'createdAt', 'updatedAt'].includes(field)),
    );
    const beforeSettings = Object.fromEntries(
      Object.entries(previousSettings || {}).filter(([field]) => !['_id', '_key', '__v', 'createdAt', 'updatedAt'].includes(field)),
    );
    const changedFields = Object.keys(afterSettings).filter(field => beforeSettings[field] !== afterSettings[field]);
    const auditRecorded = await recordAuditEvent(req, {
      action: 'SHIFT_SETTINGS_UPDATED',
      resourceType: 'shift_settings',
      resourceId: settings._id,
      summary: 'Updated organization shift and attendance settings.',
      details: {
        changedFields,
        before: beforeSettings,
        after: afterSettings,
      },
    });
    return res.json({ success: true, message: 'Shift settings updated.', data: settings, ...auditWarning(auditRecorded) });
  } catch (err) {
    console.error('Unable to update shift settings.', { errorName: err.name, errorCode: err.code });
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSettings, updateSettings };
