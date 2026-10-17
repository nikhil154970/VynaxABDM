const { prisma } = require('../config/prisma');

async function triggerCriticalAlert(title, message) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true }
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'ALERT',
          severity: 'CRITICAL',
          title,
          message
        }))
      });
    }
  } catch (err) {
    console.error('Failed to trigger critical alert:', err);
  }
}

module.exports = {
  triggerCriticalAlert
};
