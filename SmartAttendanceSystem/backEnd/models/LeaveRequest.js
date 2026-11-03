const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['annual', 'sick', 'personal', 'other'], default: 'annual' },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: '', trim: true, maxlength: 500 },
}, { timestamps: true });

leaveRequestSchema.index({ employee: 1, createdAt: -1 });
module.exports = mongoose.model('LeaveRequest', leaveRequestSchema, 'leaveRequests');
