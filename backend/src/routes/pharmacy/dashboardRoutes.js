const express = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { getDashboard } = require('../../controllers/pharmacy/dashboardController');

const router = express.Router();
const pharmacistOnly = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/', pharmacistOnly, getDashboard);

module.exports = router;
