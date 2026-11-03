const AuditLog = require('../models/AuditLog');
const FaceScanAttempt = require('../models/FaceScanAttempt');

const dateFilter = (from, to) => {
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) {
      const endExclusive = new Date(`${to}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      filter.createdAt.$lt = endExclusive;
    }
  }
  return filter;
};

const listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    if (req.query.from && req.query.to && req.query.from > req.query.to) {
      return res.status(400).json({ success: false, message: 'The from date must not be after the to date.' });
    }
    const filter = dateFilter(req.query.from, req.query.to);
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;

    const [events, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actor', 'fullName employeeId role')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: {
        events,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Unable to retrieve audit events.', {
      errorName: error?.name || 'Error',
      errorCode: error?.code,
    });
    return res.status(500).json({ success: false, message: 'Unable to retrieve audit events.' });
  }
};

const listFaceScanFailures = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    if (req.query.from && req.query.to && req.query.from > req.query.to) {
      return res.status(400).json({ success: false, message: 'The from date must not be after the to date.' });
    }
    const filter = dateFilter(req.query.from, req.query.to);
    const [attempts, total] = await Promise.all([
      FaceScanAttempt.find(filter)
        .select('outcome reason userId employeeId ipAddress createdAt')
        .populate('userId', 'fullName employeeId role')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FaceScanAttempt.countDocuments(filter),
    ]);
    const events = attempts.map(attempt => ({
      _id: attempt._id,
      createdAt: attempt.createdAt,
      actor: attempt.userId || null,
      actorRole: attempt.userId?.role || 'system',
      action: attempt.outcome === 'rate_limited' ? 'FACE_SCAN_RATE_LIMITED' : 'FACE_SCAN_FAILED',
      resourceType: 'system',
      resourceId: '',
      summary: attempt.outcome === 'rate_limited' ? 'Face verification attempt was rate limited.' : 'Face verification failed.',
      details: { reason: attempt.reason, employeeId: attempt.employeeId || undefined },
      ipAddress: attempt.ipAddress,
    }));
    return res.json({
      success: true,
      data: { events, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    console.error('Unable to retrieve face verification events.', {
      errorName: error?.name || 'Error',
      errorCode: error?.code,
    });
    return res.status(500).json({ success: false, message: 'Unable to retrieve face verification events.' });
  }
};

module.exports = { listAuditLogs, listFaceScanFailures };
