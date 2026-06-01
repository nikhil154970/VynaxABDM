const express = require('express');
const { param, body } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  getDoctorAppointments,
  getTodayAppointments,
  listAppointments,
  patchAppointmentStatus,
} = require('./appointments.controller');

const router = express.Router();

// GET /api/appointments/doctor?date=YYYY-MM-DD
router.get('/doctor', authMiddleware, roleMiddleware(['DOCTOR']), getDoctorAppointments);

router.get('/today', authMiddleware, roleMiddleware(['DOCTOR']), getTodayAppointments);
router.get('/', authMiddleware, roleMiddleware(['DOCTOR']), listAppointments);

router.patch(
  '/:id/status',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [
    param('id').isUUID().withMessage('Valid appointment id is required'),
    body('status').isString().isLength({ min: 1 }).withMessage('status is required'),
  ],
  validateRequest,
  patchAppointmentStatus
);

module.exports = router;

