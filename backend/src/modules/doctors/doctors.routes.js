const express = require('express');
const { body, param } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');

const {
  listDoctors,
  listDoctorLookup,
  getMyDoctorProfile,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  patchDoctorStatus,
  listAvailability,
  upsertAvailability,
} = require('./doctors.controller');

const router = express.Router();

// Doctor self profile (must be defined before "/:id")
router.get('/me', authMiddleware, roleMiddleware(['DOCTOR']), getMyDoctorProfile);

// Lightweight list for receptionist appointment booking
router.get('/lookup', authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']), listDoctorLookup);

router.get('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), listDoctors);
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid doctor id is required')],
  validateRequest,
  getDoctor
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    body('name').isString().isLength({ min: 2 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('status must be "active" or "inactive"'),
    body('specialization').isString().isLength({ min: 2 }).withMessage('Specialization is required'),
    body('qualification').isString().isLength({ min: 2 }).withMessage('Qualification is required'),
    body('experienceYears').isInt({ min: 0, max: 80 }).withMessage('experienceYears must be 0-80'),
    body('phone').isString().isLength({ min: 5 }).withMessage('Phone is required'),
    body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('gender must be MALE/FEMALE/OTHER'),
  ],
  validateRequest,
  createDoctor
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid doctor id is required'),
    body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 chars'),
    body('email').optional().isEmail().withMessage('Email must be valid'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('status must be "active" or "inactive"'),
    body('specialization').optional().isString().isLength({ min: 2 }).withMessage('Specialization must be at least 2 chars'),
    body('qualification').optional().isString().isLength({ min: 2 }).withMessage('Qualification must be at least 2 chars'),
    body('experienceYears').optional().isInt({ min: 0, max: 80 }).withMessage('experienceYears must be 0-80'),
    body('phone').optional().isString().isLength({ min: 5 }).withMessage('phone must be at least 5 chars'),
    body('gender').optional().isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('gender must be MALE/FEMALE/OTHER'),
  ],
  validateRequest,
  updateDoctor
);

router.patch(
  '/:id/status',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid doctor id is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('status must be "active" or "inactive"'),
  ],
  validateRequest,
  patchDoctorStatus
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid doctor id is required')],
  validateRequest,
  deleteDoctor
);

router.get(
  '/:id/availability',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid doctor id is required')],
  validateRequest,
  listAvailability
);

router.put(
  '/:id/availability',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid doctor id is required'),
    body('slots').isArray({ min: 1 }).withMessage('slots must be a non-empty array'),
    body('slots.*.dayOfWeek')
      .isIn(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
      .withMessage('dayOfWeek is invalid'),
    body('slots.*.startTime').optional().isString().isLength({ min: 1 }).withMessage('startTime is required'),
    body('slots.*.endTime').optional().isString().isLength({ min: 1 }).withMessage('endTime is required'),
    body('slots.*.isAvailable').optional().isBoolean().withMessage('isAvailable must be boolean'),
  ],
  validateRequest,
  upsertAvailability
);

// Spec endpoint (kept alongside PUT for compatibility)
router.post(
  '/:id/availability',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid doctor id is required'),
    body('slots').isArray({ min: 1 }).withMessage('slots must be a non-empty array'),
    body('slots.*.dayOfWeek')
      .isIn(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
      .withMessage('dayOfWeek is invalid'),
    body('slots.*.startTime').optional().isString().isLength({ min: 1 }).withMessage('startTime is required'),
    body('slots.*.endTime').optional().isString().isLength({ min: 1 }).withMessage('endTime is required'),
    body('slots.*.isAvailable').optional().isBoolean().withMessage('isAvailable must be boolean'),
  ],
  validateRequest,
  upsertAvailability
);

module.exports = router;

