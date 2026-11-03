const jwt  = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { findDuplicateFace } = require('../utils/faceRegistration');
const { syncEmployeeForUser } = require('../utils/employeeSync');
const { invalidateFaceCandidates } = require('../services/faceRecognitionService');
const {
  sendPasswordResetEmail,
  sendPasswordResetCodeEmail,
  isPasswordResetEmailConfigured,
  getSmtpConfigurationStatus,
  verifySmtpConnection,
} = require('../services/emailService');
const { getDefaultEmployeePassword, validatePassword } = require('../utils/passwordPolicy');
const { departments: hrDepartments, positions: hrPositions } = require('../constants/hrAccountOptions');
const { recordAuditEvent, auditWarning } = require('../utils/auditLog');

const signToken = (user, passwordChangeOnly = false) =>
  jwt.sign({
    id: user._id,
    role: user.role,
    authVersion: user.authVersion || 0,
    ...(passwordChangeOnly ? { passwordChangeOnly: true } : {}),
  }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const safeUser = (u) => ({
  _id:               u._id,
  name:              u.name || u.fullName,
  fullName:          u.fullName,
  employeeId:        u.employeeId,
  email:             u.email,
  department:        u.department,
  position:          u.position,
  role:              u.role,
  isActive:          u.isActive,
  mustChangePassword: Boolean(u.mustChangePassword),
  passwordChangedAt: u.passwordChangedAt || null,
  hasFace:           u.faceDescriptor?.length === 128,
  createdAt:         u.createdAt,
});

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const hashResetCode = (email, code) => crypto.createHmac('sha256', process.env.JWT_SECRET)
  .update(`${email}:${code}`).digest('hex');

const issuePasswordResetCode = async (user) => {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashResetCode(user.email, code);
  user.passwordResetCodeHash = codeHash;
  user.passwordResetCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  user.passwordResetCodeAttempts = 0;
  user.passwordResetCodeSentAt = new Date();
  user.passwordResetGrantHash = null;
  user.passwordResetGrantExpiresAt = null;
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();
  try {
    await sendPasswordResetCodeEmail({ email: user.email, name: user.fullName, code });
  } catch (error) {
    await User.updateOne(
      { _id: user._id, passwordResetCodeHash: codeHash },
      { $set: {
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetCodeAttempts: 0,
        passwordResetCodeSentAt: null,
      } },
    );
    throw error;
  }
};

const issuePasswordReset = async (user) => {
  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  user.passwordResetCodeHash = null;
  user.passwordResetCodeExpiresAt = null;
  user.passwordResetCodeAttempts = 0;
  user.passwordResetCodeSentAt = null;
  user.passwordResetGrantHash = null;
  user.passwordResetGrantExpiresAt = null;
  await user.save();
  try {
    await sendPasswordResetEmail({ email: user.email, name: user.fullName, token });
  } catch (error) {
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    throw error;
  }
};

/**
 * Check if a face descriptor is already registered to another user.
 * Excludes `excludeId` so edit-mode doesn't flag the same user's own face.
 * Returns { duplicate: true, owner } or { duplicate: false }
 */
// POST /api/auth/register  (admin only)
const register = async (req, res) => {
  try {
    const {
      fullName, employeeId, email, confirmPassword,
      department, position, role, faceDescriptor,
    } = req.body;
    if (role !== undefined && role !== 'employee') {
      return res.status(403).json({ success: false, message: 'This endpoint only registers employee accounts.' });
    }

    const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
    const normalizedEmployeeId = typeof employeeId === 'string' ? employeeId.trim().toUpperCase() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedDepartment = typeof department === 'string' ? department.trim() : '';
    const normalizedPosition = typeof position === 'string' ? position.trim() : '';
    if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 120
      || !normalizedEmployeeId || normalizedEmployeeId.length > 64
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254
      || !normalizedDepartment || normalizedDepartment.length > 100
      || normalizedPosition.length < 2 || normalizedPosition.length > 100) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (confirmPassword !== undefined) {
      return res.status(400).json({ success: false, message: 'Employee passwords are configured securely on the server.' });
    }
    if (faceDescriptor !== undefined && (
      !Array.isArray(faceDescriptor)
      || faceDescriptor.length !== 128
      || !faceDescriptor.every((value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 2)
    )) {
      return res.status(400).json({ success: false, message: 'Face descriptor must be 128 numbers.' });
    }

    const exists = await User.findOne({
      $or: [{ email: normalizedEmail }, { employeeId: normalizedEmployeeId }],
    });
    if (exists) {
      const field = exists.email === normalizedEmail ? 'Email' : 'Employee ID';
      return res.status(409).json({ success: false, message: `${field} already registered.` });
    }

    // ── Face duplicate check ──────────────────────────────
    if (faceDescriptor && faceDescriptor.length === 128) {
      const owner = await findDuplicateFace(faceDescriptor, { excludeEmployeeCode: normalizedEmployeeId });
      if (owner) {
        return res.status(409).json({
          success: false,
          message: `This face is already registered to "${owner.fullName}" (ID: ${owner.employeeId}). Each employee must use their own unique face.`,
        });
      }
    }

    const employeePassword = getDefaultEmployeePassword();
    const user = await User.create({
      name: normalizedName,
      fullName: normalizedName,
      employeeId: normalizedEmployeeId,
      email: normalizedEmail,
      password: employeePassword,
      department: normalizedDepartment,
      position: normalizedPosition,
      role: 'employee',
      mustChangePassword: true,
      passwordChangedAt: null,
      faceDescriptor: faceDescriptor || [],
    });
    await syncEmployeeForUser(user);
    invalidateFaceCandidates();
    const auditRecorded = await recordAuditEvent(req, {
      action: 'USER_CREATED',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Registered employee account ${user.employeeId}.`,
      details: { employeeId: user.employeeId, role: user.role },
    });

    return res.status(201).json({
      success: true,
      message: `Employee "${user.fullName}" registered. They must change the configured default password after signing in.`,
      data: { user: safeUser(user) },
      ...auditWarning(auditRecorded),
    });
  } catch (err) {
    if (/DEFAULT_EMPLOYEE_PASSWORD/.test(err.message)) {
      return res.status(503).json({ success: false, message: 'Employee account creation is not configured on the server.' });
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists.` });
    }
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// POST /api/auth/register-hr (Admin only; HR creation has its own dedicated workflow)
const registerHr = async (req, res) => {
  try {
    const {
      fullName, employeeId, email, password, confirmPassword, department, position,
    } = req.body;
    const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
    const normalizedEmployeeId = typeof employeeId === 'string' ? employeeId.trim().toUpperCase() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedDepartment = typeof department === 'string' ? department.trim() : '';
    const normalizedPosition = typeof position === 'string' ? position.trim() : '';
    if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 120
      || !normalizedEmployeeId || normalizedEmployeeId.length > 64
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254
      || !hrDepartments.includes(normalizedDepartment)
      || !hrPositions.includes(normalizedPosition)
      || typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ success: false, message: 'All HR account fields are required and must be valid.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    const exists = await User.findOne({
      $or: [{ email: normalizedEmail }, { employeeId: normalizedEmployeeId }],
    });
    if (exists) {
      const field = exists.email === normalizedEmail ? 'Email' : 'Employee ID';
      return res.status(409).json({ success: false, message: `${field} already registered.` });
    }

    const user = await User.create({
      name: normalizedName,
      fullName: normalizedName,
      employeeId: normalizedEmployeeId,
      email: normalizedEmail,
      password,
      department: normalizedDepartment,
      position: normalizedPosition,
      role: 'hr',
      mustChangePassword: true,
      passwordChangedAt: null,
    });
    const auditRecorded = await recordAuditEvent(req, {
      action: 'USER_CREATED',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Registered HR account ${user.employeeId}.`,
      details: { employeeId: user.employeeId, role: user.role },
    });
    return res.status(201).json({
      success: true,
      message: `HR account created for "${user.fullName}".`,
      data: { user: safeUser(user) },
      ...auditWarning(auditRecorded),
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists.` });
    }
    console.error('HR account registration failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to create the HR account right now.' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Employee ID or email and password are required.' });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { employeeId: identifier.toUpperCase() },
      ],
    }).select('+password');
    if (!user) {
      await recordAuditEvent(req, {
        action: 'LOGIN_FAILED',
        resourceType: 'system',
        summary: 'Failed sign-in attempt.',
        details: { reason: 'invalid_credentials' },
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      await recordAuditEvent(req, {
        action: 'LOGIN_FAILED',
        resourceType: 'system',
        summary: 'Failed sign-in attempt.',
        details: { reason: 'invalid_credentials' },
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    if (!user.isActive) {
      await recordAuditEvent(req, {
        action: 'LOGIN_FAILED',
        resourceType: 'user',
        resourceId: user._id,
        summary: 'Sign-in blocked for an inactive account.',
        details: { employeeId: user.employeeId, reason: 'inactive_account' },
      });
      return res.status(403).json({ success: false, message: 'This account is inactive. Contact an administrator.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: safeUser(user),
        token: signToken(user, user.mustChangePassword),
      },
    });
  } catch (err) {
    const databaseUnavailable = mongoose.connection.readyState !== 1
      || ['MongooseServerSelectionError', 'MongoNetworkError', 'MongoServerSelectionError'].includes(err.name);
    if (databaseUnavailable) {
      console.error('Login unavailable because the database connection failed.');
      return res.status(503).json({ success: false, message: 'The account database is unavailable. Please try again shortly.' });
    }
    console.error('Login error:', err.name);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, data: { user: safeUser(user) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const logout = (_req, res) => res.json({ success: true, message: 'Logged out successfully.' });

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Current password, new password, and confirmation are required.' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !await user.comparePassword(currentPassword)) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, password: user.password },
      { $set: {
        password: await bcrypt.hash(newPassword, 12),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        authVersion: (user.authVersion || 0) + 1,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetCodeAttempts: 0,
        passwordResetCodeSentAt: null,
        passwordResetGrantHash: null,
        passwordResetGrantExpiresAt: null,
      } },
      { new: true, runValidators: true },
    );
    if (!updatedUser) {
      return res.status(409).json({ success: false, message: 'Password was changed by another request. Sign in and try again.' });
    }
    const auditRecorded = await recordAuditEvent(req, {
      action: 'PASSWORD_CHANGED',
      resourceType: 'user',
      resourceId: updatedUser._id,
      summary: `Password changed for account ${updatedUser.employeeId}.`,
      details: { employeeId: updatedUser.employeeId },
    });

    return res.json({
      success: true,
      message: 'Password changed successfully.',
      data: { user: safeUser(updatedUser), token: signToken(updatedUser) },
      ...auditWarning(auditRecorded),
    });
  } catch (error) {
    console.error('Change-password request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to change password right now.' });
  }
};

// POST /api/auth/forgot-password. The same response is used whether or not the
// account exists to avoid disclosing registered email addresses.
const forgotPassword = async (req, res) => {
  const genericMessage = 'If an account exists for this email, a verification code may be sent. This response does not confirm email delivery.';
  if (!isPasswordResetEmailConfigured()) {
    const missing = getSmtpConfigurationStatus().missingVariables;
    return res.status(503).json({
      success: false,
      message: `Password reset email is not configured. Missing backend setting(s): ${missing.join(', ')}.`,
    });
  }
  try {
    await verifySmtpConnection();
  } catch (error) {
    const message = error.code === 'EAUTH'
      ? 'The email service could not authenticate. For Gmail, set SMTP_PASS to a Google App Password.'
      : ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(error.code)
        ? 'The email service is temporarily unreachable. Check SMTP_HOST, SMTP_PORT, and SMTP_SECURE.'
        : 'The email service is unavailable. Check the backend SMTP configuration.';
    console.error('Password reset SMTP verification failed.', { code: error.code || 'UNKNOWN' });
    return res.status(503).json({ success: false, message });
  }
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email, isActive: true }).select('+passwordResetCodeSentAt');
    if (user && (!user.passwordResetCodeSentAt || Date.now() - user.passwordResetCodeSentAt.getTime() >= 60 * 1000)) {
      try {
        await issuePasswordResetCode(user);
      } catch (error) {
        console.error('Password reset email delivery failed.', { name: error.name, code: error.code });
      }
    }
    return res.json({ success: true, message: genericMessage, data: { nextStep: 'verify' } });
  } catch (error) {
    const databaseUnavailable = mongoose.connection.readyState !== 1
      || ['MongooseServerSelectionError', 'MongoNetworkError', 'MongoServerSelectionError'].includes(error.name);
    if (databaseUnavailable) {
      return res.status(503).json({ success: false, message: 'The account database is unavailable. Please try again shortly.' });
    }
    console.error('Forgot-password request failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to process password reset right now.' });
  }
};

