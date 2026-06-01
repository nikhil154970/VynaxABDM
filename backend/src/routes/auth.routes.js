const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { login } = require('../controllers/auth.controller');
const { validateRequest } = require('../middleware/validateRequest');

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isString().isLength({ min: 6 }).withMessage('Password is required'),
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
  ],
  validateRequest,
  login
);

module.exports = router;
