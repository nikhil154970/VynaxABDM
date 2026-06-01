const express = require('express');
const { param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { listPatients, getPatientHistory, getPatientAnalytics } = require('./patients.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

router.get('/', ...adminOnly, listPatients);

router.get('/analytics', ...adminOnly, getPatientAnalytics);

router.get(
  '/:patientId/history',
  ...adminOnly,
  [param('patientId').isUUID()],
  validateRequest,
  getPatientHistory
);

module.exports = router;
