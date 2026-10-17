const bcrypt = require('bcrypt');
const { syncHospitalBedMasters } = require('./hospitalBedMaster');

/**
 * Upsert SUPER_ADMIN from .env and sync default ward/bed masters.
 * Safe to call on every server start (idempotent).
 */
async function seedSuperAdmin(prisma) {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@vyanx.local';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMeNow123!';
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  const hashed = await bcrypt.hash(password, 12);

  const upsertAdmin = (targetEmail, username = null) =>
    prisma.user.upsert({
      where: { email: targetEmail },
      update: {
        name,
        password: hashed,
        role: 'SUPER_ADMIN',
        isActive: true,
        ...(username ? { username } : {}),
      },
      create: {
        name,
        email: targetEmail,
        password: hashed,
        role: 'SUPER_ADMIN',
        isActive: true,
        ...(username ? { username } : {}),
      },
    });

  const defaultEmail = 'admin@vyanx.local';

  await upsertAdmin(email, email === defaultEmail ? 'admin' : null);

  // Keep .env.example default login working when SUPER_ADMIN_EMAIL is customized.
  if (email !== defaultEmail) {
    await upsertAdmin(defaultEmail, 'admin');
  }

  await syncHospitalBedMasters(prisma);

  return { email, name, password };
}

module.exports = { seedSuperAdmin };
