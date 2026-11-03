const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  systemName: { type: String, default: 'Smart Attendance System', trim: true },
  workingStartTime: { type: String, default: '08:30' },
  workingEndTime: { type: String, default: '17:00' },
  lateThreshold: { type: Number, default: 5, min: 0 },
  attendanceEnabled: { type: Boolean, default: true },
  faceRecognitionEnabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
