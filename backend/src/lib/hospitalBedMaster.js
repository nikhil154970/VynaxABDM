/**
 * Canonical ICU / General / Private ward + bed codes used by IPD and admin bed flows.
 * Idempotent: upserts wards and creates only beds whose `code` is not already present.
 */

/** @type {{ wardName: string, wardType: 'ICU' | 'GENERAL' | 'PRIVATE', bedCodes: string[] }[]} */
const HOSPITAL_BED_MASTERS = [
  {
    wardName: 'ICU',
    wardType: 'ICU',
    bedCodes: [
      'ICU1',
      'ICU2',
      'ICU3',
      'ICU4',
      'ICU5',
      'ICU6',
      'ICU 11',
      'ICU 12',
      'ICU 13',
      'ICU 14',
      'ICU 15',
      'ICU 16',
      'NICU 1',
      'NICU 2',
      'HDU',
      'ICU 7',
      'ICU 8',
      'ICU 9',
      'ICU 10',
    ],
  },
  {
    wardName: 'General Ward',
    wardType: 'GENERAL',
    bedCodes: ['G/W 1', 'G/W 2', 'G/W 3', 'G/W 4', 'G/W 5', 'G/W 6', 'G/W 7'],
  },
  {
    wardName: 'Private Rooms',
    wardType: 'PRIVATE',
    bedCodes: ['PVT 1', 'PVT 2', 'PVT 3', 'PVT 4', 'PVT 5', 'PVT 6', 'PVT 7', 'PVT 8', 'PVT 9', 'PVT 10'],
  },
];

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ maxWait?: number, timeout?: number }} [options]
 */
async function syncHospitalBedMasters(prisma, options = {}) {
  const txOptions = { maxWait: 10_000, timeout: 25_000, ...options };
  await prisma.$transaction(async (tx) => {
    const wardByName = new Map();
    for (const m of HOSPITAL_BED_MASTERS) {
      const row = await tx.ward.upsert({
        where: { name: m.wardName },
        create: { name: m.wardName, type: m.wardType, isActive: true },
        update: { type: m.wardType, isActive: true },
        select: { id: true, name: true },
      });
      wardByName.set(m.wardName, row);
    }

    const allCodes = HOSPITAL_BED_MASTERS.flatMap((m) => m.bedCodes.map((c) => String(c).trim())).filter(Boolean);
    const existing = await tx.bed.findMany({
      where: { code: { in: allCodes } },
      select: { code: true },
    });
    const existingSet = new Set(existing.map((b) => b.code));

    const createRows = [];
    for (const m of HOSPITAL_BED_MASTERS) {
      const ward = wardByName.get(m.wardName);
      if (!ward?.id) continue;
      for (const codeRaw of m.bedCodes) {
        const code = String(codeRaw).trim();
        if (!code || existingSet.has(code)) continue;
        createRows.push({ wardId: ward.id, code, status: 'AVAILABLE' });
      }
    }
    if (createRows.length) {
      await tx.bed.createMany({ data: createRows, skipDuplicates: true });
    }
  }, txOptions);
}

module.exports = { HOSPITAL_BED_MASTERS, syncHospitalBedMasters };
