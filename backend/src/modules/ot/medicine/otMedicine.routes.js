const express = require('express');
const router = express.Router();
const ctrl = require('./otMedicine.controller');
const { authMiddleware } = require('../../../middleware/authMiddleware');
const { roleMiddleware } = require('../../../middleware/roleMiddleware');

const access = [authMiddleware, roleMiddleware(['OT_TECHNICIAN', 'PHARMACIST', 'SUPER_ADMIN'])];

router.get('/issues', ...access, ctrl.listIssues);
router.get('/issues/:id', ...access, ctrl.getIssue);
router.post('/issues/request', ...access, ctrl.requestIssue);
router.post('/issues/:id/receive', ...access, ctrl.receiveIssue);
router.post('/issues/:id/use', ...access, ctrl.logUse);
router.post('/issues/:id/request-return', ...access, ctrl.requestReturn);
router.get('/inventory-search', ...access, ctrl.inventorySearch);

module.exports = router;
