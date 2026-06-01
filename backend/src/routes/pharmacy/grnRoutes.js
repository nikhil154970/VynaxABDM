const express = require('express');
const { param, query } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  getPurchaseOrdersForGrn,
  createGrn,
  getGrns,
  getGrnById,
  updateGrn,
  completeGrn,
  cancelGrn,
  getGrnPrint,
} = require('../../controllers/pharmacy/grnController');

const router = express.Router();

const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/purchase-orders', pharmacistOnly, getPurchaseOrdersForGrn);

router.post('/', pharmacistOnly, createGrn);

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
  getGrns
);

router.get(
  '/:id/print',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid GRN id')],
  validateRequest,
  getGrnPrint
);

router.get(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid GRN id')],
  validateRequest,
  getGrnById
);

router.put(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid GRN id')],
  validateRequest,
  updateGrn
);

router.put(
  '/:id/complete',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid GRN id')],
  validateRequest,
  completeGrn
);

router.put(
  '/:id/cancel',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid GRN id')],
  validateRequest,
  cancelGrn
);

module.exports = router;
