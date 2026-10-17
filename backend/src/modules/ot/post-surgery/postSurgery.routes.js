const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  getPostSurgeryNotes,
  savePostSurgeryNotes,
  addFollowUp,
  getFollowUpHistory,
  addComplication,
  getComplicationHistory,
  getAuditTrail,
} = require('./postSurgery.controller');

const router = express.Router();
const access = [authMiddleware, roleMiddleware(['OT_TECHNICIAN', 'SUPER_ADMIN', 'NURSE'])];

router.get('/notes/:sessionId', ...access, getPostSurgeryNotes);
router.get('/followups/:sessionId', ...access, getFollowUpHistory);
router.get('/complications/:sessionId', ...access, getComplicationHistory);
router.get('/audit-trail/:sessionId', ...access, getAuditTrail);

router.put(
  '/notes/:sessionId',
  ...access,
  [param('sessionId').isUUID().withMessage('Valid session ID is required')],
  validateRequest,
  savePostSurgeryNotes
);

router.post(
  '/followup/:sessionId',
  ...access,
  [param('sessionId').isUUID().withMessage('Valid session ID is required')],
  validateRequest,
  addFollowUp
);

router.post(
  '/complication/:sessionId',
  ...access,
  [
    param('sessionId').isUUID().withMessage('Valid session ID is required'),
    body('complicationType').notEmpty().withMessage('Complication type is required'),
    body('severity').notEmpty().withMessage('Severity is required'),
  ],
  validateRequest,
  addComplication
);

module.exports = router;
