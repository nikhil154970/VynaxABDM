const express = require('express');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { getIpdAnalytics } = require('./ipdAnalytics.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

router.get('/analytics', ...adminOnly, getIpdAnalytics);

module.exports = router;
