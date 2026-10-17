const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  getMyScheduledSurgeries,
  getSurgeryReportData,
  saveSurgeryReportDraft,
  completeSurgery,
  getMyRecoveryPatients,
  getRecoveryDetail,
  getRecoveryAssessments,
  getRecoveryTimeline,
} = require('./otSchedule.controller');

const router = express.Router();
const access = [authMiddleware, roleMiddleware(['DOCTOR', 'SUPER_ADMIN'])];

router.get('/schedule', ...access, getMyScheduledSurgeries);

router.get('/report-data/:scheduleId', ...access, getSurgeryReportData);

router.post(
  '/report-draft',
  ...access,
  [
    body('scheduleId').isUUID().withMessage('Valid schedule ID is required'),
    body('report').isObject().withMessage('Report data is required'),
  ],
  validateRequest,
  saveSurgeryReportDraft
);

router.post(
  '/complete',
  ...access,
  [
    body('scheduleId').isUUID().withMessage('Valid schedule ID is required'),
    body('report').isObject().withMessage('Report data is required'),
  ],
  validateRequest,
  completeSurgery
);

router.get('/recovery', ...access, getMyRecoveryPatients);

router.get('/recovery/:sessionId', ...access, getRecoveryDetail);

router.get('/recovery/:sessionId/assessments', ...access, getRecoveryAssessments);

router.get('/recovery/:sessionId/timeline', ...access, getRecoveryTimeline);

module.exports = router;
