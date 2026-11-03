const router = require('express').Router();
const { body } = require('express-validator');
const { contactRateLimit } = require('../middleware/apiSecurity');
const { validateRequest } = require('../middleware/requestValidation');
const { optionalProtect } = require('../middleware/authMiddleware');
const { submitContactMessage } = require('../controllers/contactMessageController');

router.post('/', contactRateLimit, [
  body('fullName').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isString().trim().isEmail().normalizeEmail(),
  body('subject').isString().trim().isLength({ min: 2, max: 160 }),
  body('message').isString().trim().isLength({ min: 5, max: 10000 }),
  body('submissionId').optional().isUUID(),
], validateRequest, optionalProtect, submitContactMessage);

module.exports = router;