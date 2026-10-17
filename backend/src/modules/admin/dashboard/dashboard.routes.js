const express = require('express');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  getAdminOverview,
  getRevenueSnapshot,
  getCriticalAlerts,
  markAlertRead,
  markAllAlertsRead,
} = require('./dashboard.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

// GET /api/admin/dashboard/overview
router.get('/overview', ...adminOnly, getAdminOverview);
// GET /api/admin/dashboard/revenue-snapshot
router.get('/revenue-snapshot', ...adminOnly, getRevenueSnapshot);

// Critical alerts
router.get('/alerts/critical', ...adminOnly, getCriticalAlerts);
router.patch('/alerts/read-all', ...adminOnly, markAllAlertsRead);
router.patch('/alerts/:id/read', ...adminOnly, markAlertRead);

module.exports = router;

