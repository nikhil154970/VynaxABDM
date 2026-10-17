const express = require('express');
const { param, body } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { createConsultation, getConsultationsByPatient, getLatestConsultationByAppointment } = require('./consultations.controller');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [
    body('patient_id').optional().isUUID().withMessage('patient_id must be a valid uuid'),
    body('patientId').optional().isUUID().withMessage('patientId must be a valid uuid'),
    body('symptoms').isString().isLength({ min: 1 }).withMessage('symptoms is required'),
    body('diagnosis').isString().isLength({ min: 1 }).withMessage('diagnosis is required'),
    body('prescription').isArray({ min: 1 }).withMessage('prescription must be a non-empty array'),
    body('follow_up_date').optional().isString().isLength({ min: 1 }).withMessage('follow_up_date must be a string date'),
    body('followUpDate').optional().isString().isLength({ min: 1 }).withMessage('followUpDate must be a string date'),
    body('appointment_id').optional().isUUID().withMessage('appointment_id must be a valid uuid'),
    body('appointmentId').optional().isUUID().withMessage('appointmentId must be a valid uuid'),
    body('disposition').optional().isIn(['NORMAL', 'REFER_ADMIT', 'REFER_DEPT']).withMessage('disposition must be NORMAL, REFER_ADMIT or REFER_DEPT'),
    body('referredDepartment').optional({ nullable: true }).isString(),
    body('referred_department').optional({ nullable: true }).isString(),
    body('referredDoctorId').optional({ nullable: true }).isUUID().withMessage('referredDoctorId must be a valid uuid'),
    body('referred_doctor_id').optional({ nullable: true }).isUUID().withMessage('referred_doctor_id must be a valid uuid'),
  ],
  validateRequest,
  createConsultation
);

router.get(
  '/:patient_id',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [param('patient_id').isUUID().withMessage('patient_id must be a valid uuid')],
  validateRequest,
  getConsultationsByPatient
);

router.get(
  '/appointment/:appointment_id',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [param('appointment_id').isUUID().withMessage('appointment_id must be a valid uuid')],
  validateRequest,
  getLatestConsultationByAppointment
);

module.exports = router;

