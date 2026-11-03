const mongoose = require('mongoose');
const crypto = require('crypto');

const replySchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true, maxlength: 10000 },
  senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderRole: { type: String, enum: ['admin', 'employee'], default: 'admin' },
  senderName: { type: String, trim: true, maxlength: 120, default: '' },
  createdAt: { type: Date, default: Date.now },
  // Kept so replies written by the previous inbox implementation still render.
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminName: { type: String, trim: true, default: '' },
}, { _id: true });

const contactMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    unique: true,
    default: () => `SAT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
  },
  ticketId: {
    type: String,
    unique: true,
    sparse: true,
    default() {
      return this.messageId || `SAT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    },
  },
  submissionKey: { type: String, trim: true, maxlength: 64 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  message: { type: String, required: true, trim: true, minlength: 5, maxlength: 10000 },
  status: { type: String, enum: ['pending', 'in_progress', 'replied', 'closed', 'resolved'], default: 'pending', index: true },
  isRead: { type: Boolean, default: false, index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  replies: { type: [replySchema], default: [] },
  lastRepliedAt: { type: Date, default: null },
  emailDeliveryStatus: {
    type: String,
    enum: ['not_required', 'not_configured', 'pending', 'sent', 'failed'],
    default: 'not_required',
  },
}, { timestamps: true });

contactMessageSchema.pre('validate', function setTicketId() {
  if (!this.ticketId) this.ticketId = this.messageId || `SAT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  if (!this.messageId) this.messageId = this.ticketId;
});

contactMessageSchema.path('replies').validate(
  replies => replies.length <= 500,
  'A contact ticket cannot contain more than 500 replies.',
);
contactMessageSchema.index({ submittedAt: -1 });
contactMessageSchema.index({ status: 1, isRead: 1, submittedAt: -1 });
contactMessageSchema.index({ userId: 1, submittedAt: -1 });
contactMessageSchema.index(
  { submissionKey: 1 },
  { unique: true, partialFilterExpression: { submissionKey: { $type: 'string' } } },
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);