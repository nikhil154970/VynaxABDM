const express = require('express');
const { param, query } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  createMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deactivateMedicine,
} = require('../../controllers/pharmacy/medicineController');

const router = express.Router();

const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.post('/', pharmacistOnly, createMedicine);

router.get(
  '/',
  pharmacistOnly,
  [
    query('search').optional().isString(),
    query('q').optional().isString(),
    query('status').optional().isIn(['active', 'inactive', '']),
    query('category').optional().isString(),
  ],
  validateRequest,
  getMedicines
);

router.get(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid medicine id')],
  validateRequest,
  getMedicineById
);

router.put(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid medicine id')],
  validateRequest,
  updateMedicine
);

router.delete(
  '/:id',
  pharmacistOnly,
  [param('id').isUUID().withMessage('Invalid medicine id')],
  validateRequest,
  deactivateMedicine
);

module.exports = router;
