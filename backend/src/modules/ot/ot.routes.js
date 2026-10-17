const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/prisma');
const { getDashboard, listOtRequests } = require('./ot.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const surgeryRoutes = require('./surgery/surgery.routes');
const surgeryWorkflowRoutes = require('./surgery/surgeryWorkflow.routes');
const recoveryRoutes = require('./recovery/recovery.routes');
const postSurgeryRoutes = require('./post-surgery/postSurgery.routes');
const medicineRoutes = require('./medicine/otMedicine.routes');

const otAccess = [authMiddleware, roleMiddleware(['OT_TECHNICIAN', 'SUPER_ADMIN'])];

router.get('/dashboard', ...otAccess, getDashboard);
router.get('/requests', ...otAccess, listOtRequests);
router.use('/surgery', surgeryRoutes);
router.use('/surgery', surgeryWorkflowRoutes);
router.use('/recovery', recoveryRoutes);
router.use('/post-surgery', postSurgeryRoutes);
router.use('/medicine', medicineRoutes);

// ── Notification routes ──────────────────────────────────────────────
router.get('/notifications', ...otAccess, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ notifications });
  } catch (err) {
    console.error('list OT notifications error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/notifications/:id/read', ...otAccess, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    await prisma.notification.update({
      where: { id: req.params.id, userId },
      data: { readAt: new Date() },
    });
    return res.json({ message: 'Marked as read' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/notifications/read-all', ...otAccess, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return res.json({ message: 'All marked as read' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
