const bcrypt = require('bcrypt');
const { syncHospitalBedMasters } = require('./hospitalBedMaster');

/**
 * Upsert SUPER_ADMIN from .env and sync default ward/bed masters.
 * Safe to call on every server start (idempotent).
 */
async function seedSuperAdmin(prisma) {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@ht-hospital.local';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMeNow123!';
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashed,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      name,
      email,
      password: hashed,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  await syncHospitalBedMasters(prisma);

  return { email, name };
}

module.exports = { seedSuperAdmin };
