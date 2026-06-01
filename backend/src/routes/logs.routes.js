const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { listLogs } = require('../controllers/logs.controller');

const router = express.Router();

// Admin audit logs
router.get('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), listLogs);

module.exports = router;

