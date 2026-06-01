const express = require('express');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { getAdminOverview } = require('./dashboard.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

// GET /api/admin/dashboard/overview
router.get('/overview', ...adminOnly, getAdminOverview);

module.exports = router;

