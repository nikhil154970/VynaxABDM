const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { listPendingTransfers, completeRecoveryTransfer } = require('./recoveryTransfer.controller');

const router = express.Router();
const access = [authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN'])];

router.get('/pending', ...access, listPendingTransfers);

router.post(
  '/:recoveryRecordId/complete',
  ...access,
  [
    param('recoveryRecordId').isUUID().withMessage('Valid recovery record ID is required'),
    body('wardId').isUUID().withMessage('Ward ID is required'),
    body('bedId').isUUID().withMessage('Bed ID is required'),
  ],
  validateRequest,
  completeRecoveryTransfer
);

module.exports = router;
