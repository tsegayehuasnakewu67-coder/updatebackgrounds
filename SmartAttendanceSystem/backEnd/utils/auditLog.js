const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

const PRIVATE_FIELD = /password|token|secret|face.?descriptor|face.?encoding|biometric|authorization|cookie/i;

const sanitizeDetails = (value, depth = 0) => {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (value instanceof Date) return value.toISOString();
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeDetails(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_FIELD.test(key))
      .slice(0, 40)
      .map(([key, nested]) => [key, sanitizeDetails(nested, depth + 1)])
      .filter(([, nested]) => nested !== undefined),
  );
};

const recordAuditEvent = async (req, event) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('Audit event could not be persisted because MongoDB is not connected.', {
      action: event.action,
      resourceType: event.resourceType,
      connectionState: mongoose.connection.readyState,
    });
    return false;
  }
  try {
    await AuditLog.create({
      actor: req?.user?._id || null,
      actorRole: req?.user?.role || 'system',
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId == null ? '' : String(event.resourceId),
      summary: event.summary,
      details: sanitizeDetails(event.details || {}),
      ipAddress: String(req?.ip || '').slice(0, 64),
      userAgent: String(req?.get?.('user-agent') || req?.headers?.['user-agent'] || '').slice(0, 300),
    });
    return true;
  } catch (error) {
    console.error('Audit event could not be persisted.', {
      action: event.action,
      resourceType: event.resourceType,
      errorName: error?.name || 'Error',
      errorCode: error?.code,
    });
    return false;
  }
};

const auditWarning = (recorded) => recorded
  ? {}
  : { auditWarning: 'The change was saved, but its audit event could not be recorded. Notify a system administrator.' };

module.exports = { recordAuditEvent, auditWarning, sanitizeDetails };
