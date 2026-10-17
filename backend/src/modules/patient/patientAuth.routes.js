const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validateRequest');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const {
  login, register, enablePortal, getProfile, getMyVisits, getMyBills,
} = require('./patientAuth.controller');

const router = express.Router();

const patientAccess = [authMiddleware, (req, res, next) => {
  if (req.user.role !== 'PATIENT') return res.status(403).json({ message: 'Access denied' });
  next();
}];

router.post('/auth/login', [
  body('uhid').notEmpty().withMessage('UHID is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validateRequest, login);

router.post('/auth/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('gender').notEmpty().withMessage('Gender is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], validateRequest, register);

router.post('/auth/enable', authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN']), [
  body('uhid').notEmpty().withMessage('UHID is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], validateRequest, enablePortal);

router.get('/me', ...patientAccess, getProfile);

router.get('/me/visits', ...patientAccess, getMyVisits);

router.get('/me/bills', ...patientAccess, getMyBills);

module.exports = router;
