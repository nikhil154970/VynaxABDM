const express = require('express');
const { body, query, param } = require('express-validator');
const { validateRequest } = require('../../middleware/validateRequest');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const {
  listCatalog,
  listTestsSimple,
  createManagedLabTest,
  updateManagedLabTest,
  deleteManagedLabTest,
  listManagedLabCategories,
  createManagedLabCategory,
  renameManagedLabCategory,
  deleteManagedLabCategory,
  listPendingTestAdvice,
  confirmTestAdvice,
  listReceptionistPendingOrders,
  getReceptionistOrderDetail,
  approveReceptionistOrderAndGenerateBill,
  createReceptionistLabBill,
  listReceptionistLabBills,
  listLabWorkOrders,
  listLabRequests,
  getLabOrderDetail,
  submitLabResults,
  createRepeatLabOrder,
  collectLabRequest,
  startLabRequest,
  getLabReportByRequestId,
  postLabReports,
  listCustomParams,
  createCustomParam,
  deleteCustomParam,
  listNurseLabAdvice,
  createNurseLabAdvice,
} = require('./lab.controller');
const labNotificationsRoutes = require('./notifications/notifications.routes');

const router = express.Router();

router.use('/notifications', labNotificationsRoutes);

// Catalog (doctor/receptionist/lab can read)
router.get(
  '/catalog',
  authMiddleware,
  roleMiddleware(['DOCTOR', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'NURSE', 'SUPER_ADMIN']),
  [query('q').optional().isString(), query('category').optional().isString()],
  validateRequest,
  listCatalog,
);

router.get(
  '/tests',
  authMiddleware,
  roleMiddleware(['DOCTOR', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'NURSE', 'SUPER_ADMIN']),
  [
    query('admin').optional().isString(),
    query('forBilling').optional().isString(),
    query('category').optional().isString(),
  ],
  validateRequest,
  listTestsSimple,
);

// ─── Nurse IPD lab advice ───
router.get(
  '/advice/nurse/:admissionId',
  authMiddleware,
  roleMiddleware(['NURSE', 'SUPER_ADMIN']),
  [param('admissionId').isUUID().withMessage('Valid admission id is required')],
  validateRequest,
  listNurseLabAdvice,
);

router.post(
  '/advice/nurse',
  authMiddleware,
  roleMiddleware(['NURSE', 'SUPER_ADMIN']),
  [
    body('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('testIds').isArray({ min: 1 }).withMessage('Select at least one test'),
    body('testIds.*').isInt({ min: 1 }).withMessage('Invalid test id'),
    body('clinicalNote').optional().isString(),
  ],
  validateRequest,
  createNurseLabAdvice,
);

router.post(
  '/tests',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    body('name').isString().trim().isLength({ min: 1 }),
    body('category').optional({ values: 'null' }).isString().trim(),
    body('price').isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  createManagedLabTest,
);

router.put(
  '/tests/:id',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().isString().trim().isLength({ min: 1 }),
    body('category').optional().isString().trim().isLength({ min: 1 }),
    body('price').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  updateManagedLabTest,
);

router.delete(
  '/tests/:id',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteManagedLabTest,
);

router.get(
  '/categories',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  listManagedLabCategories,
);

router.post(
  '/categories',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [body('name').trim().notEmpty().withMessage('Name required').isLength({ min: 2, max: 80 })],
  validateRequest,
  createManagedLabCategory,
);

router.put(
  '/categories/rename',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    body('from').isString().trim().isLength({ min: 1, max: 80 }),
    body('to').isString().trim().isLength({ min: 2, max: 80 }),
  ],
  validateRequest,
  renameManagedLabCategory,
);

router.delete(
  '/categories',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [body('name').isString().trim().isLength({ min: 1, max: 80 })],
  validateRequest,
  deleteManagedLabCategory,
);

router.get(
  '/advice/pending',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [query('uhid').optional().isString()],
  validateRequest,
  listPendingTestAdvice,
);

router.post(
  '/confirm',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [body('advice_id').optional().isInt({ min: 1 }), body('adviceId').optional().isInt({ min: 1 })],
  validateRequest,
  confirmTestAdvice,
);

// Receptionist approvals
router.get(
  '/receptionist/orders',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [query('q').optional().isString()],
  validateRequest,
  listReceptionistPendingOrders,
);

