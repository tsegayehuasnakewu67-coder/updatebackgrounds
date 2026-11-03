const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['message', 'warning', 'contact_message', 'contact_reply'], default: 'message' },
  title: { type: String, trim: true, maxlength: 160, default: '' },
  subject: { type: String, required: true, trim: true, maxlength: 140 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  relatedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactMessage', default: null },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
