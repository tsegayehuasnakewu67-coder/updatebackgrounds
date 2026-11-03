const router = require('express').Router();
const {
  getCompanyAttendance,
  getAnalytics,
} = require('../controllers/attendanceController');
const { protect, adminOrHR } = require('../middleware/authMiddleware');

router.use(protect);
router.use(adminOrHR);

// GET /api/reports           — daily attendance log (joined department)
// GET /api/reports/analytics — weekly / monthly / yearly summaries
router.get('/analytics', getAnalytics);
router.get('/',          getCompanyAttendance);

module.exports = router;
