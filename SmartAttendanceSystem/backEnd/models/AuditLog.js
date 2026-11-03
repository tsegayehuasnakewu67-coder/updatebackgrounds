const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  actorRole: { type: String, enum: ['admin', 'hr', 'employee', 'system'], default: 'system', index: true },
  action: { type: String, required: true, trim: true, maxlength: 80, index: true },
  resourceType: {
    type: String,
    enum: ['user', 'attendance', 'leave', 'shift_settings', 'system'],
    required: true,
    index: true,
  },
  resourceId: { type: String, trim: true, maxlength: 100, default: '' },
  summary: { type: String, required: true, trim: true, maxlength: 300 },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, trim: true, maxlength: 64, default: '' },
  userAgent: { type: String, trim: true, maxlength: 300, default: '' },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
