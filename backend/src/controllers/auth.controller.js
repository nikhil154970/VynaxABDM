const bcrypt = require('bcrypt');
const { prisma } = require('../config/prisma');
const { generateAccessToken } = require('../config/jwt');
const { createActivityLog } = require('../utils/activityLog');
const { ensureDbConnected } = require('../lib/ensureDb');

function normalizeLoginId(raw) {
  const value = String(raw || '').trim();
  if (!value) return value;
  return value.includes('@') ? value.toLowerCase() : value;
}

function isDbError(err) {
  const code = err?.code || '';
  return (
    code.startsWith('P1') ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    /connect|connection|timeout|database/i.test(String(err?.message || ''))
  );
}

const login = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server misconfigured: JWT_SECRET is missing' });
    }

    try {
      await ensureDbConnected();
    } catch (dbErr) {
      console.error('Login DB connect failed:', dbErr?.message || dbErr);
      return res.status(503).json({
        message: 'Database not ready. Wait a few seconds after backend start, then try again.',
      });
    }

    const { password, role } = req.body;
    const loginId = normalizeLoginId(req.body.email);

    let user = await prisma.user.findFirst({
      where: { email: { equals: loginId, mode: 'insensitive' } },
    });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { username: { equals: loginId, mode: 'insensitive' } },
      });
    }
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });

    if (!user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (compareErr) {
      console.error('Login password compare failed:', compareErr?.message || compareErr);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    if (user.role !== role) {
      return res.status(403).json({ message: 'Unauthorized role access' });
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);

    const now = new Date();
    try {
      await prisma.user.update({ where: { id: user.id }, data: { lastLogin: now } });
    } catch (logErr) {
      console.warn('lastLogin update failed:', logErr?.message || logErr);
    }
    await createActivityLog({ userId: user.id, action: 'LOGIN', module: 'AUTH' });

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login failed:', err);
    if (isDbError(err)) {
      return res.status(503).json({
        message: 'Database connection lost. Restart backend or wait a moment, then try again.',
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { login };