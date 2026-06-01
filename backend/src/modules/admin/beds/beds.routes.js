const express = require('express');
const { body, query, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');

const {
  listWards,
  createWard,
  updateWard,
  listBeds,
  createBed,
  updateBed,
  deleteBed,
} = require('./beds.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

// Wards
router.get(
  '/wards',
  ...adminOnly,
  [query('includeInactive').optional().isBoolean().toBoolean(), query('includeLegacy').optional().isBoolean().toBoolean()],
  validateRequest,
  listWards
);

router.post(
  '/wards',
  ...adminOnly,
  [body('name').isString().isLength({ min: 1 }), body('type').optional().isString()],
  validateRequest,
  createWard
);

router.patch(
  '/wards/:id',
  ...adminOnly,
  [
    param('id').isUUID().withMessage('Valid ward id is required'),
    body('name').optional().isString(),
    body('type').optional().isString(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  updateWard
);

// Beds
router.get(
  '/',
  ...adminOnly,
  [
    query('wardId').optional().isUUID().withMessage('wardId must be a valid uuid'),
    query('status').optional().isString(),
    query('includeInactiveWards').optional().isBoolean().toBoolean(),
    query('includeLegacy').optional().isBoolean().toBoolean(),
  ],
  validateRequest,
  listBeds
);

router.post(
  '/',
  ...adminOnly,
  [body('wardId').isUUID().withMessage('wardId must be a valid uuid'), body('code').isString().isLength({ min: 1 })],
  validateRequest,
  createBed
);

router.patch(
  '/:id',
  ...adminOnly,
  [
    param('id').isUUID().withMessage('Valid bed id is required'),
    body('wardId').optional().isUUID(),
    body('code').optional().isString(),
    body('status').optional().isString(),
  ],
  validateRequest,
  updateBed
);

router.delete(
  '/:id',
  ...adminOnly,
  [param('id').isUUID().withMessage('Valid bed id is required')],
  validateRequest,
  deleteBed
);

module.exports = router;

