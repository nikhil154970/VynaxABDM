const bcrypt = require('bcrypt');

const DEMO_STAFF = [
  { name: 'Demo Doctor', email: 'doctor@vyanx.local', username: 'doctor', role: 'DOCTOR' },
  { name: 'Demo Nurse', email: 'nurse@vyanx.local', username: 'nurse', role: 'NURSE' },
  {
    name: 'Demo Receptionist',
    email: 'receptionist@vyanx.local',
    username: 'receptionist',
    role: 'RECEPTIONIST',
  },
  {
    name: 'Demo Lab Technician',
    email: 'lab@vyanx.local',
    username: 'labtech',
    role: 'LAB_TECHNICIAN',
  },
  { name: 'Demo HR Manager', email: 'hr@vyanx.local', username: 'hr', role: 'HR_MANAGER' },
];

/**
 * Upsert demo staff accounts for local/dev login testing (idempotent).
 */
async function seedDemoStaff(prisma) {
  const password = process.env.DEMO_STAFF_PASSWORD || 'ChangeMeNow123!';
  const hashed = await bcrypt.hash(password, 12);
  const results = [];

  for (const staff of DEMO_STAFF) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        username: staff.username,
        password: hashed,
        role: staff.role,
        isActive: true,
      },
      create: {
        name: staff.name,
        email: staff.email,
        username: staff.username,
        password: hashed,
        role: staff.role,
        isActive: true,
      },
      select: { email: true, username: true, role: true },
    });
    results.push(user);
  }

  return { password, users: results };
}

module.exports = { seedDemoStaff, DEMO_STAFF };
