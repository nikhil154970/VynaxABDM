const express = require('express');
const { param, query } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
} = require('../../controllers/pharmacy/supplierController');

const router = express.Router();

const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.post('/', pharmacistOnly, createSupplier);

router.get(
  '/',
  pharmacistOnly,
  [
    query('search').optional().isString(),
    query('q').optional().isString(),
    query('status').optional().isIn(['active', 'inactive', '']),
  ],
  validateRequest,
  getSuppliers
);

router.get(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid supplier id')],
  validateRequest,
  getSupplierById
);

router.put(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid supplier id')],
  validateRequest,
  updateSupplier
);

router.delete(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid supplier id')],
  validateRequest,
  deactivateSupplier
);

module.exports = router;
