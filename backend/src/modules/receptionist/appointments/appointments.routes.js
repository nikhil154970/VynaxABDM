const express = require('express');
const { body, query, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  createAppointment,
  listAppointments,
  deleteAppointment,
  updateAppointment,
  getNextTokenPreview,
  getAppointmentById,
} = require('./appointments.controller');

const router = express.Router();

const receptionistOnly = [authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN'])];

// POST /api/receptionist/appointments
router.post(
  '/',
  ...receptionistOnly,
  [
    body('uhid').isString().isLength({ min: 1 }).withMessage('uhid is required'),
    body('doctorId').isUUID().withMessage('doctorId must be a valid uuid'),
    body('department').optional().isString(),
    body('date').isString().isLength({ min: 4 }).withMessage('date is required'),
    body('time').optional().isString(),
    body('timeSlot').optional().isString(),
    body('fee').optional().isInt({ min: 0 }).withMessage('fee must be a number'),
    body('paymentMode').optional().isString(),
    body('paymentStatus').optional().isString(),
  ],
  validateRequest,
  createAppointment
);

// GET /api/receptionist/appointments?q=&date=&department=&doctorId=&paymentStatus=&status=&page=&pageSize=
router.get(
  '/',
  ...receptionistOnly,
  [
    query('q').optional().isString(),
    query('date').optional().isString(),
    query('from').optional().isString(),
    query('to').optional().isString(),
    query('department').optional().isString(),
    query('doctorId').optional().isUUID(),
    query('paymentStatus').optional().isString(),
    query('status').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  listAppointments
);

// GET /api/receptionist/appointments/next-token?doctorId=&date=YYYY-MM-DD
router.get(
  '/next-token',
  ...receptionistOnly,
  [query('doctorId').isUUID().withMessage('doctorId must be a valid uuid'), query('date').isString().withMessage('date is required')],
  validateRequest,
  getNextTokenPreview
);

// GET /api/receptionist/appointments/:id
router.get(
  '/:id',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid appointment id is required')],
  validateRequest,
  getAppointmentById
);

// PUT /api/receptionist/appointments/:id
router.put(
  '/:id',
  ...receptionistOnly,
  [
    param('id').isUUID().withMessage('Valid appointment id is required'),
    body('doctorId').optional().isUUID().withMessage('doctorId must be a valid uuid'),
    body('department').optional().isString(),
    body('date').optional().isString(),
    body('time').optional().isString(),
    body('timeSlot').optional().isString(),
    body('fee').optional().isInt({ min: 0 }).withMessage('fee must be a number'),
    body('paymentMode').optional().isString(),
    body('paymentStatus').optional().isString(),
  ],
  validateRequest,
  updateAppointment
);

// DELETE /api/receptionist/appointments/:id
router.delete(
  '/:id',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid appointment id is required')],
  validateRequest,
  deleteAppointment
);

module.exports = router;

