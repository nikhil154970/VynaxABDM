const express = require('express');
const { body, param } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { listUsers, createUser, updateUserStatus } = require('../controllers/users.controller');

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), listUsers);

router.post(
  '/',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    body('name').isString().isLength({ min: 2 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role')
      .isIn([
        'SUPER_ADMIN',
        'DOCTOR',
        'NURSE',
        'RECEPTIONIST',
        'PHARMACIST',
        'LAB_TECHNICIAN',
        'HR_MANAGER',
      ])
      .withMessage('Valid role is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  ],
  validateRequest,
  createUser
);

router.patch(
  '/:id/status',
  authMiddleware,
  roleMiddleware(['SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Valid user id is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('status must be "active" or "inactive"'),
  ],
  validateRequest,
  updateUserStatus
);

module.exports = router;
