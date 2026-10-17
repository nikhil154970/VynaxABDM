const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  listOtRequests,
  getOtRequestDetail,
  generateOtBill,
  getOtBill,
  payOtBill,
  approveForOt,
  listApprovedForOt,
  searchOtRequests,
  generateAndApprove,
} = require('./ot.controller');

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']), listOtRequests);

router.get('/search', authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']), searchOtRequests);

router.get('/approved', authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN', 'OT_TECHNICIAN']), listApprovedForOt);

router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid OT request id is required')],
  validateRequest,
  getOtRequestDetail
);

router.get(
  '/:id/bill',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN', 'OT_TECHNICIAN']),
  [param('id').isUUID().withMessage('Valid OT request id is required')],
  validateRequest,
  getOtBill
);

router.post(
  '/:id/bill',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid OT request id is required')],
  validateRequest,
  generateOtBill
);

router.post(
  '/:id/generate-and-approve',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid OT request id is required')],
  validateRequest,
  generateAndApprove
);

router.post(
  '/:id/pay',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid OT request id is required'),
    body('amount').isInt({ min: 1 }).withMessage('amount must be a positive integer'),
  ],
  validateRequest,
  payOtBill
);

router.post(
  '/:id/approve',
  authMiddleware,
  roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']),
  [param('id').isUUID().withMessage('Valid OT request id is required')],
  validateRequest,
  approveForOt
);

module.exports = router;
