const express = require('express');
const { param, query } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  getInventorySummary,
  getInventoryList,
  getInventoryByMedicine,
  getLowStock,
  getNearExpiry,
  getStockLedger,
} = require('../../controllers/pharmacy/inventoryController');

const router = express.Router();

const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/summary', pharmacistOnly, getInventorySummary);

router.get(
  '/low-stock',
  pharmacistOnly,
  getLowStock
);

router.get(
  '/near-expiry',
  pharmacistOnly,
  getNearExpiry
);

router.get(
  '/ledger',
  pharmacistOnly,
  [
    query('medicineId').optional().isUUID(),
    query('type').optional().isString(),
    query('search').optional().isString(),
    query('dateFrom').optional().isString(),
    query('dateTo').optional().isString(),
  ],
  validateRequest,
  getStockLedger
);

router.get(
  '/:medicineId',
  pharmacistOnly,
  [param('medicineId').isUUID().withMessage('Invalid medicine id')],
  validateRequest,
  getInventoryByMedicine
);

router.get(
  '/',
  pharmacistOnly,
  [
    query('search').optional().isString(),
    query('batchSearch').optional().isString(),
    query('category').optional().isString(),
    query('filter').optional().isString(),
  ],
  validateRequest,
  getInventoryList
);

module.exports = router;
