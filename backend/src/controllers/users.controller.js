const bcrypt = require('bcrypt');
const { prisma } = require('../config/prisma');
const { createActivityLog } = require('../utils/activityLog');

function maxStaffUsersFromEnv() {
  const raw = process.env.MAX_STAFF_USERS;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function getStaffUserCount(txOrPrisma = prisma) {
  // Exclude SUPER_ADMIN from staff quota
  return txOrPrisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } });
}

async function listUsers(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 10));
  const skip = (page - 1) * pageSize;

  const maxStaffUsers = maxStaffUsersFromEnv();
  const [total, staffTotal, users] = await Promise.all([
    prisma.user.count(),
    getStaffUserCount(prisma),
    prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    }),
  ]);

  const remainingStaff = maxStaffUsers == null ? null : Math.max(0, maxStaffUsers - staffTotal);
  return res.json({
    users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    limits: {
      maxStaffUsers,
      staffUsers: staffTotal,
      remainingStaffUsers: remainingStaff,
    },
  });
}

async function createUser(req, res) {
  const { name, email, password, role, isActive } = req.body;

  try {
    const maxStaffUsers = maxStaffUsersFromEnv();
    if (maxStaffUsers != null && role !== 'SUPER_ADMIN') {
      const staffTotal = await getStaffUserCount(prisma);
      if (staffTotal >= maxStaffUsers) {
        return res.status(409).json({
          message: `User limit reached. Max staff users allowed: ${maxStaffUsers}.`,
          code: 'MAX_STAFF_USERS_REACHED',
          limits: { maxStaffUsers, staffUsers: staffTotal, remainingStaffUsers: 0 },
        });
      }
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLogin: true },
    });

    await createActivityLog({ userId: req.user?.userId, action: 'CREATE_USER', module: 'USER' });
    return res.status(201).json({ user });
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    throw err;
  }
}

async function updateUserStatus(req, res) {
  const { id } = req.params;
  try {
    const resolvedIsActive =
      typeof req.body.isActive === 'boolean'
        ? req.body.isActive
        : (req.body.status === 'active' ? true : req.body.status === 'inactive' ? false : undefined);

    if (typeof resolvedIsActive !== 'boolean') {
      return res.status(400).json({ message: 'Provide either boolean isActive or status "active"/"inactive"' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: resolvedIsActive },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLogin: true },
    });

    await createActivityLog({ userId: req.user?.userId, action: 'UPDATE_STATUS', module: 'USER' });
    return res.json({ user });
  } catch (err) {
    if (err && err.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    throw err;
  }
}

module.exports = { listUsers, createUser, updateUserStatus };
