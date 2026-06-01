const { prisma } = require('../../config/prisma');

const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function roleLabel(role) {
  const map = {
    PHARMACIST: 'Pharmacist',
    SUPER_ADMIN: 'Super Admin',
    DOCTOR: 'Doctor',
    NURSE: 'Nurse',
    RECEPTIONIST: 'Receptionist',
    LAB_TECHNICIAN: 'Lab Technician',
    HR_MANAGER: 'HR Manager',
  };
  return map[role] || role;
}

function defaultDepartment(role) {
  if (role === 'PHARMACIST') return 'Pharmacy';
  if (role === 'SUPER_ADMIN') return 'Administration';
  return 'Hospital';
}

function deriveUsername(user) {
  if (user.username) return user.username;
  const local = String(user.email || '').split('@')[0];
  return local || 'user';
}

function formatLastLogin(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN');
}

function mapProfile(user) {
  const department = user.department || defaultDepartment(user.role);
  return {
    id: user.id,
    fullName: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    role: user.role,
    roleLabel: roleLabel(user.role),
    department,
    username: deriveUsername(user),
    lastLogin: user.lastLogin,
    lastLoginLabel: formatLastLogin(user.lastLogin),
    createdAt: user.createdAt,
  };
}

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });

    return res.json({ profile: mapProfile(user) });
  } catch (err) {
    console.error('[pharmacy/profile] get', err);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return res.status(404).json({ message: 'User not found' });

    const body = req.body || {};
    const name = String(body.fullName ?? body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const phoneRaw = String(body.phone ?? body.mobile ?? '').trim();
    const address = String(body.address ?? '').trim();

    if (!name) return res.status(400).json({ message: 'Full name is required' });
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Invalid email address' });

    const phoneDigits = phoneRaw.replace(/\D/g, '');
    const phone =
      phoneDigits.length === 12 && phoneDigits.startsWith('91')
        ? phoneDigits.slice(2)
        : phoneDigits.length === 11 && phoneDigits.startsWith('0')
          ? phoneDigits.slice(1)
          : phoneDigits;

    if (phone && !PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: 'Enter a valid 10-digit mobile number' });
    }

    if (email !== existing.email) {
      const clash = await prisma.user.findUnique({ where: { email } });
      if (clash && clash.id !== userId) {
        return res.status(409).json({ message: 'Email is already in use' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        phone: phone || null,
        address: address || null,
      },
    });

    return res.json({
      message: 'Profile updated successfully',
      profile: mapProfile(updated),
    });
  } catch (err) {
    console.error('[pharmacy/profile] update', err);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

module.exports = { getProfile, updateProfile };
