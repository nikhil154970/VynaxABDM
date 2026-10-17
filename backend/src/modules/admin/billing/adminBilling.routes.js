const express = require('express');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { listAdminBills } = require('./adminBilling.controller');
const { getRevenueAnalytics } = require('./revenueAnalytics.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

router.get('/bills', ...adminOnly, listAdminBills);
router.get('/analytics', ...adminOnly, getRevenueAnalytics);

module.exports = router;
