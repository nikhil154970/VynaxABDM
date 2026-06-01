const { prisma } = require('../config/prisma');

/**
 * Best-effort activity logging.
 * Never throw from here (logging should not block core actions like login).
 */
async function createActivityLog({ userId, action, module }) {
  try {
    if (!userId || !action || !module) return null;
    return await prisma.activityLog.create({
      data: { userId, action, module },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('ActivityLog create failed:', err?.message || err);
    return null;
  }
}

module.exports = { createActivityLog };

