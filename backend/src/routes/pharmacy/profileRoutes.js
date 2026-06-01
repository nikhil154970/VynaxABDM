const express = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { getProfile, updateProfile } = require('../../controllers/pharmacy/profileController');

const router = express.Router();
const pharmacyAccess = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/', pharmacyAccess, getProfile);
router.put('/', pharmacyAccess, updateProfile);

module.exports = router;
