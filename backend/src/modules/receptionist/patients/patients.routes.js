const express = require('express');
const { query, param, body } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  registerPatient,
  listPatients,
  searchPatients,
  getPatientDetails,
  admitPatient,
} = require('./patients.controller');

const router = express.Router();

const receptionistOnly = [authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN'])];

router.post(
  '/register',
  ...receptionistOnly,
  [
    body('fullName').optional().isString(),
    body('name').optional().isString(),
    body('phone').optional().isString(),
    body('mobile').optional().isString(),
    body('dob').optional().isString().isLength({ min: 4 }),
    body('age').optional().isInt({ min: 0 }),
    body('visitId').optional().isString(),
    body('gender').isString().isLength({ min: 1 }).withMessage('gender is required'),
    body('address').isString().isLength({ min: 1 }).withMessage('address is required'),
    body('emergencyRelation').optional().isString(),
    body('referBy').optional().isString(),
    body('sponsor').optional().isString(),
  ],
  validateRequest,
  registerPatient
);

router.get(
  '/',
  ...receptionistOnly,
  [
    query('q').optional().isString(),
    query('visitType').optional().isString(),
    query('gender').optional().isString(),
    query('department').optional().isString(),
    query('date').optional().isString(),
    query('dateFrom').optional().isString(),
    query('dateTo').optional().isString(),
    query('export').optional().isIn(['1']),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().custom((value, { req }) => {
      const n = Number.parseInt(value, 10);
      const forExport = String(req.query.export || '') === '1';
      const max = forExport ? 5000 : 50;
      if (!Number.isFinite(n) || n < 1 || n > max) {
        throw new Error(`pageSize must be between 1 and ${max}`);
      }
      return true;
    }),
  ],
  validateRequest,
  listPatients
);

router.get(
  '/search',
  ...receptionistOnly,
  [query('q').optional().isString()],
  validateRequest,
  searchPatients
);

router.get(
  '/:uhid/details',
  ...receptionistOnly,
  [param('uhid').isString().isLength({ min: 1 }).withMessage('UHID is required')],
  validateRequest,
  getPatientDetails
);

router.patch(
  '/:uhid/admit',
  ...receptionistOnly,
  [param('uhid').isString().isLength({ min: 1 }).withMessage('UHID is required')],
  validateRequest,
  admitPatient
);

module.exports = router;