router.get(
  '/receptionist/orders/:id',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid order id required')],
  validateRequest,
  getReceptionistOrderDetail,
);

router.post(
  '/receptionist/orders/:id/approve',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid order id required'),
    body('notes').optional().isString(),
  ],
  validateRequest,
  approveReceptionistOrderAndGenerateBill,
);

router.get(
  '/receptionist/bills',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [query('q').optional().isString(), query('dueOnly').optional().isString()],
  validateRequest,
  listReceptionistLabBills,
);

router.post(
  '/receptionist/bills',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [
    body('uhid').optional().isString(),
    body('patientId').optional().isUUID(),
    body('doctorId').optional().isUUID(),
    body('tests').isArray({ min: 1 }).withMessage('At least one test name is required'),
    body('tests.*.name').optional().isString(),
    body('tests.*.testId').optional().isInt({ min: 1 }),
    body('tests.*.price').optional().isFloat({ min: 0 }),
    body('totalAmount').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
    body('paymentMode').optional().isString(),
    body('paidAmount').optional().isFloat({ min: 0 }),
  ],
  validateRequest,
  createReceptionistLabBill,
);

// Lab work queue
router.get(
  '/requests',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  [query('q').optional().isString(), query('status').optional().isString()],
  validateRequest,
  listLabRequests,
);

router.put(
  '/requests/:id/collect',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid request id required')],
  validateRequest,
  collectLabRequest,
);

router.put(
  '/requests/:id/start',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid request id required')],
  validateRequest,
  startLabRequest,
);

router.get(
  '/reports/:requestId',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'SUPER_ADMIN']),
  [param('requestId').isUUID().withMessage('Valid request id required')],
  validateRequest,
  getLabReportByRequestId,
);

router.post(
  '/reports',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  [
    body('requestId').isUUID().withMessage('requestId (lab order id) required'),
    body('results').isArray({ min: 1 }).withMessage('results array required'),
    body('results.*.testName').isString().isLength({ min: 1 }),
    body('results.*.value').isString().isLength({ min: 1 }),
    body('results.*.unit').optional().isString(),
    body('results.*.referenceRange').optional().isString(),
    body('results.*.remarks').optional().isString(),
    body('results.*.fileUrl').optional().isString(),
    body('overallRemarks').optional().isString(),
    body('diagnosis').optional().isString(),
    body('verifiedBy').optional().isString(),
    body('approvedBy').optional().isString(),
    body('reportStatus').optional().isString(),
  ],
  validateRequest,
  postLabReports,
);

router.get(
  '/orders',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'RECEPTIONIST', 'DOCTOR', 'SUPER_ADMIN']),
  [query('q').optional().isString(), query('status').optional().isString()],
  validateRequest,
  listLabWorkOrders,
);

router.get(
  '/orders/:id',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid order id required')],
  validateRequest,
  getLabOrderDetail,
);

router.post(
  '/orders/:id/repeat',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid order id required')],
  validateRequest,
  createRepeatLabOrder,
);

router.post(
  '/orders/:id/results',
  authMiddleware,
  roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid order id required'),
    body('results').isArray({ min: 1 }).withMessage('results array required'),
    body('results.*.testName').isString().isLength({ min: 1 }),
    body('results.*.value').isString().isLength({ min: 1 }),
    body('results.*.unit').optional().isString(),
    body('results.*.referenceRange').optional().isString(),
    body('results.*.remarks').optional().isString(),
    body('results.*.fileUrl').optional().isString(),
    body('overallRemarks').optional().isString(),
    body('diagnosis').optional().isString(),
    body('verifiedBy').optional().isString(),
    body('approvedBy').optional().isString(),
    body('reportStatus').optional().isString(),
  ],
  validateRequest,
  submitLabResults,
);

// Custom test parameters (lab technician can manage)
router.get('/custom-params', authMiddleware, roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']), listCustomParams);
router.post('/custom-params', authMiddleware, roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']), body('department').notEmpty(), body('testName').notEmpty(), body('parameter').notEmpty(), validateRequest, createCustomParam);
router.delete('/custom-params/:id', authMiddleware, roleMiddleware(['LAB_TECHNICIAN', 'SUPER_ADMIN']), deleteCustomParam);

module.exports = router;

