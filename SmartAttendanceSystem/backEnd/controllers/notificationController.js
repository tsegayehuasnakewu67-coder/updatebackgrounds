const Notification = require('../models/Notification');
const User = require('../models/User');

const listNotifications = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const recipientQuery = {
      $or: [{ recipient: req.user._id }, { recipientUserId: req.user._id }],
    };
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(recipientQuery)
      .populate('sender', 'fullName role')
      .sort({ createdAt: -1 })
      .limit(limit),
      Notification.countDocuments({
        ...recipientQuery,
        $and: [
          { $or: [{ readAt: null }, { readAt: { $exists: false } }] },
          ...(req.query.type ? [{ type: req.query.type }] : []),
        ],
      }),
    ]);
    return res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) {
    console.error('List notifications error:', err.name);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
  }
};

const sendNotification = async (req, res) => {
  try {
    const { recipientId, sendToAll, type = 'message', subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and message are required.' });
    }
    if (!['message', 'warning'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid notification type.' });
    }

    let recipients;
    if (sendToAll) {
      recipients = await User.find({ role: 'employee', isActive: true }).select('_id');
    } else if (recipientId) {
      const recipient = await User.findOne({ _id: recipientId, role: 'employee', isActive: true }).select('_id');
      if (!recipient) return res.status(404).json({ success: false, message: 'Active employee not found.' });
      recipients = [recipient];
    } else {
      return res.status(400).json({ success: false, message: 'Choose one employee or all employees.' });
    }

    if (!recipients.length) {
      return res.status(400).json({ success: false, message: 'No active employees are available.' });
    }

    const documents = recipients.map(recipient => ({
      recipient: recipient._id,
      recipientUserId: recipient._id,
      sender: req.user._id,
      type,
      title: subject.trim(),
      subject: subject.trim(),
      message: message.trim(),
      isRead: false,
      readAt: null,
    }));
    await Notification.insertMany(documents);

    return res.status(201).json({
      success: true,
      message: `${type === 'warning' ? 'Warning' : 'Message'} sent to ${documents.length} employee${documents.length === 1 ? '' : 's'}.`,
      data: { count: documents.length },
    });
  } catch (err) {
    console.error('Send notification error:', err);
    return res.status(500).json({ success: false, message: 'Unable to send notification.' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ recipient: req.user._id }, { recipientUserId: req.user._id }],
      },
      { $set: { readAt: new Date(), isRead: true } },
      { new: true },
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    return res.json({ success: true, data: notification });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to update notification.' });
  }
};

const getUnreadNotificationCount = async (req, res) => {
  try {
    const filter = {
      $or: [{ recipient: req.user._id }, { recipientUserId: req.user._id }],
      $and: [
        { $or: [{ readAt: null }, { readAt: { $exists: false } }] },
        ...(req.query.type ? [{ type: req.query.type }] : []),
      ],
    };
    const count = await Notification.countDocuments(filter);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Unread notification count failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to load the unread notification count.' });
  }
};

module.exports = { listNotifications, sendNotification, markNotificationRead, getUnreadNotificationCount };
