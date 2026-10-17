const express = require('express');
const { param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { getDoctorAdmissions, getAdmissionById, getAdmissionHistory } = require('./admissions.controller');

const router = express.Router();

router.get('/doctor', authMiddleware, roleMiddleware(['DOCTOR']), getDoctorAdmissions);

router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [param('id').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getAdmissionById
);

router.get(
  '/:id/history',
  authMiddleware,
  roleMiddleware(['DOCTOR', 'NURSE']),
  [param('id').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getAdmissionHistory
);

module.exports = router;

