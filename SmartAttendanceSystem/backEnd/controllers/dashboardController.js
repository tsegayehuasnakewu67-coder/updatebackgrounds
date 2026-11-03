const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { getAttendanceDate } = require('../utils/shiftTime');
const { getShiftSettings } = require('../services/shiftSettingsService');

const getStats = async (_req, res) => {
  try {
    const now = new Date();
    const shift = await getShiftSettings();
    const today = getAttendanceDate(now, shift);
    
    const [
      totalEmployees,
      presentToday,
      lateToday,
      leaveToday,
      totalAttendanceRecords,
    ] = await Promise.all([
      User.countDocuments({ 
        isActive: true, 
        role: { $ne: 'admin' } 
      }),
      Attendance.countDocuments({ date: today, status: 'Present' }),
      Attendance.countDocuments({ date: today, status: 'Late' }),
      Attendance.countDocuments({ date: today, status: 'Leave' }),
      Attendance.countDocuments(),
    ]);
    
    const absentToday = Math.max(
      0, 
      totalEmployees - presentToday - lateToday - leaveToday
    );
    
    const attendancePercentage = totalEmployees
      ? Math.round(((presentToday + lateToday + leaveToday) / totalEmployees) * 10000) / 100
      : 0;
    
    return res.json({
      success: true,
      data: {
        totalEmployees,
        presentToday,
        absentToday,
        lateToday,
        totalAttendanceRecords,
        attendancePercentage,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Unable to retrieve dashboard statistics.' 
    });
  }
};

module.exports = { getStats };