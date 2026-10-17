const { prisma, withDbRetry } = require('../../../config/prisma');

function normalizeType(value) {
  const s = String(value || '').trim().toUpperCase();
  if (s === 'ALERT' || s === 'ALERTS') return 'ALERT';
  if (s === 'UPDATE' || s === 'UPDATES') return 'UPDATE';
  return null;
}

async function listNotifications(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const type = normalizeType(req.query.type);
  const unreadOnly = String(req.query.unread || '').trim() === '1';
  const take = Math.min(100, Math.max(10, Number(req.query.limit) || 50));

  const where = { userId };
  if (type) where.type = type;
  if (unreadOnly) where.readAt = null;

  try {
    const rows = await withDbRetry(() =>
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take,
        select: { id: true, type: true, severity: true, title: true, message: true, readAt: true, createdAt: true },
      }),
    );

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
  } catch (err) {
    console.error('listNotifications error:', err?.message || err);
    return res.status(503).json({ message: 'Database temporarily unavailable' });
  }
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

  const updated = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return res.json({ ok: true, updated: updated.count || 0 });
}

async function getModuleCounts(req, res) {
  try {
    // Sequential queries — parallel Promise.all exhausts Render cloud PG connection pool
    const data = await withDbRetry(async () => {
      const otPendingBill = await prisma.otRequest.count({ where: { status: 'OT_REQUEST_CREATED' } });
      const otApproved = await prisma.otRequest.count({ where: { status: 'APPROVED_FOR_OT' } });
      const pendingDischarge = await prisma.admission.count({
        where: { status: 'DISCHARGE_REQUESTED', dischargeRequestedAt: { not: null } },
      });
      const pendingLabPayments = await prisma.bill.count({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, labOrders: { some: {} } },
      });
      const advisedLabTests = await prisma.labOrder.count({ where: { billId: null } });
      const pendingBills = await prisma.bill.count({ where: { status: { in: ['PENDING', 'PARTIAL'] } } });
      const activeIpd = await prisma.admission.count({
        where: { status: { in: ['ADMITTED', 'UNDER_TREATMENT'] } },
      });
      return { otPendingBill, otApproved, pendingDischarge, pendingLabPayments, advisedLabTests, pendingBills, activeIpd };
    });

    return res.json(data);
  } catch (err) {
    console.error('getModuleCounts error:', err?.message || err);
    return res.status(503).json({ message: 'Could not load module counts' });
  }
}

module.exports = { listNotifications, markRead, markAllRead, getModuleCounts };

