const { prisma } = require('../../../config/prisma');

function normalizeType(value) {
  const s = String(value || '').trim().toUpperCase();
  if (s === 'ALERT' || s === 'ALERTS') return 'ALERT';
  if (s === 'UPDATE' || s === 'UPDATES') return 'UPDATE';
  return null;
}

async function listMyNotifications(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const type = normalizeType(req.query.type);
  const unreadOnly = String(req.query.unread || '').trim() === '1';
  const take = Math.min(100, Math.max(10, Number(req.query.limit) || 50));

  const where = { userId };
  if (type) where.type = type;
  if (unreadOnly) where.readAt = null;

  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take,
    select: { id: true, type: true, severity: true, title: true, message: true, readAt: true, createdAt: true },
  });

  return res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      severity: n.severity,
      title: n.title,
      message: n.message,
      read_at: n.readAt,
      created_at: n.createdAt,
    })),
  });
}

async function markRead(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const { id } = req.params;
  const existing = await prisma.notification.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!existing) return res.status(404).json({ message: 'Notification not found' });
  if (existing.userId !== userId) return res.status(403).json({ message: 'Access denied' });

  const row = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
    select: { id: true, readAt: true },
  });

  return res.json({ notification: { id: row.id, read_at: row.readAt } });
}

async function markAllRead(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return res.json({ ok: true });
}

module.exports = { listMyNotifications, markRead, markAllRead };

