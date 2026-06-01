const express = require('express');
const { param } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  getSummary,
  listBillingHistory,
  getBillDetails,
  getPatientBillingHistory,
  cancelBill,
} = require('../../controllers/pharmacy/billingHistoryController');

const router = express.Router();
const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];
const canCancel = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/summary', pharmacistOnly, getSummary);
router.get('/patient/:patientId', pharmacistOnly, [param('patientId').isUUID()], validateRequest, getPatientBillingHistory);
router.put('/:id/cancel', canCancel, [param('id').isUUID()], validateRequest, cancelBill);
router.get('/:id', pharmacistOnly, [param('id').isUUID()], validateRequest, getBillDetails);
router.get('/', pharmacistOnly, listBillingHistory);

module.exports = router;
