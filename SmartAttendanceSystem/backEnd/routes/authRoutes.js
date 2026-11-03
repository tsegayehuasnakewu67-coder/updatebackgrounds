const router = require('express').Router();
const {
  register, registerHr, login, getMe, logout, signup, setupAdmin,
  changePassword, forgotPassword, resendPasswordResetCode, verifyPasswordResetCode, resetPassword,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/requestValidation');
const { departments: hrDepartments, positions: hrPositions } = require('../constants/hrAccountOptions');
const {
  loginRateLimit,
  passwordResetRateLimit,
  passwordResetVerifyRateLimit,
} = require('../middleware/apiSecurity');

// Public routes
router.post('/login', loginRateLimit, [
  body('identifier').optional().isString().trim().isLength({ min: 1, max: 254 }),
  body('email').optional().isString().trim().isLength({ min: 1, max: 254 }),
  body('password').isString().notEmpty().isLength({ max: 128 }).withMessage('Password is required.'),
], validateRequest, login);
router.post('/forgot-password', passwordResetRateLimit, [
  body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
], validateRequest, forgotPassword);
router.post('/resend-reset-code', passwordResetRateLimit, [
  body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
], validateRequest, resendPasswordResetCode);
router.post('/verify-reset-code', passwordResetVerifyRateLimit, [
  body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
  body('code').isString().matches(/^\d{6}$/),
], validateRequest, verifyPasswordResetCode);
router.post('/reset-password', passwordResetVerifyRateLimit, [
  body('token').optional().isString().isLength({ min: 64, max: 64 }),
  body('resetToken').optional().isString().isLength({ min: 64, max: 64 }),
  body().custom((_value, { req }) => {
    if (!req.body.token && !req.body.resetToken) throw new Error('A reset authorization token is required.');
    return true;
  }),
  body('newPassword').isString().isLength({ min: 12, max: 128 }),
  body('confirmPassword').isString().isLength({ min: 12, max: 128 }),
], validateRequest, resetPassword);
router.post('/change-password', protect, [
  body('currentPassword').isString().notEmpty().isLength({ max: 128 }),
  body('newPassword').isString().isLength({ min: 12, max: 128 }),
  body('confirmPassword').isString().isLength({ min: 12, max: 128 }),
], validateRequest, changePassword);
router.post('/signup', signup);     // Legacy endpoint explicitly disabled.
router.post('/setup-admin', [
  body('fullName').isString().trim().isLength({ min: 2, max: 201 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 12, max: 128 }),
  body('confirmPassword').isString().notEmpty(),
], validateRequest, setupAdmin);    // first-time admin creation — blocked after first admin exists

// Admin-only employee registration. The server sets the role and temporary password.
router.post('/register', protect, adminOnly, [
  body('fullName').isString().trim().isLength({ min: 2, max: 120 }),
  body('employeeId').isString().trim().notEmpty().isLength({ max: 64 }),
  body('email').isEmail().normalizeEmail(),
  body('password').not().exists().withMessage('Employee temporary passwords are configured on the server.'),
  body('role').optional().equals('employee').withMessage('This endpoint only registers employee accounts.'),
  body('department').isString().trim().notEmpty().isLength({ max: 100 }),
  body('position').isString().trim().isLength({ min: 2, max: 100 }),
  body('confirmPassword').optional().isString().isLength({ max: 128 }),
  body('faceDescriptor').optional().isArray({ min: 128, max: 128 }),
  body('faceDescriptor.*').optional().isFloat({ min: -2, max: 2 }),
], validateRequest, register);

// HR accounts use a separate Admin-only workflow and can never be created through /register.
router.post('/register-hr', protect, adminOnly, [
  body('fullName').isString().trim().isLength({ min: 2, max: 120 }),
  body('employeeId').isString().trim().notEmpty().isLength({ max: 64 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 12, max: 128 }),
  body('confirmPassword').isString().isLength({ min: 12, max: 128 }),
  body('department').isString().trim().isIn(hrDepartments),
  body('position').isString().trim().isIn(hrPositions),
], validateRequest, registerHr);

// Protected
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
