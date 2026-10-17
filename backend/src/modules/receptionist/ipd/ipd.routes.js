const express = require('express');
const { body, query, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  listWards,
  listBeds,
  updateBedStatus,
  listNurseLookup,
  listActiveAdmissions,
  listPendingDoctorReferrals,
  fulfillDoctorReferral,
  listNurseApprovedDischargeQueue,
  getDischargeClearances,
  getAdmissionDetail,
  canAssignNurse,
  listAvailableNurses,
  createAdmission,
  transferBed,
  listTransferHistory,
  listDischargeHistory,
  dischargeAdmission,
  updateDischargeSummary,
  updateAdmissionNotes,
} = require('./ipd.controller');

const router = express.Router();
const receptionistOnly = [authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN'])];

// Masters
router.get('/wards', ...receptionistOnly, validateRequest, listWards);
router.get(
  '/beds',
  ...receptionistOnly,
  [
    query('wardId').optional().isUUID().withMessage('wardId must be a valid uuid'),
    query('status').optional().isString(),
  ],
  validateRequest,
  listBeds
);

router.patch(
  '/beds/:id/status',
  ...receptionistOnly,
  [
    param('id').isUUID().withMessage('Valid bed id is required'),
    body('status').isString().withMessage('status is required'),
  ],
  validateRequest,
  updateBedStatus
);

router.get('/nurses', ...receptionistOnly, [query('q').optional().isString()], validateRequest, listNurseLookup);

router.get('/discharge-queue', ...receptionistOnly, validateRequest, listNurseApprovedDischargeQueue);

router.get(
  '/discharges/history',
  ...receptionistOnly,
  [
    query('q').optional().isString(),
    query('doctorId').optional().isUUID(),
    query('fromDate').optional().isString(),
    query('toDate').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validateRequest,
  listDischargeHistory
);

// Active list + detail
router.get(
  '/referrals/pending-admit',
  ...receptionistOnly,
  [query('q').optional().isString()],
  validateRequest,
  listPendingDoctorReferrals
);

router.post(
  '/referrals/:id/fulfill',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid referral id is required')],
  validateRequest,
  fulfillDoctorReferral
);

router.get(
  '/active',
  ...receptionistOnly,
  [
    query('q').optional().isString(),
    query('wardId').optional().isUUID(),
    query('department').optional().isString(),
    query('doctorId').optional().isUUID(),
    query('status').optional().isString(),
  ],
  validateRequest,
  listActiveAdmissions
);

// Evening/night reception: nurse assignment (static paths before /admissions/:id)
router.get('/can-assign-nurse', ...receptionistOnly, validateRequest, canAssignNurse);
router.get('/available-nurses', ...receptionistOnly, validateRequest, listAvailableNurses);

router.get(
  '/admissions/:id/discharge-clearances',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getDischargeClearances
);

router.get(
  '/admissions/:id',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getAdmissionDetail
);

// Create admission (allocates bed)
router.post(
  '/admissions',
  ...receptionistOnly,
  [
    body('uhid').isString().isLength({ min: 1 }).withMessage('uhid is required'),
    body('doctorId').isUUID().withMessage('doctorId must be a valid uuid'),
    body('department').optional().isString(),
    body('admissionType').optional().isString(),
    body('admissionDate').optional().isString(),
    body('diagnosis').optional().isString(),
    body('notes').optional().isString(),
    body('expectedStay').optional().isString(),
    body('emergencyName').optional().isString(),
    body('emergencyPhone').optional().isString(),
    body('wardId').isUUID().withMessage('wardId must be a valid uuid'),
    body('bedId').isUUID().withMessage('bedId must be a valid uuid'),
    body('status').optional().isString(),
    body('billing').optional().isObject(),
    body('nurseId').optional().isUUID().withMessage('nurseId must be a valid uuid'),
  ],
  validateRequest,
  createAdmission
);

// Transfer bed
router.post(
  '/transfers',
  ...receptionistOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('toBedId').isUUID().withMessage('toBedId must be a valid uuid'),
    body('reason').optional().isString(),
  ],
  validateRequest,
  transferBed
);

// Transfer history (search + filters + pagination)
router.get(
  '/transfers/history',
  ...receptionistOnly,
  [
    query('q').optional().isString(),
    query('admissionId').optional().isUUID(),
    query('wardId').optional().isUUID(),
    query('fromWardId').optional().isUUID(),
    query('toWardId').optional().isUUID(),
    query('fromBedId').optional().isUUID(),
    query('toBedId').optional().isUUID(),
    query('fromDate').optional().isString(),
    query('toDate').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validateRequest,
  listTransferHistory
);

// Discharge
router.post(
  '/discharge/:id',
  ...receptionistOnly,
  [
    param('id').isUUID().withMessage('Valid admission id is required'),
    body('dischargeWithDues').optional().isBoolean().toBoolean(),
    body('dischargeSummary').optional(),
  ],
  validateRequest,
  dischargeAdmission
);

router.put(
  '/admissions/:id/discharge-summary',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  updateDischargeSummary
);

// Notes (receptionist quick note)
router.patch(
  '/admissions/:id/notes',
  ...receptionistOnly,
  [param('id').isUUID().withMessage('Valid admission id is required'), body('notesText').isString().isLength({ min: 1 })],
  validateRequest,
  updateAdmissionNotes
);

module.exports = router;

