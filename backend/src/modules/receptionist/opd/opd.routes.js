const express = require('express');
const { query, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  getTodayOPD,
  listHistoryPatients,
  getPatientTimeline,
  getOpdAppointmentDetails,
} = require('./opd.controller');

const router = express.Router();

const receptionistOnly = [authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN'])];

// GET /api/receptionist/opd/today?date=YYYY-MM-DD
router.get(
  '/today',
  ...receptionistOnly,
  [query('date').optional().isString()],
  validateRequest,
  getTodayOPD,
);

// GET /api/receptionist/opd/history/patients?q=
router.get(
  '/history/patients',
  ...receptionistOnly,
  [query('q').optional().isString()],
  validateRequest,
  listHistoryPatients,
);

// GET /api/receptionist/opd/history/:uhid?from=&to=&doctor=&department=&visitType=
router.get(
  '/history/:uhid',
  ...receptionistOnly,
  [param('uhid').isString().isLength({ min: 1 }).withMessage('UHID is required')],
  validateRequest,
  getPatientTimeline,
);

// GET /api/receptionist/opd/appointment/:id
router.get(
  '/appointment/:id',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid appointment id is required')],
  validateRequest,
  getOpdAppointmentDetails,
);

module.exports = router;