const resendPasswordResetCode = async (req, res) => {
  const genericMessage = 'If an account exists for this email, a verification code may be sent. This response does not confirm email delivery.';
  if (!isPasswordResetEmailConfigured()) {
    const missing = getSmtpConfigurationStatus().missingVariables;
    return res.status(503).json({
      success: false,
      message: `Password reset email is not configured. Missing backend setting(s): ${missing.join(', ')}.`,
    });
  }
  try {
    await verifySmtpConnection();
  } catch (error) {
    const message = error.code === 'EAUTH'
      ? 'The email service could not authenticate. For Gmail, set SMTP_PASS to a Google App Password.'
      : ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(error.code)
        ? 'The email service is temporarily unreachable. Check SMTP_HOST, SMTP_PORT, and SMTP_SECURE.'
        : 'The email service is unavailable. Check the backend SMTP configuration.';
    console.error('Password reset resend SMTP verification failed.', { code: error.code || 'UNKNOWN' });
    return res.status(503).json({ success: false, message });
  }
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email, isActive: true }).select('+passwordResetCodeSentAt');
    if (user && (!user.passwordResetCodeSentAt || Date.now() - user.passwordResetCodeSentAt.getTime() >= 60 * 1000)) {
      try {
        await issuePasswordResetCode(user);
      } catch (error) {
        console.error('Password reset code resend failed.', { name: error.name, code: error.code });
      }
    }
    return res.json({ success: true, message: genericMessage, data: { nextStep: 'verify' } });
  } catch (error) {
    console.error('Password reset resend request failed:', error.name);
    return res.status(503).json({ success: false, message: 'Unable to process the reset request right now.' });
  }
};

