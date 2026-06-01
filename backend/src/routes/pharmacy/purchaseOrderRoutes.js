const express = require('express');
const { param, query } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrderPrint,
  updatePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
} = require('../../controllers/pharmacy/purchaseOrderController');

const router = express.Router();

const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.post('/', pharmacistOnly, createPurchaseOrder);

router.get(
  '/',
  pharmacistOnly,
  [
    query('search').optional().isString(),
    query('q').optional().isString(),
    query('status').optional().isString(),
    query('dateFrom').optional().isString(),
    query('dateTo').optional().isString(),
  ],
  validateRequest,
  getPurchaseOrders
);

router.get(
  '/:id/print',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid purchase order id')],
  validateRequest,
  getPurchaseOrderPrint
);

router.get(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid purchase order id')],
  validateRequest,
  getPurchaseOrderById
);

router.put(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid purchase order id')],
  validateRequest,
  updatePurchaseOrder
);

router.put(
  '/:id/approve',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid purchase order id')],
  validateRequest,
  approvePurchaseOrder
);

router.put(
  '/:id/cancel',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid purchase order id')],
  validateRequest,
  cancelPurchaseOrder
);

router.delete(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid purchase order id')],
  validateRequest,
  deletePurchaseOrder
);

module.exports = router;
