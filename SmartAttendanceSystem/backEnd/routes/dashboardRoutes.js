const router = require('express').Router();
const { getStats } = require('../controllers/dashboardController');
const { protect, adminOrHR } = require('../middleware/authMiddleware');

router.get('/stats', protect, adminOrHR, getStats);

module.exports = router;
