const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { ipKeyGenerator } = require('express-rate-limit');
const FaceScanAttempt = require('../models/FaceScanAttempt');

const getApiRateLimitKey = (req) => {
  const authorization = req.headers?.authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (match && process.env.JWT_SECRET) {
    try {
      const claims = jwt.verify(match[1], process.env.JWT_SECRET);
      if (claims.id) return `user:${claims.id}`;
    } catch (error) {
      if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
        throw error;
      }
    }
  }
  return `ip:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1')}`;
};

const shouldSkipGlobalApiLimit = (req) => (
  req.path === '/face/bulk-register'
  || req.path === '/admin/messages'
  || req.path.startsWith('/admin/messages/')
  || (req.method === 'POST' && req.path === '/auth/login')
);

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipGlobalApiLimit,
  keyGenerator: getApiRateLimitKey,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    message: 'Too many requests. Please try again later.',
  },
  handler: (req, res, options) => {
    console.warn('Global API rate limit exceeded.', {
      method: req.method,
      path: req.path,
      authenticated: /^Bearer\s+\S+$/i.test(req.headers?.authorization || ''),
    });
    return res.status(options.statusCode).json(options.message);
  },
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.' },
    message: 'Too many sign-in attempts. Please try again later.',
  },
});

const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX, 10) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests. Please wait before trying again.',
  },
});

const passwordResetVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.PASSWORD_RESET_VERIFY_RATE_LIMIT_MAX, 10) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait before trying again.',
  },
});

const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number.parseInt(process.env.CONTACT_RATE_LIMIT_MAX, 10) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many messages were submitted. Please try again later.',
  },
});

const adminMessagesRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.ADMIN_MESSAGES_RATE_LIMIT_MAX, 10) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'ADMIN_MESSAGES_RATE_LIMITED', message: 'Too many contact inbox requests. Please wait before trying again.' },
    message: 'Too many contact inbox requests. Please wait before trying again.',
  },
});

const attendanceScanRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number.parseInt(process.env.ATTENDANCE_SCAN_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    try {
      await FaceScanAttempt.create({
        outcome: 'rate_limited',
        reason: 'rate_limited',
        ipAddress: String(req.ip || '').slice(0, 64),
        deviceInfo: String(req.get('user-agent') || '').slice(0, 300),
      });
    } catch (error) {
      console.error('Unable to persist rate-limited face-scan audit event:', error);
    }
    const message = 'Too many scan attempts. Please wait before trying again.';
    return res.status(429).json({
      success: false,
      error: { code: 'SCAN_RATE_LIMITED', message },
      message,
    });
  },
});

const bulkFaceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.FACE_REGISTER_RATE_LIMIT_MAX, 10) || 1200,
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOptions = () => {
  const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  };
};

module.exports = {
  apiRateLimit, loginRateLimit, passwordResetRateLimit, passwordResetVerifyRateLimit,
  contactRateLimit, adminMessagesRateLimit, attendanceScanRateLimit, bulkFaceRateLimit, corsOptions,
  shouldSkipGlobalApiLimit, getApiRateLimitKey,
};
