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
  createOtRequest,
  listMyOtRequests,
  getOtRequestByAdmission,
  listOtPatients,
  getOtPatientDetail,
  getMyDuty,
  completePatientCare,
  listMyTasks,
  createTask,
  completeTask,
  deleteTask,
  listMyDoctorOrders,
  createDoctorOrder,
  completeDoctorOrder,
  deleteDoctorOrder,
  getOtAssessmentsByAdmission,
  createMedicineRequest,
  listMedicineRequests,
  cancelMedicineRequest,
  createDailyExpense,
  listDailyExpenses,
  deleteDailyExpense,
} = require('./nurse.controller');
const { prisma } = require('../../config/prisma');

const router = express.Router();
const nurseOnly = [authMiddleware, roleMiddleware(['NURSE'])];

router.get('/my-patients', ...nurseOnly, listMyPatients);
router.get('/my-duty', ...nurseOnly, getMyDuty);

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

router.post(
  '/ot-request',
  ...nurseOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('diagnosis').optional().isString(),
    body('surgeryRecommendation').optional().isString(),
    body('expectedSurgeryDate').optional().isISO8601().withMessage('expectedSurgeryDate must be a valid date'),
    body('priority').optional().isIn(['Normal', 'Urgent']).withMessage('priority must be Normal or Urgent'),
    body('notes').optional().isString(),
  ],
  validateRequest,
  createOtRequest
);

router.get(
  '/ot-requests',
  ...nurseOnly,
  listMyOtRequests
);

router.get(
  '/ot-request/by-admission/:admissionId',
  ...nurseOnly,
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getOtRequestByAdmission
);

// ─── OT Patients (post-surgery, assigned to this nurse) ───

router.get('/ot-patients', ...nurseOnly, listOtPatients);

router.get(
  '/ot-patients/:id',
  ...nurseOnly,
  [param('id').isUUID().withMessage('Valid recovery record id is required')],
  validateRequest,
  getOtPatientDetail
);

// ─── Complete Patient Care ───
router.put(
  '/ipd/assigned/:admissionId/complete',
  ...nurseOnly,
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  completePatientCare
);

// ─── List All Nurses ───
router.get('/nurses', ...nurseOnly, async (req, res) => {
  try {
    const nurses = await prisma.user.findMany({
      where: { role: 'NURSE', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ nurses });
  } catch (err) {
    console.error('listNurses error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Nurse Notifications ───

router.get('/notifications', ...nurseOnly, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ notifications });
  } catch (err) {
    console.error('list nurse notifications error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/notifications/:id/read', ...nurseOnly, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    await prisma.notification.update({ where: { id: req.params.id, userId }, data: { readAt: new Date() } });
    return res.json({ message: 'Marked as read' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/notifications/read-all', ...nurseOnly, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return res.json({ message: 'All marked as read' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Nurse Tasks ────────────────────────────────────────────────────────

router.get('/my-tasks', ...nurseOnly, listMyTasks);
router.post('/my-tasks', ...nurseOnly, createTask);
router.patch('/my-tasks/:id/complete', ...nurseOnly, completeTask);
router.delete('/my-tasks/:id', ...nurseOnly, deleteTask);

// ─── Doctor Orders ──────────────────────────────────────────────────────

router.get('/doctor-orders', ...nurseOnly, listMyDoctorOrders);
router.post('/doctor-orders', ...nurseOnly, createDoctorOrder);
router.patch('/doctor-orders/:id/complete', ...nurseOnly, completeDoctorOrder);
router.delete('/doctor-orders/:id', ...nurseOnly, deleteDoctorOrder);

// ─── IPD Medicine Requests (nurse → pharmacy) ───────────────────────────

router.post(
  '/medicine-request',
  ...nurseOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  ],
  validateRequest,
  createMedicineRequest
);

router.get(
  '/medicine-request/:admissionId',
  ...nurseOnly,
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  listMedicineRequests
);

router.post(
  '/medicine-request/:id/cancel',
  ...nurseOnly,
  [param('id').isString().isLength({ min: 6 })],
  validateRequest,
  cancelMedicineRequest
);

// ─── IPD Daily Expenses (nurse) ─────────────────────────────────────────

router.post(
  '/daily-expense',
  ...nurseOnly,
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('description').isString().isLength({ min: 1 }).withMessage('description is required'),
  ],
  validateRequest,
  createDailyExpense
);

router.get(
  '/daily-expense/:admissionId',
  ...nurseOnly,
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  listDailyExpenses
);

router.delete(
  '/daily-expense/:id',
  ...nurseOnly,
  [param('id').isUUID().withMessage('Valid expense id is required')],
  validateRequest,
  deleteDailyExpense
);

// ─── OT Assessments (pre + post) ────────────────────────────────────────

router.get(
  '/patient/:admissionId/ot-assessments',
  ...nurseOnly,
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  getOtAssessmentsByAdmission
);

module.exports = router;
