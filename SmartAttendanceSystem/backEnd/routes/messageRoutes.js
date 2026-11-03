const router = require('express').Router();
const { param, query } = require('express-validator');
const { protect, employeeOnly } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/requestValidation');
const {
  listMyContactMessages,
  getMyContactMessage,
} = require('../controllers/contactMessageController');

router.use(protect, employeeOnly);
router.get('/mine', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validateRequest, listMyContactMessages);
router.get('/mine/:id', param('id').isMongoId(), validateRequest, getMyContactMessage);

module.exports = router;
