const express = require('express');
const { query, param, body } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  listBills,
  getBillDetail,
  getBillingContext,
  listPatientPayments,
  getPatientLedger,
  getAdmissionPharmacyBills,
  collectAdmissionPackage,
  createBill,
  addBillPayment,
} = require('./billing.controller');

const router = express.Router();
const receptionistOnly = [authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN'])];

router.get(
  '/context',
  ...receptionistOnly,
  [query('patientId').isUUID().withMessage('patientId must be a valid uuid')],
  validateRequest,
  getBillingContext
);

router.get(
  '/',
  ...receptionistOnly,
  [
    query('q').optional().isString(),
    query('visitType').optional().isString(),
    query('paymentStatus').optional().isString(),
    query('paymentMode').optional().isString(),
    query('dateFrom').optional().isString(),
    query('dateTo').optional().isString(),
  ],
  validateRequest,
  listBills
);

router.get(
  '/patient-payments',
  ...receptionistOnly,
  [query('patientId').isUUID().withMessage('patientId must be a valid uuid')],
  validateRequest,
  listPatientPayments
);

router.get(
  '/patient-ledger',
  ...receptionistOnly,
  [query('patientId').isUUID().withMessage('patientId must be a valid uuid')],
  validateRequest,
  getPatientLedger
);

router.get(
  '/pharmacy-bills',
  ...receptionistOnly,
  [
    query('patientId').optional().isUUID().withMessage('patientId must be a valid uuid'),
    query('admissionId').optional().isUUID().withMessage('admissionId must be a valid uuid'),
  ],
  validateRequest,
  getAdmissionPharmacyBills
);

router.get('/:id', ...receptionistOnly, [param('id').isUUID().withMessage('id must be a valid uuid')], validateRequest, getBillDetail);

router.post(
  '/',
  ...receptionistOnly,
  [
    body('patientId').isUUID().withMessage('patientId must be a valid uuid'),
    body('visitType').optional().isString(),
    body('billingType').optional().isString(),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  ],
  validateRequest,
  createBill
);

router.post(
  '/admissions/:admissionId/collect',
  ...receptionistOnly,
  [
    param('admissionId').isUUID().withMessage('admissionId must be a valid uuid'),
    body('amount').optional().isInt({ min: 0 }),
    body('mode').optional().isString(),
  ],
  validateRequest,
  collectAdmissionPackage
);

router.post(
  '/:id/payments',
  ...receptionistOnly,
  [
    param('id').isUUID().withMessage('id must be a valid uuid'),
    body('amount').isInt({ min: 1 }).withMessage('amount is required'),
    body('mode').optional().isString(),
    body('paymentMode').optional().isString(),
    body('note').optional().isString(),
  ],
  validateRequest,
  addBillPayment
);

module.exports = router;
