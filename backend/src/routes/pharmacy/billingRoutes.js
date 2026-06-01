const express = require('express');
const { param, query } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  searchInventory,
  searchPatients,
  getBillingStats,
  getBills,
  getBillById,
  createBill,
  updateBill,
  cancelBill,
  getPatientDues,
  getBillPrint,
} = require('../../controllers/pharmacy/billingController');

const router = express.Router();
const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];
const pharmacistOrReception = [
  authMiddleware,
  roleMiddleware(['PHARMACIST', 'SUPER_ADMIN', 'RECEPTIONIST']),
];

// Allow Receptionist to search inventory only for "Send to Pharmacy" flow.
router.get('/inventory/search', pharmacistOrReception, searchInventory);
router.get('/patients/search', pharmacistOnly, searchPatients);
router.get('/stats', pharmacistOnly, getBillingStats);

router.get(
  '/patient/:patientId/dues',
  pharmacistOrReception,
  [param('patientId').isUUID()],
  validateRequest,
  getPatientDues
);

router.get('/', pharmacistOnly, getBills);
router.post('/', pharmacistOnly, createBill);

router.get(
  '/:id/print',
  pharmacistOnly,
  [param('id').isUUID()],
  validateRequest,
  getBillPrint
);

router.get('/:id', pharmacistOnly, [param('id').isUUID()], validateRequest, getBillById);
router.put('/:id', pharmacistOnly, [param('id').isUUID()], validateRequest, updateBill);
router.put('/:id/cancel', pharmacistOnly, [param('id').isUUID()], validateRequest, cancelBill);

module.exports = router;
