const express = require('express');
const { body, param } = require('express-validator');
const { validateRequest } = require('../../../middleware/validateRequest');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { createIpdNote, listIpdNotes } = require('./ipdNotes.controller');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [
    body('admission_id').optional().isUUID().withMessage('admission_id must be a valid uuid'),
    body('admissionId').optional().isUUID().withMessage('admissionId must be a valid uuid'),
    body('note').isString().isLength({ min: 1 }).withMessage('note is required'),
  ],
  validateRequest,
  createIpdNote
);

router.get(
  '/:admission_id',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  [param('admission_id').isUUID().withMessage('admission_id must be a valid uuid')],
  validateRequest,
  listIpdNotes
);

module.exports = router;

