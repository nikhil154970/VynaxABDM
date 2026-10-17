const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  listRecoveryPatients,
  getRecoveryDetails,
  saveRecoveryAssessment,
  getAssessmentHistory,
  getAvailableBedsByType,
  transferPatient,
  getTransferHistory,
  getRecoveryTimeline,
  requestReceptionTransfer,
} = require('./recovery.controller');

const router = express.Router();
const access = [authMiddleware, roleMiddleware(['OT_TECHNICIAN', 'SUPER_ADMIN', 'NURSE'])];

router.get('/patients', ...access, listRecoveryPatients);
router.get('/available-beds', ...access, getAvailableBedsByType);
router.get('/details/:sessionId', ...access, getRecoveryDetails);
router.get('/assessments/:sessionId', ...access, getAssessmentHistory);
router.get('/timeline/:sessionId', ...access, getRecoveryTimeline);
router.get('/transfers/:sessionId', ...access, getTransferHistory);

router.put(
  '/assessment/:sessionId',
  ...access,
  [param('sessionId').isUUID().withMessage('Valid session ID is required')],
  validateRequest,
  saveRecoveryAssessment
);

router.post(
  '/transfer',
  ...access,
  [
    body('sessionId').isUUID().withMessage('Session ID is required'),
    body('bedId').isUUID().withMessage('Bed ID is required'),
    body('wardId').isUUID().withMessage('Ward ID is required'),
  ],
  validateRequest,
  transferPatient
);

router.post(
  '/request-reception-transfer',
  ...access,
  [
    body('recoveryRecordId').isUUID().withMessage('Recovery record ID is required'),
    body('preferredWardType').optional().isString(),
  ],
  validateRequest,
  requestReceptionTransfer
);

module.exports = router;
