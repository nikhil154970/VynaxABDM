const express = require('express');
const { param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { listMyNotifications, markRead, markAllRead } = require('./notifications.controller');

const router = express.Router();

router.get('/', authMiddleware, listMyNotifications);

router.patch('/read-all', authMiddleware, markAllRead);

router.patch(
  '/:id/read',
  authMiddleware,
  [param('id').isUUID().withMessage('Valid notification id is required')],
  validateRequest,
  markRead
);

module.exports = router;

