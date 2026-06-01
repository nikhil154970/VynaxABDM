const express = require('express');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');
const { listAssignedPatients } = require('./ipd.controller');

const router = express.Router();

router.get('/assigned', authMiddleware, roleMiddleware(['NURSE']), listAssignedPatients);

module.exports = router;

