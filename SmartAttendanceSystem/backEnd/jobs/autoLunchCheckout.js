/**
 * autoLunchCheckout.js
 *
 * Scheduled job — fires every minute and checks whether the lunch start time
 * configured in ShiftSettings has been reached. When it has, it bulk check-outs
 * every employee who:
 *   • has a check-in record for today
 *   • has NOT yet been checked out (checkOutTime is null)
 *   • has NOT already returned from lunch (afterLunchCheckIn is null)
 *
 * This implements the "Auto Lunch Check-out" feature:
 *   Admin sets lunchStartHour / lunchStartMinute in Shift Settings.
 *   At that exact minute the system silently records checkOutTime = lunchStart
 *   for all applicable employees — no manual action needed at the kiosk.
 */

const cron        = require('node-cron');
const Attendance  = require('../models/Attendance');
const { getShiftSettings } = require('../services/shiftSettingsService');
const {
  getAddisAbabaMinutes,
  createAddisAbabaDateTime,
} = require('../utils/ethiopianTime');
const { getAttendanceDate } = require('../utils/shiftTime');

const pad2     = (n) => String(n).padStart(2, '0');

/**
 * Perform the actual bulk check-out.
 * Called by the cron task AND exposed for manual/test invocation.
 */
const runAutoLunchCheckout = async () => {
  try {
    const shift = await getShiftSettings();
    if (!shift.lunchEnabled) return; // feature disabled

    const now     = new Date();
    const today   = getAttendanceDate(now, shift);
    const nowMins = getAddisAbabaMinutes(now, shift.timeZone);
    const lunchMins = shift.lunchStartHour * 60 + shift.lunchStartMinute;

    // Only fire within the exact minute window
    if (nowMins !== lunchMins) return;

    // Construct the official lunch-start timestamp for today
    const lunchTime = createAddisAbabaDateTime(today, shift.lunchStartHour, shift.lunchStartMinute, shift.timeZone);

    const result = await Attendance.updateMany(
      {
        date:              today,
        checkOutTime:      null,   // not yet checked out
        afterLunchCheckIn: null,   // hasn't already returned from lunch
      },
      { $set: { checkOutTime: lunchTime } }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[AutoLunchCheckout] ${new Date().toISOString()} — ` +
        `Auto checked-out ${result.modifiedCount} employee(s) at lunch time ` +
        `(${pad2(shift.lunchStartHour)}:${pad2(shift.lunchStartMinute)}).`
      );
    }
  } catch (err) {
    console.error('[AutoLunchCheckout] Error during auto lunch check-out:', err.message);
  }
};

/**
 * Register the cron schedule.
 * Runs every minute — the handler itself only acts on the correct minute.
 * This avoids complex dynamic cron-string rebuilds when settings change.
 */
const scheduleAutoLunchCheckout = () => {
  cron.schedule('* * * * *', runAutoLunchCheckout);
  console.log('[AutoLunchCheckout] Scheduled (checks every minute, fires at configured lunch time).');
};

module.exports = { scheduleAutoLunchCheckout, runAutoLunchCheckout };
