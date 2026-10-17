const express = require('express');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { getOpdAnalytics } = require('./opdAnalytics.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

// GET /api/admin/opd/analytics?from=&to=&department=&doctorId=
router.get('/analytics', ...adminOnly, getOpdAnalytics);

module.exports = router;
