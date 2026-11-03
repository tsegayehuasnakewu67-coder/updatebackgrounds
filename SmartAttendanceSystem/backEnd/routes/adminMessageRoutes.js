const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { adminMessagesRateLimit } = require('../middleware/apiSecurity');
const { validateRequest } = require('../middleware/requestValidation');
const {
  listContactMessages,
  getContactMessage,
  updateContactMessageStatus,
  updateContactMessageReadState,
  updateContactMessage,
  replyToContactMessage,
  deleteContactMessage,
} = require('../controllers/contactMessageController');

router.use(adminMessagesRateLimit, protect, adminOnly);
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'in_progress', 'replied', 'closed']),
  query('read').optional().isIn(['true', 'false']),
  query('search').optional().isString().isLength({ max: 100 }),
], validateRequest, listContactMessages);
router.get('/:id', param('id').isMongoId(), validateRequest, getContactMessage);
router.patch('/:id/status', [
  param('id').isMongoId(),
  body('status').isIn(['pending', 'in_progress', 'replied', 'closed']),
], validateRequest, updateContactMessageStatus);
router.patch('/:id/read', [
  param('id').isMongoId(),
  body('isRead').isBoolean(),
], validateRequest, updateContactMessageReadState);
router.post('/:id/replies', [
  param('id').isMongoId(),
  body('message').isString().trim().isLength({ min: 1, max: 10000 }),
], validateRequest, replyToContactMessage);

// Retain the previous endpoints for clients that have not yet been upgraded.
router.patch('/:id', [
  param('id').isMongoId(),
  body('status').optional().isIn(['pending', 'in_progress', 'replied', 'closed', 'resolved']),
  body('isRead').optional().isBoolean(),
], validateRequest, updateContactMessage);
router.post('/:id/reply', [
  param('id').isMongoId(),
  body('message').isString().trim().isLength({ min: 1, max: 10000 }),
], validateRequest, replyToContactMessage);
router.delete('/:id', param('id').isMongoId(), validateRequest, deleteContactMessage);

module.exports = router;