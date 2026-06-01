const { prisma } = require('../src/config/prisma');

async function main() {
  const codeNoSpace = 'ICU12';
  const codeSpace = 'ICU 12';

  const [a, b] = await Promise.all([
    prisma.bed.findUnique({ where: { code: codeNoSpace }, select: { id: true, code: true, status: true } }),
    prisma.bed.findUnique({ where: { code: codeSpace }, select: { id: true, code: true, status: true } }),
  ]);

  console.log('ICU12:', a);
  console.log('ICU 12:', b);

  if (!a) return;

  // Prefer canonical "ICU 12" (with space) used by the client sheet.
  if (!b) {
    console.log('Renaming ICU12 -> ICU 12');
    await prisma.bed.update({ where: { id: a.id }, data: { code: codeSpace } });
    return;
  }

  // If both exist, delete ICU12 if safe.
  const [admissionRefs, transferFromRefs, transferToRefs] = await Promise.all([
    prisma.admission.count({ where: { bedId: a.id } }),
    prisma.bedTransfer.count({ where: { fromBedId: a.id } }),
    prisma.bedTransfer.count({ where: { toBedId: a.id } }),
  ]);

  const hasRefs = admissionRefs + transferFromRefs + transferToRefs > 0;
  if (hasRefs) {
    console.log('ICU12 has references; keeping it. Consider manual migration.');
    return;
  }

  if (String(a.status).toUpperCase() === 'OCCUPIED') {
    console.log('ICU12 is occupied; not deleting.');
    return;
  }

  console.log('Deleting legacy ICU12 (no space)');
  await prisma.bed.delete({ where: { id: a.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });

