const express = require('express');
const { param } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  getQueueSummary,
  listQueue,
  getQueueById,
  createQueueEntry,
  markInProgress,
  markBilled,
} = require('../../controllers/pharmacy/queueController');

const router = express.Router();

const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];
const receptionistOnly = [authMiddleware, roleMiddleware(['RECEPTIONIST', 'SUPER_ADMIN'])];

router.get('/summary', pharmacistOnly, getQueueSummary);
router.get('/', pharmacistOnly, listQueue);
router.get('/:id', pharmacistOnly, [param('id').isString().isLength({ min: 10 })], validateRequest, getQueueById);

router.post('/', receptionistOnly, createQueueEntry);

router.put('/:id/in-progress', pharmacistOnly, [param('id').isString().isLength({ min: 10 })], validateRequest, markInProgress);
router.put('/:id/billed', pharmacistOnly, [param('id').isString().isLength({ min: 10 })], validateRequest, markBilled);

module.exports = router;

