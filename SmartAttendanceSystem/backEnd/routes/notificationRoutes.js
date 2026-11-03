const router = require('express').Router();
const {
  listNotifications,
  sendNotification,
  markNotificationRead,
  getUnreadNotificationCount,
} = require('../controllers/notificationController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { param, query } = require('express-validator');
const { validateRequest } = require('../middleware/requestValidation');

router.use(protect);
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['message', 'warning', 'contact_message', 'contact_reply']),
], validateRequest, listNotifications);
router.get('/unread-count', [
  query('type').optional().isIn(['message', 'warning', 'contact_message', 'contact_reply']),
], validateRequest, getUnreadNotificationCount);
router.patch('/:id/read', param('id').isMongoId(), validateRequest, markNotificationRead);
router.post('/', adminOnly, sendNotification);

module.exports = router;
