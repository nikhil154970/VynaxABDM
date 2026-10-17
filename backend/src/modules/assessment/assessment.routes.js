const express = require('express');
const { param, body } = require('express-validator');
const { validateRequest } = require('../../middleware/validateRequest');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const {
  submitPreOpAssessment,
  updatePreOpAssessment,
  getPreOpAssessment,
} = require('./assessment.controller');

const router = express.Router();

router.post(
  '/ot-request/:otRequestId',
  authMiddleware,
  roleMiddleware(['NURSE']),
  [
    param('otRequestId').isUUID().withMessage('Valid OT request id is required'),
    body('bpSystolic').optional({ values: 'falsy' }).isInt({ min: 40, max: 300 }),
    body('bpDiastolic').optional({ values: 'falsy' }).isInt({ min: 20, max: 200 }),
    body('pulse').optional({ values: 'falsy' }).isInt({ min: 20, max: 300 }),
    body('temperature').optional({ values: 'falsy' }).isFloat({ min: 30, max: 45 }),
    body('spo2').optional({ values: 'falsy' }).isInt({ min: 0, max: 100 }),
    body('respiratoryRate').optional({ values: 'falsy' }).isInt({ min: 0, max: 100 }),
    body('heightCm').optional({ values: 'falsy' }).isInt({ min: 1, max: 300 }),
    body('weightKg').optional({ values: 'falsy' }).isInt({ min: 1, max: 500 }),
    body('bmi').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }),
  ],
  validateRequest,
  submitPreOpAssessment
);

router.put(
  '/ot-request/:otRequestId',
  authMiddleware,
  roleMiddleware(['NURSE', 'OT_TECHNICIAN', 'SUPER_ADMIN']),
  [
    param('otRequestId').isUUID().withMessage('Valid OT request id is required'),
  ],
  validateRequest,
  updatePreOpAssessment
);

router.get(
  '/ot-request/:otRequestId',
  authMiddleware,
  roleMiddleware(['NURSE', 'OT_TECHNICIAN', 'RECEPTIONIST', 'SUPER_ADMIN']),
  [
    param('otRequestId').isUUID().withMessage('Valid OT request id is required'),
  ],
  validateRequest,
  getPreOpAssessment
);

module.exports = router;
