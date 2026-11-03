const mongoose = require('mongoose');
const ContactMessage = require('../models/ContactMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('../services/emailService');

const cleanField = value => String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
const cleanMessage = value => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  .trim();

const normalizedStatus = status => (status === 'resolved' ? 'closed' : status);

const serializeMessage = message => ({
  _id: message._id,
  ticketId: message.ticketId || message.messageId,
  messageId: message.messageId || message.ticketId,
  userId: message.userId || null,
  fullName: message.fullName,
  email: message.email,
  subject: message.subject,
  message: message.message,
  status: normalizedStatus(message.status),
  isRead: message.isRead,
  submittedAt: message.submittedAt || message.createdAt,
  createdAt: message.createdAt || message.submittedAt,
  updatedAt: message.updatedAt,
  lastRepliedAt: message.lastRepliedAt || null,
  emailDeliveryStatus: message.emailDeliveryStatus || 'not_required',
  replies: [...(message.replies || [])]
    .sort((first, second) => new Date(first.createdAt || 0) - new Date(second.createdAt || 0))
    .map(reply => {
      const senderRole = reply.senderRole || (reply.admin || reply.adminName ? 'admin' : 'employee');
      return {
        _id: reply._id,
        senderUserId: reply.senderUserId || reply.admin || null,
        senderRole,
        senderName: reply.senderName || reply.adminName || (senderRole === 'admin' ? 'Admin' : 'Employee'),
        message: reply.message,
        createdAt: reply.createdAt,
      };
    }),
});

const validContactFields = ({ fullName, email, subject, message }) => (
  fullName.length >= 2
  && fullName.length <= 120
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  && email.length <= 254
  && subject.length >= 2
  && subject.length <= 160
  && message.length >= 5
  && message.length <= 10000
);

const submitContactMessage = async (req, res) => {
  let submissionKey;
  try {
    const authenticatedUser = req.user || null;
    const fullName = cleanField(authenticatedUser?.fullName || req.body?.fullName);
    const email = cleanField(authenticatedUser?.email || req.body?.email).toLowerCase();
    const subject = cleanField(req.body?.subject);
    const message = cleanMessage(req.body?.message);
    submissionKey = typeof req.body?.submissionId === 'string' ? req.body.submissionId : undefined;

    if (!validContactFields({ fullName, email, subject, message })) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid name, email, subject, and message within the allowed lengths.',
      });
    }

    if (submissionKey) {
      const existing = await ContactMessage.findOne({ submissionKey });
      if (existing) {
        const ticketId = existing.ticketId || existing.messageId;
        return res.status(200).json({
          success: true,
          message: 'This message was already received.',
          data: { ticketId, messageId: ticketId, duplicate: true },
        });
      }
    }

    const created = await ContactMessage.create({
      userId: authenticatedUser?._id || null,
      fullName,
      email,
      subject,
      message,
      submissionKey,
    });
    const ticketId = created.ticketId || created.messageId;
    let notificationError = '';
    try {
      const administrators = await User.find({ role: 'admin', isActive: true }).select('_id');
      if (administrators.length === 0) {
        notificationError = 'No active administrator was available to notify.';
        console.error('Contact message saved without an Admin notification: no active administrators found.');
      } else {
        await Notification.insertMany(administrators.map(admin => ({
          recipient: admin._id,
          recipientUserId: admin._id,
          sender: null,
          type: 'contact_message',
          title: `New contact message: ${subject}`.slice(0, 160),
          subject: `New contact: ${subject}`.slice(0, 140),
          message: `${fullName} submitted ticket ${ticketId}.`,
          relatedMessageId: created._id,
          isRead: false,
          readAt: null,
        })));
      }
    } catch (error) {
      notificationError = 'The message was saved, but the Admin notification could not be created.';
      console.error('Contact message saved, but Admin notification creation failed.', {
        name: error.name,
        code: error.code,
      });
    }
    return res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully.',
      data: { ticketId, messageId: ticketId, notificationError },
    });
  } catch (error) {
    if (error.code === 11000 && submissionKey) {
      try {
        const existing = await ContactMessage.findOne({ submissionKey });
        if (existing) {
          const ticketId = existing.ticketId || existing.messageId;
          return res.status(200).json({
            success: true,
            message: 'This message was already received.',
            data: { ticketId, messageId: ticketId, duplicate: true },
          });
        }
      } catch (lookupError) {
        console.error('Contact submission idempotency lookup failed:', lookupError.name);
      }
    }
    console.error('Contact message persistence failed:', error.name);
    return res.status(500).json({ success: false, message: 'We could not send your message. Please try again later.' });
  }
};

const listContactMessages = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const query = {};
    if (req.query.status === 'closed') query.status = { $in: ['closed', 'resolved'] };
    else if (['pending', 'in_progress', 'replied'].includes(req.query.status)) query.status = req.query.status;
    if (req.query.read === 'true') query.isRead = true;
    if (req.query.read === 'false') query.isRead = false;

    const search = cleanField(req.query.search).slice(0, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { fullName: regex },
        { email: regex },
        { subject: regex },
        { ticketId: regex },
        { messageId: regex },
      ];
    }
    const [messages, total, unread] = await Promise.all([
      ContactMessage.find(query).sort({ submittedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      ContactMessage.countDocuments(query),
      ContactMessage.countDocuments({ isRead: false }),
    ]);
    return res.json({
      success: true,
      data: {
        messages: messages.map(serializeMessage),
        unread,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (error) {
    console.error('Contact inbox load failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to load messages right now.' });
  }
};

const getContactMessage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID.' });
  }
  try {
    const message = await ContactMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
    return res.json({ success: true, data: { message: serializeMessage(message) } });
  } catch (error) {
    console.error('Contact message load failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to load this message right now.' });
  }
};

const updateContactMessageStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID.' });
  }
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { status: normalizedStatus(req.body.status) } },
      { new: true, runValidators: true },
    );
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
    return res.json({ success: true, data: { message: serializeMessage(message) } });
  } catch (error) {
    console.error('Contact message status update failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to update the ticket status right now.' });
  }
};

const updateContactMessageReadState = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID.' });
  }
  if (typeof req.body?.isRead !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Read state must be true or false.' });
  }
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { isRead: req.body.isRead } },
      { new: true, runValidators: true },
    );
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
    return res.json({ success: true, data: { message: serializeMessage(message) } });
  } catch (error) {
    console.error('Contact message read-state update failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to update the read state right now.' });
  }
};

const updateContactMessage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID.' });
  }
  const update = {};
  if (req.body?.status !== undefined) update.status = normalizedStatus(req.body.status);
  if (req.body?.isRead !== undefined && typeof req.body.isRead === 'boolean') update.isRead = req.body.isRead;
  if (!Object.keys(update).length) {
    return res.status(400).json({ success: false, message: 'Choose a status or read state to update.' });
  }
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
    return res.json({ success: true, data: { message: serializeMessage(message) } });
  } catch (error) {
    console.error('Contact message update failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to update this message right now.' });
  }
};

const replyToContactMessage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID.' });
  }
  const replyText = cleanMessage(req.body?.message);
  if (!replyText || replyText.length > 10000) {
    return res.status(400).json({ success: false, message: 'Reply must contain between 1 and 10000 characters.' });
  }

  try {
    const message = await ContactMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (message.replies.length >= 500) {
      return res.status(409).json({ success: false, message: 'This ticket has reached its reply limit.' });
    }

    const now = new Date();
    message.replies.push({
      senderUserId: req.user._id,
      senderRole: 'admin',
      senderName: req.user.fullName || req.user.email,
      message: replyText,
      createdAt: now,
    });
    message.lastRepliedAt = now;
    message.status = 'replied';
    message.isRead = true;
    await message.save();

    let notificationCreated = false;
    let notificationError = '';
    if (message.userId) {
      try {
        await Notification.create({
          recipient: message.userId,
          recipientUserId: message.userId,
          sender: req.user._id,
          type: 'contact_reply',
          title: `Reply to ticket ${message.ticketId || message.messageId}`,
          subject: `Reply to contact ticket ${message.ticketId || message.messageId}`,
          message: `An administrator replied to your ticket "${message.subject}": ${replyText.slice(0, 1700)}`,
          relatedMessageId: message._id,
          isRead: false,
          readAt: null,
        });
        notificationCreated = true;
      } catch (error) {
        notificationError = 'In-app notification could not be created.';
        console.error('Contact reply was saved, but its notification could not be created.', {
          name: error.name,
          code: error.code,
        });
      }
    }

    let emailSent = false;
    let emailError = '';
    if (!message.userId && emailService.isEmailConfigured()) {
      message.emailDeliveryStatus = 'pending';
      try {
        await message.save();
      } catch (error) {
        console.error('Reply saved, but pending email status could not be persisted.', {
          name: error.name,
          code: error.code,
        });
      }
      try {
        await emailService.sendContactReplyEmail({
          email: message.email,
          name: message.fullName,
          subject: message.subject,
          originalMessage: message.message,
          reply: replyText,
          ticketId: message.ticketId || message.messageId,
        });
        emailSent = true;
        message.emailDeliveryStatus = 'sent';
      } catch (error) {
        emailError = 'Reply saved, but the email notification could not be delivered.';
        message.emailDeliveryStatus = 'failed';
        console.error('Contact reply was saved, but email delivery failed.', { name: error.name, code: error.code });
      }
    } else if (!message.userId) {
      emailError = 'Email notifications are not configured.';
      message.emailDeliveryStatus = 'not_configured';
    } else {
      message.emailDeliveryStatus = 'not_required';
    }
    try {
      await message.save();
    } catch (error) {
      emailError = emailSent
        ? 'Email delivery succeeded, but its delivery status could not be recorded.'
        : emailError || 'Reply was saved, but email delivery status could not be recorded.';
      console.error('Reply email delivery status persistence failed.', {
        name: error.name,
        code: error.code,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Reply saved successfully.',
      data: {
        message: serializeMessage(message),
        emailSent,
        emailError,
        notificationCreated,
        notificationError,
      },
    });
  } catch (error) {
    console.error('Contact reply persistence failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to save the reply right now.' });
  }
};

const deleteContactMessage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID.' });
  }
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Message not found.' });
    return res.json({ success: true, message: 'Message deleted.' });
  } catch (error) {
    console.error('Contact message delete failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to delete this message right now.' });
  }
};

const listMyContactMessages = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const filter = { userId: req.user._id };
    const [messages, total] = await Promise.all([
      ContactMessage.find(filter).sort({ submittedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      ContactMessage.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: {
        messages: messages.map(serializeMessage),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (error) {
    console.error('Employee contact tickets load failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to load your messages right now.' });
  }
};

const getMyContactMessage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
  }
  try {
    const message = await ContactMessage.findOne({ _id: req.params.id, userId: req.user._id });
    if (!message) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    return res.json({ success: true, data: { message: serializeMessage(message) } });
  } catch (error) {
    console.error('Employee contact ticket load failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to load this ticket right now.' });
  }
};

module.exports = {
  submitContactMessage,
  listContactMessages,
  getContactMessage,
  updateContactMessage,
  updateContactMessageStatus,
  updateContactMessageReadState,
  replyToContactMessage,
  deleteContactMessage,
  listMyContactMessages,
  getMyContactMessage,
};
