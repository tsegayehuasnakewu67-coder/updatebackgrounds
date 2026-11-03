const router = require('express').Router();
const { query } = require('express-validator');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/requestValidation');
const { listAuditLogs, listFaceScanFailures } = require('../controllers/auditLogController');

const validDate = value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

router.use(protect, adminOnly);
const dateFilters = [
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('from').optional().custom(validDate),
  query('to').optional().custom(validDate),
];
router.get('/face-scans', dateFilters, validateRequest, listFaceScanFailures);
router.get('/', [
  ...dateFilters,
  query('action').optional().isString().trim().isLength({ min: 1, max: 80 }),
  query('resourceType').optional().isIn(['user', 'attendance', 'leave', 'shift_settings', 'system']),
], validateRequest, listAuditLogs);

module.exports = router;
