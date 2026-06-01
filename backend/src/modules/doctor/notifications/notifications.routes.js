const express = require('express');
const { param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { listMyNotifications, markRead } = require('./notifications.controller');

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['DOCTOR']), listMyNotifications);

router.patch(
  '/:id/read',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [param('id').isUUID().withMessage('Valid notification id is required')],
  validateRequest,
  markRead
);

module.exports = router;

