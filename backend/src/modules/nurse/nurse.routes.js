const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../middleware/validateRequest');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const {
  listMyPatients,
  getPatientByAdmission,
  getDoctorUpdatesForAdmission,
  getVitalsHistoryByAdmission,
  postVitals,
  postNursingNote,
  putNursingNote,
  deleteNursingNote,
  listRecentNursingNotes,
  putNurseCareData,
  putClinicalCondition,
  putDischargeApprove,
} = require('./nurse.controller');

const router = express.Router();
const nurseOnly = [authMiddleware, roleMiddleware(['NURSE'])];

router.get('/my-patients', ...nurseOnly, listMyPatients);

router.get('/recent-notes', ...nurseOnly, listRecentNursingNotes);

router.get(
  '/patient/:admissionId/doctor-updates',
  ...nurseOnly,
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getDoctorUpdatesForAdmission
);

router.get(
  '/patient/:admissionId',
  ...nurseOnly,
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getPatientByAdmission
);

router.post(
  '/vitals',
  ...nurseOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('bp').isString().isLength({ min: 1 }).withMessage('bp is required'),
    body('temp').optional(),
    body('pulse').optional(),
    body('spo2').optional(),
    body('oxygen').optional().isString(),
    body('oxygenTherapy').optional().isString(),
  ],
  validateRequest,
  postVitals
);

// Read-only: allow NURSE and DOCTOR to view vitals history for an admission.
router.get(
  '/vitals/:admissionId',
  authMiddleware,
  roleMiddleware(['NURSE', 'DOCTOR']),
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getVitalsHistoryByAdmission
);

router.post(
  '/notes',
  ...nurseOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('notes').isString().isLength({ min: 1 }).withMessage('notes is required'),
  ],
  validateRequest,
  postNursingNote
);

router.put(
  '/notes/:noteId',
  ...nurseOnly,
  [
    param('noteId').isUUID().withMessage('noteId must be a valid uuid'),
    body('notes').isString().isLength({ min: 1 }).withMessage('notes is required'),
  ],
  validateRequest,
  putNursingNote
);

router.delete(
  '/notes/:noteId',
  ...nurseOnly,
  [param('noteId').isUUID().withMessage('noteId must be a valid uuid')],
  validateRequest,
  deleteNursingNote
);

router.put(
  '/clinical-data',
  ...nurseOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('nurseCare').isObject().withMessage('nurseCare must be an object'),
  ],
  validateRequest,
  putNurseCareData
);

router.put(
  '/condition',
  ...nurseOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('condition').isString().isLength({ min: 1 }).withMessage('condition is required'),
    body('diagnosis').optional().isString(),
  ],
  validateRequest,
  putClinicalCondition
);

router.put(
  '/discharge-approve',
  ...nurseOnly,
  [body('admissionId').isUUID().withMessage('admissionId must be a valid uuid')],
  validateRequest,
  putDischargeApprove
);

module.exports = router;
