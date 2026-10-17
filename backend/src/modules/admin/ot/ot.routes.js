const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  listOtRooms, createOtRoom, updateOtRoom, deleteOtRoom,
  listOtNurses, toggleNurseActive,
} = require('./ot.controller');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

// Rooms
router.get('/rooms', ...adminOnly, listOtRooms);
router.post(
  '/rooms',
  ...adminOnly,
  [body('roomNumber').notEmpty().withMessage('Room number is required'), body('roomName').notEmpty().withMessage('Room name is required')],
  validateRequest,
  createOtRoom
);
router.put(
  '/rooms/:id',
  ...adminOnly,
  [param('id').isUUID().withMessage('Valid room ID is required')],
  validateRequest,
  updateOtRoom
);
router.delete(
  '/rooms/:id',
  ...adminOnly,
  [param('id').isUUID().withMessage('Valid room ID is required')],
  validateRequest,
  deleteOtRoom
);

// Nurses
router.get('/nurses', ...adminOnly, listOtNurses);
router.patch(
  '/nurses/:id/toggle',
  ...adminOnly,
  [param('id').isUUID().withMessage('Valid nurse ID is required')],
  validateRequest,
  toggleNurseActive
);

module.exports = router;
