const express = require('express');
const { param } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  getSummary,
  listPendingDues,
  getPatientPendingDues,
  checkPatientDues,
  collectPayment,
  getBillDetails,
} = require('../../controllers/pharmacy/pendingDuesController');

const router = express.Router();

const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];
const pharmacistOrReception = [
  authMiddleware,
  roleMiddleware(['PHARMACIST', 'SUPER_ADMIN', 'RECEPTIONIST']),
];

router.get('/summary', pharmacistOrReception, getSummary);
router.get('/check/:patientId', pharmacistOrReception, [param('patientId').isUUID()], validateRequest, checkPatientDues);
router.post('/payment', pharmacistOnly, collectPayment);
router.get('/bill/:billId', pharmacistOrReception, [param('billId').isUUID()], validateRequest, getBillDetails);
router.get('/', pharmacistOrReception, listPendingDues);
router.get('/:patientId', pharmacistOrReception, [param('patientId').isUUID()], validateRequest, getPatientPendingDues);

module.exports = router;
