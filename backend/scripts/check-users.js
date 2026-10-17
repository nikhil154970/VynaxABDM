require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, username: true, role: true, isActive: true, password: true },
    orderBy: { role: 'asc' },
  });

  for (const u of users) {
    let pwdOk = 'missing';
    if (u.password) {
      try {
        pwdOk = await bcrypt.compare('12345678', u.password) ? '12345678' : 'no-match-12345678';
        if (pwdOk === 'no-match-12345678') {
          const demo = await bcrypt.compare('ChangeMeNow123!', u.password);
          pwdOk = demo ? 'ChangeMeNow123!' : 'no-match';
        }
      } catch (e) {
        pwdOk = `bcrypt-error: ${e.message}`;
      }
    }
    console.log({
      role: u.role,
      email: u.email,
      username: u.username,
      isActive: u.isActive,
      hasPassword: !!u.password,
      pwdTest: pwdOk,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
