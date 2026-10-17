const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const {
  getStats, listPending, listScheduled, scheduleSurgery,
  getTodaySurgeries, getUpcomingSurgeries, getDelayedSurgeries,
  getOtRooms, getRoomStats, getRoomDetail, createOtRoom, updateOtRoom, deleteOtRoom,
  getDoctors, getNurses, rescheduleSurgery,
} = require('./surgery.controller');

const router = express.Router();
const access = [authMiddleware, roleMiddleware(['OT_TECHNICIAN', 'SUPER_ADMIN'])];

router.get('/stats', ...access, getStats);
router.get('/pending', ...access, listPending);
router.get('/scheduled', ...access, listScheduled);
router.get('/today', ...access, getTodaySurgeries);
router.get('/upcoming', ...access, getUpcomingSurgeries);
router.get('/delayed', ...access, getDelayedSurgeries);
router.get('/rooms', ...access, getOtRooms);
router.get('/rooms/stats', ...access, getRoomStats);
router.get('/rooms/:id', ...access, getRoomDetail);
router.post('/rooms', ...access, [body('roomNumber').notEmpty().withMessage('Room number is required'), body('roomName').notEmpty().withMessage('Room name is required')], validateRequest, createOtRoom);
router.put('/rooms/:id', ...access, updateOtRoom);
router.delete('/rooms/:id', ...access, deleteOtRoom);
router.get('/doctors', ...access, getDoctors);
router.get('/nurses', ...access, getNurses);

router.post(
  '/schedule',
  ...access,
  [
    body('otRequestId').isUUID().withMessage('Valid OT request ID is required'),
    body('surgeryDate').isISO8601().withMessage('Valid surgery date is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Valid start time (HH:MM) is required'),
    body('estimatedDuration').isInt({ min: 1 }).withMessage('Estimated duration must be at least 1 minute'),
    body('otRoomId').isUUID().withMessage('OT Room is required'),
    body('surgeonId').isUUID().withMessage('Surgeon is required'),
    body('anaesthetistId').isUUID().withMessage('Anaesthetist is required'),
  ],
  validateRequest,
  scheduleSurgery
);

router.put(
  '/reschedule',
  ...access,
  [
    body('scheduleId').isUUID().withMessage('Schedule ID is required'),
    body('surgeryDate').isISO8601().withMessage('Valid surgery date is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Valid start time (HH:MM) is required'),
    body('reason').optional().isString(),
    body('otRoomId').optional().isUUID().withMessage('Valid room ID is required'),
  ],
  validateRequest,
  rescheduleSurgery
);


module.exports = router;
