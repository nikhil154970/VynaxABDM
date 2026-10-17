const express = require('express');
const { param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { getHistoryByUHID, getFullHistoryByPatientId, searchPatients } = require('./patients.controller');
const { listPatientLabReports } = require('../../lab/lab.controller');

const router = express.Router();

router.get(
  '/search',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  validateRequest,
  searchPatients
);

router.get(
  '/:uhid/history',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [param('uhid').isString().isLength({ min: 1 }).withMessage('UHID is required')],
  validateRequest,
  getHistoryByUHID
);

router.get(
  '/:id/full-history',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [param('id').isUUID().withMessage('Patient id must be a valid uuid')],
  validateRequest,
  getFullHistoryByPatientId
);

router.get(
  '/:id/lab-reports',
  authMiddleware,
  roleMiddleware(['DOCTOR', 'RECEPTIONIST', 'NURSE', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Patient id must be a valid uuid')],
  validateRequest,
  listPatientLabReports
);

module.exports = router;

