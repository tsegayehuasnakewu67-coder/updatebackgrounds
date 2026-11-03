const LeaveRequest = require('../models/LeaveRequest');
const mongoose = require('mongoose');
const { recordAuditEvent, auditWarning } = require('../utils/auditLog');

const isDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const listLeaves = async (req, res) => {
  try {
    const filter = req.user.role === 'employee' ? { employee: req.user._id } : {};
    if (req.query.status) filter.status = req.query.status;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const [requests, total] = await Promise.all([
      LeaveRequest.find(filter)
      .populate('employee', 'fullName employeeId department position')
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
      LeaveRequest.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: requests,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Unable to load leave requests.', { errorName: error.name, errorCode: error.code });
    return res.status(500).json({ success: false, message: 'Unable to load leave requests.' });
  }
};

const createLeave = async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    if (!isDate(startDate) || !isDate(endDate) || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Valid dates and a reason of at most 1000 characters are required.' });
    }
    if (type !== undefined && !['annual', 'sick', 'personal', 'other'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid leave type.' });
    }
    if (startDate > endDate) return res.status(400).json({ success: false, message: 'End date must be after start date.' });
    const request = await LeaveRequest.create({ employee: req.user._id, type, startDate, endDate, reason: reason.trim() });
    const auditRecorded = await recordAuditEvent(req, {
      action: 'LEAVE_REQUESTED',
      resourceType: 'leave',
      resourceId: request._id,
      summary: `Submitted a ${request.type} leave request.`,
      details: { leaveType: request.type, startDate: request.startDate, endDate: request.endDate },
    });
    return res.status(201).json({ success: true, message: 'Leave request submitted.', data: request, ...auditWarning(auditRecorded) });
  } catch (error) {
    console.error('Unable to submit leave request.', { errorName: error.name, errorCode: error.code });
    return res.status(500).json({ success: false, message: 'Unable to submit leave request.' });
  }
};

const reviewLeave = async (req, res) => {
  try {
    const { status, reviewNote = '' } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid review status.' });
    if (typeof reviewNote !== 'string' || reviewNote.trim().length > 500) {
      return res.status(400).json({ success: false, message: 'Review note must be 500 characters or fewer.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid leave request id.' });
    }
    const previousRequest = await LeaveRequest.findById(req.params.id);
    if (!previousRequest) return res.status(404).json({ success: false, message: 'Leave request not found.' });
    if (previousRequest.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'This leave request has already been reviewed.' });
    }
    const request = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status, reviewNote: reviewNote.trim(), reviewedBy: req.user._id, reviewedAt: new Date() },
      { new: true, runValidators: true },
    ).populate('employee', 'fullName employeeId department');
    if (!request) return res.status(409).json({ success: false, message: 'This leave request has already been reviewed.' });
    const auditRecorded = await recordAuditEvent(req, {
      action: status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      resourceType: 'leave',
      resourceId: request._id,
      summary: `Leave request ${status} for ${request.employee?.employeeId || previousRequest.employee}.`,
      details: {
        employeeId: request.employee?.employeeId,
        leaveType: request.type,
        startDate: request.startDate,
        endDate: request.endDate,
        previousStatus: previousRequest.status,
        status,
      },
    });
    return res.json({ success: true, message: `Leave request ${status}.`, data: request, ...auditWarning(auditRecorded) });
  } catch (error) {
    console.error('Unable to review leave request.', { errorName: error.name, errorCode: error.code });
    return res.status(500).json({ success: false, message: 'Unable to review leave request.' });
  }
};

module.exports = { listLeaves, createLeave, reviewLeave };
