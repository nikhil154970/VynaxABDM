const express = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const {
  getOverview,
  getSalesReport,
  getPurchaseReport,
  getInventoryReport,
  getLowStockReport,
  getExpiryReport,
  getSupplierReport,
  getReturnsReport,
  getDuesReport,
} = require('../../controllers/pharmacy/reportsController');

const router = express.Router();
const reportAccess = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/overview', reportAccess, getOverview);
router.get('/sales', reportAccess, getSalesReport);
router.get('/purchase', reportAccess, getPurchaseReport);
router.get('/inventory', reportAccess, getInventoryReport);
router.get('/low-stock', reportAccess, getLowStockReport);
router.get('/expiry', reportAccess, getExpiryReport);
router.get('/suppliers', reportAccess, getSupplierReport);
router.get('/returns', reportAccess, getReturnsReport);
router.get('/dues', reportAccess, getDuesReport);

module.exports = router;
