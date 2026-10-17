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
  deleteBill,
} = require('../../controllers/pharmacy/billingController');

const router = express.Router();
const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];
const pharmacistOrReception = [
  authMiddleware,
  roleMiddleware(['PHARMACIST', 'SUPER_ADMIN', 'RECEPTIONIST', 'NURSE']),
];

// Allow Receptionist (Send to Pharmacy) and Nurse (IPD Medicine Request) to search inventory.
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
router.delete('/:id', pharmacistOnly, [param('id').isUUID()], validateRequest, deleteBill);

module.exports = router;
