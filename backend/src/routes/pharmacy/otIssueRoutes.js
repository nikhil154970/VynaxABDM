const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/pharmacy/otIssueController');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');

const access = [authMiddleware, roleMiddleware(['PHARMACIST', 'SUPER_ADMIN'])];

router.get('/pending', ...access, ctrl.pendingList);
router.get('/history', ...access, ctrl.history);
router.get('/:id', ...access, ctrl.getIssue);
router.post('/:id/issue', ...access, ctrl.issueItems);
router.post('/:id/confirm-return', ...access, ctrl.confirmReturn);

module.exports = router;
