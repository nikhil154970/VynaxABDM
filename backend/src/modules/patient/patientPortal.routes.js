const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validateRequest');
const { authMiddleware } = require('../../middleware/authMiddleware');

const router = express.Router();

const patientGuard = (req, res, next) => {
  if (!req.user || req.user.role !== 'PATIENT') return res.status(403).json({ message: 'Access denied' });
  next();
};

// All routes require auth + patient guard
router.use(authMiddleware, patientGuard);

const ctrl = require('./patientPortal.controller');

router.get('/dashboard', ctrl.getDashboard);
router.get('/appointments', ctrl.getAppointments);
router.get('/appointments/:id', ctrl.getAppointmentById);
router.get('/timeline', ctrl.getTimeline);
router.get('/admissions', ctrl.getAdmissions);
router.get('/admissions/:id', ctrl.getAdmissionById);
router.get('/prescriptions', ctrl.getPrescriptions);
router.get('/lab-reports', ctrl.getLabReports);
router.get('/lab-reports/:id', ctrl.getLabReportById);
router.get('/ot-surgery', ctrl.getOtSurgery);
router.get('/ot-surgery/:id', ctrl.getOtSurgeryById);
router.get('/recovery', ctrl.getRecovery);
router.get('/vitals', ctrl.getVitals);
router.get('/bills', ctrl.getBills);
router.get('/documents', ctrl.getDocuments);
router.get('/notifications', ctrl.getNotifications);
router.get('/notification-counts', ctrl.getNotificationCounts);
router.get('/profile', ctrl.getProfile);
router.put('/profile', [
  body('name').optional().notEmpty(),
], validateRequest, ctrl.updateProfile);
router.put('/change-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], validateRequest, ctrl.changePassword);

module.exports = router;