const verifyPasswordResetCode = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Enter the six-digit verification code.' });
  }
  try {
    const user = await User.findOne({ email, isActive: true }).select(
      '+passwordResetCodeHash +passwordResetCodeExpiresAt +passwordResetCodeAttempts',
    );
    const now = new Date();
    if (!user || !user.passwordResetCodeHash || !user.passwordResetCodeExpiresAt
      || user.passwordResetCodeExpiresAt <= now || user.passwordResetCodeAttempts >= 5) {
      return res.status(400).json({ success: false, message: 'The verification code is invalid or expired. Request a new code.' });
    }

    const expected = Buffer.from(hashResetCode(email, code), 'hex');
    const actual = Buffer.from(user.passwordResetCodeHash, 'hex');
    const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!valid) {
      await User.updateOne({
        _id: user._id,
        passwordResetCodeHash: user.passwordResetCodeHash,
        passwordResetCodeExpiresAt: { $gt: now },
        passwordResetCodeAttempts: { $lt: 5 },
      }, { $inc: { passwordResetCodeAttempts: 1 } });
      return res.status(400).json({ success: false, message: 'The verification code is invalid or expired. Request a new code.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const updated = await User.findOneAndUpdate({
      _id: user._id,
      passwordResetCodeHash: user.passwordResetCodeHash,
      passwordResetCodeExpiresAt: { $gt: now },
      passwordResetCodeAttempts: { $lt: 5 },
    }, { $set: {
      passwordResetCodeHash: null,
      passwordResetCodeExpiresAt: null,
      passwordResetCodeAttempts: 0,
      passwordResetCodeSentAt: null,
      passwordResetGrantHash: hashResetToken(resetToken),
      passwordResetGrantExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    } }, { new: true });
    if (!updated) return res.status(400).json({ success: false, message: 'The verification code is invalid or expired. Request a new code.' });
    return res.json({ success: true, message: 'Code verified.', data: { resetToken } });
  } catch (error) {
    console.error('Password reset code verification failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to verify this code right now.' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, resetToken, newPassword, confirmPassword } = req.body;
    const isGrant = typeof resetToken === 'string' && /^[a-f0-9]{64}$/i.test(resetToken);
    const activeToken = isGrant ? resetToken : token;
    if (typeof activeToken !== 'string' || !/^[a-f0-9]{64}$/i.test(activeToken)) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or expired.' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }
    const resetQuery = isGrant
      ? { passwordResetGrantHash: hashResetToken(activeToken), passwordResetGrantExpiresAt: { $gt: new Date() } }
      : { passwordResetTokenHash: hashResetToken(activeToken), passwordResetExpiresAt: { $gt: new Date() } };
    const user = await User.findOne(resetQuery).select(
      '+password +passwordResetTokenHash +passwordResetExpiresAt +passwordResetGrantHash +passwordResetGrantExpiresAt',
    );
    if (!user) return res.status(400).json({ success: false, message: 'Reset link is invalid or expired.' });
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    const atomicResetQuery = isGrant
      ? { _id: user._id, passwordResetGrantHash: hashResetToken(activeToken), passwordResetGrantExpiresAt: { $gt: new Date() } }
      : { _id: user._id, passwordResetTokenHash: hashResetToken(activeToken), passwordResetExpiresAt: { $gt: new Date() } };
    const updatedUser = await User.findOneAndUpdate(atomicResetQuery, {
      $set: {
        password: await bcrypt.hash(newPassword, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        authVersion: (user.authVersion || 0) + 1,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetCodeAttempts: 0,
        passwordResetCodeSentAt: null,
        passwordResetGrantHash: null,
        passwordResetGrantExpiresAt: null,
      },
    }, { new: true, runValidators: true });
    if (!updatedUser) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or expired.' });
    }
    return res.json({ success: true, message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to reset password right now.' });
  }
};

// POST /api/auth/admin-reset/:id — restricted to an authenticated administrator.
const adminResetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (user.role === 'employee') {
      user.password = getDefaultEmployeePassword();
      user.mustChangePassword = true;
      user.passwordChangedAt = null;
      user.authVersion = (user.authVersion || 0) + 1;
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      user.passwordResetCodeHash = null;
      user.passwordResetCodeExpiresAt = null;
      user.passwordResetCodeAttempts = 0;
      user.passwordResetCodeSentAt = null;
      user.passwordResetGrantHash = null;
      user.passwordResetGrantExpiresAt = null;
      await user.save();
      const auditRecorded = await recordAuditEvent(req, {
        action: 'PASSWORD_RESET',
        resourceType: 'user',
        resourceId: user._id,
        summary: `Administrator reset employee password for ${user.employeeId}.`,
        details: { employeeId: user.employeeId, resetMode: 'temporary_password' },
      });
      return res.json({
        success: true,
        message: 'Employee password reset. The employee must use the configured default password and change it before continuing.',
        ...auditWarning(auditRecorded),
      });
    }

    await issuePasswordReset(user);
    const auditRecorded = await recordAuditEvent(req, {
      action: 'PASSWORD_RESET',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Administrator initiated password reset for ${user.employeeId}.`,
      details: { employeeId: user.employeeId, resetMode: 'email' },
    });
    return res.json({ success: true, message: 'Password reset instructions sent to the account email address.', ...auditWarning(auditRecorded) });
  } catch (error) {
    if (/DEFAULT_EMPLOYEE_PASSWORD/.test(error.message)) {
      return res.status(503).json({ success: false, message: 'Employee password reset is not configured on the server.' });
    }
    console.error('Administrator password reset request failed:', error.message);
    return res.status(503).json({ success: false, message: 'Unable to send password reset instructions. Check server email configuration.' });
  }
};

// POST /api/auth/signup — the legacy public registration route is intentionally disabled.
const signup = async (_req, res) => res.status(403).json({
  success: false,
  message: 'Registration is restricted. Please contact your administrator.',
});

// POST /api/auth/setup-admin  — first-time admin creation (blocked if any admin exists)
const setupAdmin = async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Setup already complete. An admin account already exists.',
      });
    }

    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    // Auto-generate a unique admin employeeId that never conflicts with employees
    const adminEmployeeId = `ADMIN-${Date.now()}`;

    const user = await User.create({
      name:       fullName.trim(),
      fullName:   fullName.trim(),
      employeeId: adminEmployeeId,
      email:      email.toLowerCase().trim(),
      password,
      department: 'Administration',
      position:   'System Administrator',
      role:       'admin',
    });
    const auditRecorded = await recordAuditEvent(req, {
      action: 'ADMIN_SETUP_COMPLETED',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Initial administrator account ${user.employeeId} was created.`,
      details: { employeeId: user.employeeId, role: user.role },
    });

    return res.status(201).json({
      success: true,
      message: `Admin account created for "${user.fullName}". You can now sign in.`,
      data: { user: safeUser(user) },
      ...auditWarning(auditRecorded),
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists.` });
    }
    console.error('SetupAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Server error during admin setup.' });
  }
};

module.exports = {
  register, registerHr, login, getMe, logout, signup, setupAdmin,
  changePassword, forgotPassword, resendPasswordResetCode, verifyPasswordResetCode,
  resetPassword, adminResetPassword,
};
