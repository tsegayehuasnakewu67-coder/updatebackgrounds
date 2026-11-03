const router = require('express').Router();
const { listLeaves, createLeave, reviewLeave } = require('../controllers/leaveController');
const { body, param, query } = require('express-validator');
const { protect, adminOrHR } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/requestValidation');

router.use(protect);
router.get('/', [
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validateRequest, listLeaves);
router.post('/', [
  body('type').optional().isIn(['annual', 'sick', 'personal', 'other']),
  body('startDate').isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('endDate').isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('reason').isString().trim().notEmpty().isLength({ max: 1000 }),
], validateRequest, createLeave);
router.patch('/:id/review', adminOrHR, [
  param('id').isMongoId(),
  body('status').isIn(['approved', 'rejected']),
  body('reviewNote').optional().isString().trim().isLength({ max: 500 }),
], validateRequest, reviewLeave);

module.exports = router;
