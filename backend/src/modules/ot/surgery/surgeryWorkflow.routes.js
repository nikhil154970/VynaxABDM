const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  listEquipment, addEquipment, updateEquipment, deleteEquipment, getEquipmentHistory, allocateEquipment,
  listConsumables,
  startSurgeryWithAllocation, savePostSurgeryNotes,
  getSurgerySession, listInProgressSurgeries, listRecoveryPatients, listPostSurgeryPatients,
} = require('./surgeryWorkflow.controller');

const router = express.Router();
const access = [authMiddleware, roleMiddleware(['OT_TECHNICIAN', 'SUPER_ADMIN'])];

// Equipment CRUD
router.get('/equipment', ...access, listEquipment);
router.post(
  '/equipment',
  ...access,
  [body('equipmentName').notEmpty(), body('category').notEmpty()],
  validateRequest,
  addEquipment
);
router.put('/equipment/:id', ...access, updateEquipment);
router.delete('/equipment/:id', ...access, deleteEquipment);
router.get('/equipment/:id/history', ...access, getEquipmentHistory);
router.post('/equipment/:id/allocate', ...access, allocateEquipment);

// Consumables
router.get('/consumables', ...access, listConsumables);

// Surgery workflow
router.post(
  '/workflow/start',
  ...access,
  [body('scheduleId').isUUID().withMessage('Schedule ID is required')],
  validateRequest,
  startSurgeryWithAllocation
);

router.put('/workflow/post-surgery-notes/:sessionId', ...access, savePostSurgeryNotes);

router.get('/workflow/session/:id', ...access, getSurgerySession);
router.get('/workflow/in-progress', ...access, listInProgressSurgeries);
router.get('/workflow/recovery', ...access, listRecoveryPatients);
router.get('/workflow/post-surgery', ...access, listPostSurgeryPatients);

module.exports = router;
