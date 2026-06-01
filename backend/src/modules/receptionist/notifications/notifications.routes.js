const express = require('express');
const { param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { listNotifications, markRead, markAllRead } = require('./notifications.controller');

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']), listNotifications);

router.patch('/read-all', authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']), markAllRead);

router.patch(
  '/:id/read',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid notification id is required')],
  validateRequest,
  markRead
);

module.exports = router;

