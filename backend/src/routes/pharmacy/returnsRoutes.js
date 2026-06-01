const express = require('express');
const { param } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  getSummary,
  listReturns,
  getReturnById,
  searchBills,
  getExpiredBatches,
  getSupplierBatches,
  createCustomerReturn,
  createVendorReturn,
  createExpiredReturn,
  approveReturn,
  cancelReturn,
} = require('../../controllers/pharmacy/returnsController');

const router = express.Router();
const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/summary', pharmacistOnly, getSummary);
router.get('/bills/search', pharmacistOnly, searchBills);
router.get('/expired-batches', pharmacistOnly, getExpiredBatches);
router.get('/supplier-batches', pharmacistOnly, getSupplierBatches);
router.post('/customer', pharmacistOnly, createCustomerReturn);
router.post('/vendor', pharmacistOnly, createVendorReturn);
router.post('/expired', pharmacistOnly, createExpiredReturn);
router.put('/:id/approve', pharmacistOnly, [param('id').isUUID()], validateRequest, approveReturn);
router.put('/:id/cancel', pharmacistOnly, [param('id').isUUID()], validateRequest, cancelReturn);
router.get('/:id', pharmacistOnly, [param('id').isUUID()], validateRequest, getReturnById);
router.get('/', pharmacistOnly, listReturns);

module.exports = router;
