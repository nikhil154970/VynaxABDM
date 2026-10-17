const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { login } = require('../controllers/auth.controller');
const { validateRequest } = require('../middleware/validateRequest');

router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email or username is required')
      .custom((value) => {
        const isEmail = require('validator').isEmail(String(value));
        const isUsername = /^[a-zA-Z0-9._-]{3,50}$/.test(String(value));
        if (isEmail || isUsername) return true;
        throw new Error('Enter a valid email or username');
      }),
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
        'OT_TECHNICIAN',
      ])
      .withMessage('Valid role is required'),
  ],
  validateRequest,
  login
);

module.exports = router;
