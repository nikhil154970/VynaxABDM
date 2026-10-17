const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/prisma');
const {
  isAyushmanSponsor,
  getLatestPatientSponsor,
  createAyushmanBillTotals,
  zeroLabOrderLinesFromItems,
} = require('../../utils/ayushmanBilling');
const { $Enums } = require('@prisma/client');
const { emitAbdmClinicalEvent, EVENT } = require('../abdm/lib/abdmHealthRecord');

/** Must match generated Prisma enum (same package as PrismaClient). */
const TEST_ADVICE_PENDING = $Enums.TestAdviceStatus.PENDING_BILLING;
const TEST_ADVICE_CONVERTED = $Enums.TestAdviceStatus.CONVERTED;

const LS = $Enums.LabOrderStatus;
/** Values actually present in the generated client (avoids Prisma validation errors if `IN_PROGRESS` was added in schema but `prisma generate` / DB migration lag). */
const LAB_ORDER_STATUS_VALUES = new Set(Object.values(LS));

const NURSE_IPD_ACTIVE_STATUSES = ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'];

/** Nurses may only view lab data for patients they are assigned to on an active IPD admission. */
async function assertNurseLabPatientAccess(req, patientId) {
  const role = String(req.user?.role || '').toUpperCase();
  if (role !== 'NURSE') return { ok: true };
  const userId = req.user?.userId;
  if (!userId) return { ok: false, status: 401, message: 'Access token required' };
  const pid = normalizeString(patientId);
  if (!pid) return { ok: false, status: 400, message: 'Patient id is required' };
  const admission = await prisma.admission.findFirst({
    where: {
      patientId: pid,
      nurseId: userId,
      status: { in: NURSE_IPD_ACTIVE_STATUSES },
      dischargeDate: null,
    },
    select: { id: true },
  });
  if (!admission) {
    return { ok: false, status: 403, message: 'Not assigned to this patient for IPD care' };
  }
  return { ok: true };
}

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

/** Link panel parameter rows (remarks = panel name) to the billed order line for category on reports. */
function findOrderItemForResult(items, r) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  const testName = normalizeString(r?.testName);
  const panel = normalizeString(r?.remarks) || normalizeString(r?.group);
  const orderItemId = normalizeString(r?.orderItemId);
  if (orderItemId) {
    const byId = list.find((it) => it.id === orderItemId);
    if (byId) return byId;
  }
  if (testName) {
    const exact = list.find((it) => it.testName === testName);
    if (exact) return exact;
  }
  if (panel) {
    const byPanel = list.find((it) => it.testName === panel);
    if (byPanel) return byPanel;
    const panelNorm = panel.toLowerCase();
    return (
      list.find((it) => {
        const n = String(it.testName || '').toLowerCase();
        if (!n) return false;
        return n === panelNorm || n.includes(panelNorm) || panelNorm.includes(n);
      }) || null
    );
  }
  return null;
}

function resolveResultCategory(result, items) {
  const item = findOrderItemForResult(items, result);
  const fromItem = normalizeString(item?.category);
  if (fromItem && fromItem.toLowerCase() !== 'general') return fromItem;

  const panel = normalizeString(result?.remarks);
  if (panel) {
    const panelNorm = panel.toLowerCase();
    const byPanel = (Array.isArray(items) ? items : []).find((it) => {
      const n = String(it.testName || '').toLowerCase();
      if (!n) return false;
      return n === panelNorm || n.includes(panelNorm) || panelNorm.includes(n);
    });
    const cat = normalizeString(byPanel?.category);
    if (cat && cat.toLowerCase() !== 'general') return cat;
  }
  return null;
}

function slugCode(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Source-of-truth master list (mirrors frontend ResultEntry categories/tests).
const MASTER_CATALOG = [
  { category: 'Hematology', tests: ['CBC (Complete Blood Count)', 'Hemoglobin (Hb)', 'RBC Count', 'WBC Count', 'Platelet Count', 'ESR', 'PCV (Hematocrit)', 'MCV', 'MCH', 'MCHC', 'Differential Count', 'Peripheral Smear'] },
  { category: 'Biochemistry', tests: ['Fasting Blood Sugar (FBS)', 'Post Prandial Blood Sugar (PPBS)', 'Random Blood Sugar (RBS)', 'HbA1c', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Lipid Profile', 'Uric Acid', 'Calcium', 'Electrolytes (Na, K, Cl)'] },
  { category: 'Serology', tests: ['HIV', 'Hepatitis B (HBsAg)', 'Hepatitis C (HCV)', 'Dengue (NS1, IgG, IgM)', 'Typhoid (Widal)', 'CRP', 'ASO'] },
  { category: 'Immunology', tests: ['ANA', 'Rheumatoid Factor (RA)', 'IgE (Allergy Test)', 'Anti-CCP'] },
  { category: 'Hormones', tests: ['TSH', 'T3', 'T4', 'Insulin', 'Testosterone', 'Estrogen', 'Progesterone', 'Cortisol'] },
  { category: 'Microbiology', tests: ['Blood Culture', 'Culture & Sensitivity', 'TB Test'] },
  { category: 'Coagulation', tests: ['PT', 'INR', 'APTT', 'D-Dimer'] },
  { category: 'Tumor Markers', tests: ['PSA', 'CEA', 'AFP', 'CA-125'] },
];

async function ensureLabCatalog() {
  const existing = await prisma.labTestCatalog.count({ where: { isActive: true } });
  if (existing > 0) return;

  const rows = [];
  for (const g of MASTER_CATALOG) {
    for (const name of g.tests) {
      const code = `LT_${slugCode(`${g.category}_${name}`)}`;
      rows.push({
        category: g.category,
        name,
        code,
        price: 0,
        isActive: true,
      });
    }
  }
  if (!rows.length) return;
  await prisma.labTestCatalog.createMany({ data: rows, skipDuplicates: true });
}

async function allocateNextLabOrderNumber(tx, when = new Date()) {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) throw new Error('LAB_ORDER_DATE_INVALID');
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const ymd = `${yyyy}${mm}${dd}`;
  const prefix = `LAB-${ymd}-`;
  const agg = await tx.labOrder.aggregate({ where: { orderNumber: { startsWith: prefix } }, _max: { orderNumber: true } });
  let next = 1;
  const maxStr = agg._max.orderNumber;
  if (maxStr && String(maxStr).startsWith(prefix)) {
    const tail = String(maxStr).slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  if (next > 9999) throw new Error('LAB_ORDER_NUMBER_EXHAUSTED');
  return `${prefix}${String(next).padStart(4, '0')}`;
}

async function allocateNextBillNumber(tx, billDate) {
  const d = new Date(billDate || new Date());
  if (Number.isNaN(d.getTime())) throw new Error('BILL_DATE_INVALID');
  d.setHours(0, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const ymd = `${yyyy}${mm}${dd}`;
  const prefix = `BILL-${ymd}-`;
  const agg = await tx.bill.aggregate({ where: { billNumber: { startsWith: prefix } }, _max: { billNumber: true } });
  let next = 1;
  const maxStr = agg._max.billNumber;
  if (maxStr && String(maxStr).startsWith(prefix)) {
    const tail = String(maxStr).slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  if (next > 9999) throw new Error('BILL_NUMBER_EXHAUSTED');
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function computeBillStatus(paid, total) {
  const p = Math.max(0, paid);
  const t = Math.max(0, total);
  if (t <= 0) return 'DRAFT';
  if (p <= 0) return 'PENDING';
  if (p >= t) return 'PAID';
  return 'PARTIAL';
}

async function notifyRoleUsers({ role, title, message, severity = 'INFO' }) {
  const users = await prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true },
    take: 200,
  });
  if (!users.length) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: 'ALERT',
      severity,
      title,
      message,
    })),
    skipDuplicates: true,
  });
}

// --- Catalog ---
async function listCatalog(req, res) {
  await ensureLabCatalog();
  const q = normalizeString(req.query.q).toLowerCase();
  const category = normalizeString(req.query.category);
  const rows = await prisma.labTestCatalog.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    take: 500,
  });
  const items = rows
    .filter((r) => (q ? `${r.category} ${r.name} ${r.code}`.toLowerCase().includes(q) : true))
    .map((r) => ({
      id: r.id,
      code: r.code,
      category: r.category,
      name: r.name,
      sampleType: r.sampleType,
      unit: r.unit,
      referenceRange: r.referenceRange,
      price: r.price,
    }));
  return res.json({ items });
}

const LAB_TEST_CATEGORIES = [
  'Hematology',
  'Biochemistry',
  'Clinical Pathology',
  'Microbiology',
  'Serology',
  'Hormone Profile',
  'Infectious Disease Markers',
  'Tumor Marker',
  'Autoimmune & Collagen Markers',
  'Immunology',
  'Coagulation',
  'Radiology',
  'Urine',
  'Other',
  'Blood',
];

function normalizeManagedCategory(raw) {
  const s = normalizeString(raw);
  if (!s) return null;
  const hit = LAB_TEST_CATEGORIES.find((c) => c.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  return s.length >= 2 && s.length <= 80 ? s : null;
}

const LAB_EXTRA_CATEGORIES_FILE = path.join(__dirname, '../../../data/lab-categories-extra.json');

function readLabCategoryExtrasFile() {
  const paths = [
    LAB_EXTRA_CATEGORIES_FILE,
    path.join(__dirname, '../../data/lab-categories-extra.json'),
  ];
  for (const filePath of paths) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const j = JSON.parse(raw);
      return {
        categories: Array.isArray(j.categories) ? j.categories.filter(Boolean) : [],
      };
    } catch {
      /* try next path */
    }
  }
  return { categories: [] };
}

function labCategoryTableReady() {
  return Boolean(prisma.labCategory && typeof prisma.labCategory.count === 'function');
}

async function ensureLabCategoriesSeeded() {
  if (!labCategoryTableReady()) return;
  const count = await prisma.labCategory.count();
  if (count > 0) return;
  const extras = readLabCategoryExtrasFile();
  const names = [...new Set([...LAB_TEST_CATEGORIES, ...extras.categories])];
  await prisma.labCategory.createMany({
    data: names.map((name, i) => ({ name, sortOrder: i })),
    skipDuplicates: true,
  });
}

/** Fallback when LabCategory table / Prisma client not ready yet */
async function buildManagedCategoryListFromTestsOnly() {
  const groups = await prisma.labTest.groupBy({
    by: ['category'],
    _count: { id: true },
  });
  const countMap = new Map();
  for (const g of groups) {
    if (g.category) countMap.set(g.category, g._count.id);
  }
  const extras = readLabCategoryExtrasFile();
  const names = new Set([...LAB_TEST_CATEGORIES, ...extras.categories]);
  for (const g of groups) {
    if (g.category) names.add(g.category);
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, testCount: countMap.get(name) || 0 }));
}

async function buildManagedCategoryList() {
  if (!labCategoryTableReady()) {
    return buildManagedCategoryListFromTestsOnly();
  }
  try {
    await ensureLabCategoriesSeeded();
    const groups = await prisma.labTest.groupBy({
      by: ['category'],
      _count: { id: true },
    });
    const countMap = new Map();
    for (const g of groups) {
      if (g.category) countMap.set(g.category, g._count.id);
    }
    const rows = await prisma.labCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const known = new Set(rows.map((r) => r.name));
    for (const g of groups) {
      if (!g.category || known.has(g.category)) continue;
      try {
        await prisma.labCategory.create({
          data: { name: g.category, sortOrder: 9000 + known.size },
        });
        known.add(g.category);
      } catch {
        /* duplicate race */
      }
    }
    const all = await prisma.labCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return all.map((r) => ({ name: r.name, testCount: countMap.get(r.name) || 0 }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('buildManagedCategoryList fallback', e);
    return buildManagedCategoryListFromTestsOnly();
  }
}

function categoryDbErrorMessage(e) {
  const msg = String(e?.message || '');
  if (e?.code === 'P2021' || /LabCategory/i.test(msg)) {
    return 'Database update zaroori hai — backend folder me chalao: npx prisma migrate deploy && npx prisma generate, phir server restart';
  }
  return msg || 'Category save failed';
}

async function listManagedLabCategories(req, res) {
  try {
    const categories = await buildManagedCategoryList();
    return res.json({ categories });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('listManagedLabCategories', e);
    return res.status(500).json({ message: categoryDbErrorMessage(e) });
  }
}

async function createManagedLabCategory(req, res) {
  try {
    const name = normalizeManagedCategory(req.body?.name);
    if (!name) return res.status(400).json({ message: 'Valid category name required (2–80 characters)' });
    let exists = false;
    if (labCategoryTableReady()) {
      await ensureLabCategoriesSeeded();
      const hit = await prisma.labCategory.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      exists = Boolean(hit);
      if (!exists) {
        const agg = await prisma.labCategory.aggregate({ _max: { sortOrder: true } });
        await prisma.labCategory.create({
          data: { name, sortOrder: (agg._max.sortOrder ?? 0) + 1 },
        });
      }
    } else {
      const extras = readLabCategoryExtrasFile();
      exists = extras.categories.some((c) => c.toLowerCase() === name.toLowerCase());
      if (!exists) {
        extras.categories.push(name);
        const filePath = path.join(__dirname, '../../../data/lab-categories-extra.json');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(
          filePath,
          JSON.stringify({ categories: extras.categories, hidden: [] }, null, 2),
          'utf8',
        );
      }
    }
    const categories = await buildManagedCategoryList();
    return res.status(201).json({
      ok: true,
      message: exists ? 'Category pehle se list me hai' : 'Category add ho gayi',
      category: { name, testCount: await prisma.labTest.count({ where: { category: name } }) },
      categories,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('createManagedLabCategory', e);
    return res.status(500).json({ message: categoryDbErrorMessage(e) });
  }
}

async function renameManagedLabCategory(req, res) {
  try {
    const from = normalizeString(req.body?.from);
    const to = normalizeManagedCategory(req.body?.to);
    if (!from || !to) return res.status(400).json({ message: 'Purana aur naya category naam likhein' });
    if (from.toLowerCase() === to.toLowerCase()) {
      const categories = await buildManagedCategoryList();
      return res.json({ ok: true, updated: 0, categories });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.labCategory.findFirst({ where: { name: from } });
      if (row) {
        const clash = await tx.labCategory.findFirst({
          where: { name: { equals: to, mode: 'insensitive' }, NOT: { id: row.id } },
        });
        if (clash) await tx.labCategory.delete({ where: { id: clash.id } });
        await tx.labCategory.update({ where: { id: row.id }, data: { name: to } });
      } else {
        await tx.labCategory.create({ data: { name: to, sortOrder: 9999 } });
      }
      const tests = await tx.labTest.updateMany({ where: { category: from }, data: { category: to } });
      await tx.labOrderItem.updateMany({ where: { category: from }, data: { category: to } });
      return tests.count;
    });

    const categories = await buildManagedCategoryList();
    return res.json({ ok: true, updated, categories });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('renameManagedLabCategory', e);
    return res.status(500).json({ message: categoryDbErrorMessage(e) });
  }
}

async function deleteManagedLabCategory(req, res) {
  try {
    const name = normalizeString(req.body?.name);
    if (!name) return res.status(400).json({ message: 'Category name required' });
    const count = await prisma.labTest.count({ where: { category: name } });
    if (count > 0) {
      return res.status(409).json({
        message: `Is category me ${count} test hain — pehle tests delete karein ya dusri category me move karein`,
      });
    }
    const row = await prisma.labCategory.findFirst({ where: { name } });
    if (row) await prisma.labCategory.delete({ where: { id: row.id } });
    const categories = await buildManagedCategoryList();
    return res.json({ ok: true, categories });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('deleteManagedLabCategory', e);
    return res.status(500).json({ message: categoryDbErrorMessage(e) });
  }
}

/** GET /lab/tests — ?forBilling=1 → catalog for reception; ?admin=1 → admin rows; else id+name for clinical */
async function listTestsSimple(req, res) {
  const adminFull =
    req.user?.role === 'SUPER_ADMIN' && ['1', 'true', 'yes'].includes(String(req.query.admin || '').toLowerCase());
  const forBilling = ['1', 'true', 'yes'].includes(String(req.query.forBilling || '').toLowerCase());
  const categoryFilter = normalizeString(req.query.category);

  if (adminFull) {
    try {
      const rows = await prisma.labTest.findMany({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: 5000,
      });
      const categoryRows = await buildManagedCategoryList();
      return res.json({ tests: rows, categories: categoryRows.map((c) => c.name) });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('listTestsSimple admin', e);
      return res.status(500).json({ message: categoryDbErrorMessage(e) });
    }
  }

  if (forBilling) {
    const rows = await prisma.labTest.findMany({
      where: {
        isActive: true,
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, price: true },
      take: 5000,
    });
    const categoryRows = await buildManagedCategoryList();
    return res.json({ categories: categoryRows.map((c) => c.name), tests: rows });
  }

  const rows = await prisma.labTest.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
    take: 2000,
  });
  return res.json(rows.map((r) => ({ id: r.id, name: r.name })));
}

async function createManagedLabTest(req, res) {
  const name = normalizeString(req.body?.name);
  const category = normalizeManagedCategory(req.body?.category) || '';
  const price = Number(req.body?.price);
  const isActive = req.body?.isActive !== false && req.body?.isActive !== 'false';
  if (!name) return res.status(400).json({ message: 'Name is required' });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: 'Valid price is required' });
  const row = await prisma.labTest.create({
    data: { name, category, price, isActive },
  });
  return res.status(201).json({ test: row });
}

async function updateManagedLabTest(req, res) {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ message: 'Invalid test id' });
  const existing = await prisma.labTest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Test not found' });
  const patch = {};
  if (req.body?.name !== undefined) {
    const n = normalizeString(req.body.name);
    if (!n) return res.status(400).json({ message: 'Name is required' });
    patch.name = n;
  }
  if (req.body?.category !== undefined) {
    patch.category = normalizeManagedCategory(req.body.category) || '';
  }
  if (req.body?.price !== undefined) {
    const p = Number(req.body.price);
    if (!Number.isFinite(p) || p < 0) return res.status(400).json({ message: 'Invalid price' });
    patch.price = p;
  }
  if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'No updates' });
  const row = await prisma.labTest.update({ where: { id }, data: patch });
  return res.json({ test: row });
}

async function deleteManagedLabTest(req, res) {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ message: 'Invalid test id' });
  const existing = await prisma.labTest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Test not found' });

  try {
    await prisma.$transaction(async (tx) => {
      const pendingUse = await tx.testAdviceItem.count({
        where: { testId: id, advice: { status: TEST_ADVICE_PENDING } },
      });
      if (pendingUse > 0) {
        throw new Error('TEST_IN_PENDING_ADVICE');
      }

      await tx.testAdviceItem.deleteMany({ where: { testId: id } });

      await tx.testAdvice.deleteMany({
        where: { status: TEST_ADVICE_CONVERTED, items: { none: {} } },
      });

      await tx.labTest.delete({ where: { id } });
    });
    return res.json({ ok: true, message: 'Test deleted' });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'TEST_IN_PENDING_ADVICE') {
      return res.status(409).json({
        message:
          'Ye test abhi reception ke "Advised OPD tests" list me pending hai — pehle bill karein ya doctor se advice hataein, phir delete karein.',
      });
    }
    if (e?.code === 'P2003') {
      return res.status(409).json({
        message: 'Test abhi kisi record se linked hai — Inactive kar dein.',
      });
    }
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not delete test' });
  }
}

// Helper used by doctor module
async function createLabOrderFromDoctor({ patientId, doctorId, appointmentId, consultationId, labTests, doctorNote }) {
  const tests = Array.isArray(labTests) ? labTests : [];
  const names = tests.map((t) => normalizeString(t?.testName || t?.name || t)).filter(Boolean);
  const uniqueNames = Array.from(new Set(names));
  if (!uniqueNames.length) return null;

  await ensureLabCatalog();

  return prisma.$transaction(async (tx) => {
    // avoid duplicate order for the same consultation
    if (consultationId) {
      const existing = await tx.labOrder.findFirst({ where: { consultationId }, select: { id: true } });
      if (existing) return null;
    }

    const orderNumber = await allocateNextLabOrderNumber(tx, new Date());
    const catalog = await tx.labTestCatalog.findMany({
      where: { isActive: true, name: { in: uniqueNames } },
      select: { id: true, name: true, category: true, unit: true, referenceRange: true, price: true },
    });
    const byName = new Map(catalog.map((c) => [c.name, c]));

    const order = await tx.labOrder.create({
      data: {
        orderNumber,
        patientId,
        doctorId,
        appointmentId: appointmentId || null,
        consultationId: consultationId || null,
        status: 'PENDING_BILLING',
        reportStatus: 'PENDING',
        notes: normalizeString(doctorNote) || null,
        items: {
          create: uniqueNames.map((name) => {
            const hit = byName.get(name);
            return {
              testId: hit?.id || null,
              testName: name,
              category: hit?.category || null,
              unit: hit?.unit || null,
              referenceRange: hit?.referenceRange || null,
              price: hit?.price || 0,
              quantity: 1,
            };
          }),
        },
      },
      select: { id: true, orderNumber: true },
    });
    return order;
  });
}

// --- Receptionist queue ---
async function listReceptionistPendingOrders(req, res) {
  const q = normalizeString(req.query.q).toLowerCase();
  const rows = await prisma.labOrder.findMany({
    where: { status: 'PENDING_BILLING' },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
      doctor: { select: { user: { select: { name: true } } } },
      items: { select: { testName: true, price: true, quantity: true } },
    },
  });

  const items = rows
    .map((o) => {
      const total = (o.items || []).reduce((s, it) => s + Math.max(0, (it.price || 0) * (it.quantity || 1)), 0);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        patient: o.patient,
        doctorName: o.doctor?.user?.name || '',
        tests: (o.items || []).map((x) => ({ name: x.testName, price: x.price || 0, qty: x.quantity || 1 })),
        totalAmount: total,
      };
    })
    .filter((o) => {
      if (!q) return true;
      const blob = `${o.orderNumber} ${o.patient?.name} ${o.patient?.uhid} ${o.patient?.mobile} ${o.doctorName}`.toLowerCase();
      return blob.includes(q);
    });

  return res.json({ items });
}

async function getReceptionistOrderDetail(req, res) {
  const id = normalizeString(req.params.id);
  const o = await prisma.labOrder.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
      doctor: { include: { user: { select: { name: true } } } },
      items: true,
      bill: { select: { id: true, billNumber: true, totalAmount: true, paidAmount: true, status: true } },
    },
  });
  if (!o) return res.status(404).json({ message: 'Lab order not found' });
  return res.json({ order: o });
}

async function approveReceptionistOrderAndGenerateBill(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const id = normalizeString(req.params.id);
  const note = normalizeString(req.body?.notes) || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.findUnique({
        where: { id },
        include: {
          patient: { select: { id: true } },
          items: true,
          bill: { select: { id: true, billNumber: true } },
        },
      });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'PENDING_BILLING') throw new Error('ORDER_NOT_PENDING');
      if (order.billId || order.bill?.id) throw new Error('ORDER_ALREADY_BILLED');

      const sponsor = await getLatestPatientSponsor(tx, order.patientId);
      const ayushman = isAyushmanSponsor(sponsor);
      let lines = (order.items || [])
        .map((it) => {
          const qty = Math.max(1, it.quantity || 1);
          const unitPrice = Math.max(0, it.price || 0);
          const lineTotal = qty * unitPrice;
          if (lineTotal <= 0) return null;
          return { description: `Lab Test: ${it.testName}`, quantity: qty, unitPrice, lineTotal };
        })
        .filter(Boolean);
      if (!lines.length) throw new Error('ORDER_NO_CHARGE_LINES');

      const billDate = new Date();
      const billNumber = await allocateNextBillNumber(tx, billDate);
      const subtotalAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
      const totalAmount = subtotalAmount;
      let paidAmount = 0;
      let status = computeBillStatus(paidAmount, totalAmount);
      let lastPaymentMode = null;
      if (ayushman) {
        const z = createAyushmanBillTotals({ subtotalAmount, discountAmount: 0, taxAmount: 0, totalAmount });
        paidAmount = z.paidAmount;
        status = z.status;
        lastPaymentMode = z.lastPaymentMode;
      }

      const bill = await tx.bill.create({
        data: {
          billNumber,
          patientId: order.patientId,
          visitType: 'OPD',
          status,
          subtotalAmount,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount,
          paidAmount,
          lastPaymentMode,
          appointmentId: order.appointmentId,
          notes: ayushman ? `${note || `LAB ORDER ${order.orderNumber}`} · PAID BY AYUSHMAN` : note || `LAB ORDER ${order.orderNumber}`,
          billDate,
          lineItems: {
            create: lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
        select: { id: true, billNumber: true, totalAmount: true, paidAmount: true, status: true },
      });

      const updated = await tx.labOrder.update({
        where: { id: order.id },
        data: {
          status: 'BILLED',
          billedAt: new Date(),
          billedByUserId: userId,
          billId: bill.id,
        },
        select: { id: true, orderNumber: true, status: true },
      });

      return { order: updated, bill };
    });

    // Notify lab technicians
    await notifyRoleUsers({
      role: 'LAB_TECHNICIAN',
      title: 'Lab billing approved',
      message: `New lab order billed: ${result.order.orderNumber}. Ready for processing.`,
      severity: 'INFO',
    });

    return res.json({ ok: true, ...result });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'ORDER_NOT_FOUND') return res.status(404).json({ message: 'Lab order not found' });
    if (msg === 'ORDER_NOT_PENDING') return res.status(409).json({ message: 'Order is not pending billing' });
    if (msg === 'ORDER_ALREADY_BILLED') return res.status(409).json({ message: 'Order already billed' });
    if (msg === 'ORDER_NO_CHARGE_LINES') return res.status(400).json({ message: 'No billable lab tests found on this order' });
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not approve lab order' });
  }
}

/** Maps DB enum → UI workflow string (API contract). */
function labWorkflowStatus(dbStatus) {
  const s = String(dbStatus || '').toUpperCase();
  if (s === 'BILLED') return 'pending_sample';
  if (s === 'COLLECTED') return 'collected';
  if (s === 'IN_PROGRESS') return 'in_progress';
  if (s === 'COMPLETED') return 'completed';
  if (s === 'PENDING_BILLING') return 'pending_billing';
  if (s === 'CANCELLED') return 'cancelled';
  return s.toLowerCase();
}

function parseLabOrderStatusFilter(raw) {
  const s = normalizeString(raw).toUpperCase();
  if (!s || s === 'ALL' || s === 'ACTIVE' || s === 'WORKQUEUE') {
    return ['BILLED', 'COLLECTED', 'IN_PROGRESS'].filter((x) => LAB_ORDER_STATUS_VALUES.has(x));
  }
  /** Lab dashboard: all live + completed orders (excludes CANCELLED only). */
  if (s === 'DASHBOARD' || s === 'OVERVIEW') {
    return ['PENDING_BILLING', 'BILLED', 'COLLECTED', 'IN_PROGRESS', 'COMPLETED'].filter((x) =>
      LAB_ORDER_STATUS_VALUES.has(x),
    );
  }
  if (s.includes(',')) {
    return s
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
  }
  return [s];
}

function labOrderRowToRequestPayload(o) {
  return {
    id: o.id,
    requestId: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    workflowStatus: labWorkflowStatus(o.status),
    reportStatus: o.reportStatus,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt || o.createdAt,
    billedAt: o.billedAt,
    billNumber: o.bill?.billNumber || null,
    patient: o.patient,
    doctorName: o.doctor?.user?.name || '',
    tests: (o.items || []).map((it) => ({
      id: it.id,
      testId: null,
      name: it.testName,
      category: it.category,
      unit: it.unit,
      referenceRange: it.referenceRange,
    })),
  };
}

// --- Lab work queue (LabOrder = billed lab "request" in workflow) ---
/** @param {Record<string, unknown>|null} [queryMerge] merged on top of req.query (do not mutate req.query — Express 5 makes it read-only). */
async function listLabWorkOrders(req, res, queryMerge = null) {
  const base = req.query != null && typeof req.query === 'object' ? { ...req.query } : {};
  const query = queryMerge != null && typeof queryMerge === 'object' ? { ...base, ...queryMerge } : base;
  const q = normalizeString(query.q).toLowerCase();
  const statusParts = parseLabOrderStatusFilter(query.status);
  const statuses = statusParts.filter((x) => LAB_ORDER_STATUS_VALUES.has(x));
  const whereStatus = statuses.length ? { in: statuses } : { in: [LS.BILLED] };

  const rows = await prisma.labOrder.findMany({
    where: { status: whereStatus },
    orderBy: [{ createdAt: 'desc' }],
    take: 300,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      reportStatus: true,
      createdAt: true,
      updatedAt: true,
      billedAt: true,
      patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
      doctor: { select: { user: { select: { name: true } } } },
      items: { select: { id: true, testName: true, category: true, unit: true, referenceRange: true } },
      bill: { select: { billNumber: true } },
    },
  });

  const items = rows
    .map((o) => labOrderRowToRequestPayload(o))
    .filter((o) => {
      if (!q) return true;
      const blob = `${o.orderNumber} ${o.patient?.name} ${o.patient?.uhid} ${o.patient?.mobile} ${o.doctorName}`.toLowerCase();
      return blob.includes(q);
    });

  return res.json({ items });
}

/** GET /lab/requests — active workflow rows (default: billed + collected + in progress). */
async function listLabRequests(req, res) {
  return listLabWorkOrders(req, res, { status: req.query?.status || 'ACTIVE' });
}

async function getLabOrderDetail(req, res) {
  const id = normalizeString(req.params.id);
  const o = await prisma.labOrder.findUnique({
    where: { id },
    include: {
      patient: { select: { name: true, uhid: true, mobile: true, age: true, gender: true } },
      doctor: { include: { user: { select: { name: true } } } },
      items: true,
      results: { orderBy: [{ createdAt: 'asc' }] },
      bill: { select: { id: true, billNumber: true, totalAmount: true, paidAmount: true, status: true } },
    },
  });
  if (!o) return res.status(404).json({ message: 'Lab order not found' });
  return res.json({ order: o });
}

async function submitLabResults(req, res) {
  if (!LS.IN_PROGRESS) {
    return res.status(503).json({
      message:
        'Lab workflow enum is outdated (missing IN_PROGRESS). Run: npx prisma migrate deploy && npx prisma generate',
    });
  }
  const userId = req.user?.userId || null;
  const id = normalizeString(req.params.id || req.body?.requestId || req.body?.labOrderId);
  const results = Array.isArray(req.body?.results) ? req.body.results : [];
  const overallRemarks = normalizeString(req.body?.overallRemarks) || null;
  const diagnosis = normalizeString(req.body?.diagnosis) || null;
  const verifiedBy = normalizeString(req.body?.verifiedBy) || null;
  const approvedBy = normalizeString(req.body?.approvedBy) || null;
  const reportStatusRaw = normalizeString(req.body?.reportStatus).toUpperCase();
  const reportStatus = reportStatusRaw === 'VERIFIED' ? 'VERIFIED' : reportStatusRaw === 'COMPLETED' ? 'COMPLETED' : 'COMPLETED';

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== LS.IN_PROGRESS && order.status !== LS.COMPLETED) throw new Error('ORDER_NOT_READY');

      // Replace existing results for simplicity (idempotent submit)
      await tx.labResult.deleteMany({ where: { labOrderId: order.id } });

      const filledResults = results.filter((r) => normalizeString(r?.value));
      if (!filledResults.length) throw new Error('NO_RESULTS');

      await tx.labResult.createMany({
        data: filledResults.map((r) => {
          const testName = normalizeString(r.testName);
          const it = findOrderItemForResult(order.items, r);
          return {
            labOrderId: order.id,
            orderItemId: it?.id || null,
            testName,
            value: normalizeString(r.value),
            unit: normalizeString(r.unit) || it?.unit || null,
            referenceRange: normalizeString(r.referenceRange) || it?.referenceRange || null,
            category:
              normalizeString(r.category) ||
              normalizeString(it?.category) ||
              resolveResultCategory({ remarks: r.remarks, testName }, order.items) ||
              null,
            remarks: normalizeString(r.remarks) || null,
            attachmentUrl: normalizeString(r.fileUrl || r.attachmentUrl) || null,
            enteredByUserId: userId,
          };
        }),
      });

      const updated = await tx.labOrder.update({
        where: { id: order.id },
        data: {
          status: LS.COMPLETED,
          reportStatus,
          notes: overallRemarks || diagnosis || verifiedBy || approvedBy ? [overallRemarks, diagnosis, verifiedBy, approvedBy].filter(Boolean).join(' | ') : order.notes,
        },
        select: { id: true, orderNumber: true, status: true, reportStatus: true, patientId: true },
      });
      return updated;
    });

    try {
      const detail = await prisma.labOrder.findUnique({
        where: { id: saved.id },
        select: {
          orderNumber: true,
          patient: {
          select: {
            name: true,
            uhid: true,
            visits: { orderBy: [{ visitDate: 'desc' }], take: 1, select: { sponsor: true } },
          },
        },
          doctor: { select: { userId: true } },
        },
      });
      const recipientIds = new Set();
      const receptionists = await prisma.user.findMany({
        where: { role: 'RECEPTIONIST', isActive: true },
        select: { id: true },
        take: 200,
      });
      receptionists.forEach((u) => recipientIds.add(u.id));
      if (detail?.doctor?.userId) recipientIds.add(detail.doctor.userId);
      if (recipientIds.size) {
        const patientName = detail?.patient?.name || 'Patient';
        const uhid = detail?.patient?.uhid ? ` (${detail.patient.uhid})` : '';
        const title = 'Lab report ready';
        const message = `Lab report for ${patientName}${uhid} is available · Order ${detail?.orderNumber || saved.orderNumber}.`;
        await prisma.notification.createMany({
          data: [...recipientIds].map((userId) => ({
            userId,
            type: 'UPDATE',
            severity: 'INFO',
            title,
            message,
          })),
        });
      }
    } catch (notifyErr) {
      // eslint-disable-next-line no-console
      console.error('Lab report completion notifications', notifyErr);
    }

    const reportReady = String(saved.reportStatus || '').toUpperCase();
    if (saved.patientId && (reportReady === 'COMPLETED' || reportReady === 'VERIFIED')) {
      setImmediate(() => {
        emitAbdmClinicalEvent({
          type: EVENT.LAB_REPORT,
          sourceId: saved.id,
          patientId: saved.patientId,
        }).catch((err) => {
          console.error('[abdm-hr] LAB emit failed', saved.id, err?.message);
        });
      });
    }

    return res.json({ ok: true, order: saved });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'ORDER_NOT_FOUND') return res.status(404).json({ message: 'Lab order not found' });
    if (msg === 'ORDER_NOT_READY') {
      return res.status(409).json({
        message: 'Use “Start test” after sample collection, then enter results (status must be in progress).',
      });
    }
    if (msg === 'NO_RESULTS') {
      return res.status(400).json({ message: 'At least one result value is required' });
    }
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not submit results' });
  }
}

async function collectLabRequest(req, res) {
  const id = normalizeString(req.params.id);
  try {
    const order = await prisma.labOrder.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) return res.status(404).json({ message: 'Lab request not found' });
    if (order.status !== LS.BILLED) {
      return res.status(409).json({ message: 'Sample can only be collected when status is billed (pending sample)' });
    }
    const updated = await prisma.labOrder.update({
      where: { id },
      data: { status: LS.COLLECTED },
      select: { id: true, orderNumber: true, status: true },
    });
    return res.json({ ok: true, request: { ...updated, workflowStatus: labWorkflowStatus(updated.status) } });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not collect sample' });
  }
}

async function startLabRequest(req, res) {
  const id = normalizeString(req.params.id);
  if (!LS.IN_PROGRESS) {
    return res.status(503).json({
      message:
        'Lab workflow enum is outdated (missing IN_PROGRESS). Run: npx prisma migrate deploy && npx prisma generate',
    });
  }
  try {
    const order = await prisma.labOrder.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) return res.status(404).json({ message: 'Lab request not found' });
    if (order.status !== LS.COLLECTED) {
      return res.status(409).json({ message: 'Start test is only allowed after sample is collected' });
    }
    const updated = await prisma.labOrder.update({
      where: { id },
      data: { status: LS.IN_PROGRESS },
      select: { id: true, orderNumber: true, status: true },
    });
    return res.json({ ok: true, request: { ...updated, workflowStatus: labWorkflowStatus(updated.status) } });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not start processing' });
  }
}

async function getLabReportByRequestId(req, res) {
  const id = normalizeString(req.params.requestId);
  const order = await prisma.labOrder.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
      doctor: { include: { user: { select: { name: true } } } },
      items: true,
      results: { orderBy: [{ createdAt: 'asc' }] },
      bill: { select: { billNumber: true, totalAmount: true } },
    },
  });
  if (!order) return res.status(404).json({ message: 'Report not found' });
  const nurseGate = await assertNurseLabPatientAccess(req, order.patientId);
  if (!nurseGate.ok) return res.status(nurseGate.status).json({ message: nurseGate.message });
  if (order.status !== LS.COMPLETED) {
    return res.status(409).json({ message: 'Report is not available until results are completed' });
  }
  return res.json({
    requestId: order.id,
    orderNumber: order.orderNumber,
    workflowStatus: labWorkflowStatus(order.status),
    reportStatus: order.reportStatus,
    patient: order.patient,
    doctorName: order.doctor?.user?.name || '',
    billNumber: order.bill?.billNumber || null,
    notes: order.notes || null,
    updatedAt: order.updatedAt,
    tests: (order.items || []).map((it) => ({
      id: it.id,
      name: it.testName,
      category: it.category,
      unit: it.unit,
      referenceRange: it.referenceRange,
    })),
    results: (order.results || [])
      .filter((r) => normalizeString(r?.value))
      .map((r) => ({
          testName: r.testName,
          value: r.value,
          unit: r.unit,
          referenceRange: r.referenceRange,
          remarks: r.remarks,
          fileUrl: r.attachmentUrl,
          createdAt: r.createdAt,
          category: normalizeString(r.category) || resolveResultCategory(r, order.items) || null,
          orderItemId: r.orderItemId,
        })),
    createdAt: order.createdAt,
  });
}

async function postLabReports(req, res) {
  if (!Array.isArray(req.body?.results) || !req.body.results.length) {
    return res.status(400).json({ message: 'results array is required' });
  }
  return submitLabResults(req, res);
}

async function listPatientLabReports(req, res) {
  const patientId = normalizeString(req.params.id);
  if (!patientId) return res.status(400).json({ message: 'Patient id is required' });
  const nurseGate = await assertNurseLabPatientAccess(req, patientId);
  if (!nurseGate.ok) return res.status(nurseGate.status).json({ message: nurseGate.message });
  const rows = await prisma.labOrder.findMany({
    where: { patientId, status: LS.COMPLETED },
    orderBy: [{ updatedAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      reportStatus: true,
      updatedAt: true,
      consultationId: true,
      items: { select: { testName: true } },
      results: { select: { testName: true, value: true, unit: true, remarks: true, attachmentUrl: true } },
    },
  });
  return res.json({
    items: rows.map((o) => ({
      requestId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      workflowStatus: labWorkflowStatus(o.status),
      reportStatus: o.reportStatus,
      completedAt: o.updatedAt,
      consultationId: o.consultationId || null,
      tests: (o.items || []).map((i) => i.testName),
      results: o.results || [],
    })),
  });
}

// --- OPD test advice → bill + lab order (receptionist) ---
async function listPendingTestAdvice(req, res) {
  try {
    const uhidFilter = normalizeString(req.query.uhid);
    const rows = await prisma.testAdvice.findMany({
      where: {
        status: TEST_ADVICE_PENDING,
        ...(uhidFilter
          ? { patient: { uhid: { equals: uhidFilter, mode: 'insensitive' } } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        patient: {
          select: {
            name: true,
            uhid: true,
            visits: { orderBy: [{ visitDate: 'desc' }], take: 1, select: { sponsor: true } },
          },
        },
        doctor: {
          select: {
            user: { select: { name: true } },
          },
        },
        items: {
          select: {
            test: { select: { id: true, name: true, price: true, category: true } },
          },
        },
      },
    });

    const out = rows.map((a) => {
      const sponsor = a.patient?.visits?.[0]?.sponsor || '';
      const ayushman = isAyushmanSponsor(sponsor);
      const tests = (a.items || []).map((it) => ({
        testId: it.test?.id ?? null,
        name: it.test?.name || '—',
        category: it.test?.category || '',
        price: Math.max(0, Math.round(Number(it.test?.price) || 0)),
      }));
      const totalAmount = tests.reduce((s, t) => s + t.price, 0);
      return {
        id: a.id,
        patient: a.patient?.name || '',
        patientUhid: a.patient?.uhid || '',
        sponsor,
        isAyushman: ayushman,
        doctor: a.doctor?.user?.name || '',
        tests,
        totalAmount,
        createdAt: a.createdAt,
      };
    });

    return res.json(out);
  } catch (e) {
    const msg = String(e?.message || e || '');
    // eslint-disable-next-line no-console
    console.error('listPendingTestAdvice', e);
    if (
      /Invalid `prisma\.testAdvice\.findMany/i.test(msg) ||
      /Unknown argument [`']?status|`status` does not exist|Unknown field [`']?status/i.test(msg)
    ) {
      return res.status(503).json({
        message:
          'API Prisma layer is out of sync with the database or schema. In the backend folder run: npx prisma migrate deploy && npx prisma generate — then restart the server (stop all node processes first). Frontend npm run build does not refresh Prisma; the backend must run generate. If generate fails with EPERM on Windows, exclude backend/node_modules from OneDrive sync or copy the project outside OneDrive.',
      });
    }
    if ((/does not exist|Unknown column|not available/i.test(msg) && /status/i.test(msg)) || /TestAdvice\.status/i.test(msg)) {
      return res.status(503).json({
        message:
          'Database needs updating. In backend folder run: npx prisma migrate deploy && npx prisma generate — then restart the API.',
      });
    }
    return res.status(500).json({
      message: msg.length > 200 ? `${msg.slice(0, 200)}…` : msg || 'Could not load pending lab advice',
    });
  }
}

async function confirmTestAdvice(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const adviceId = parseInt(String(req.body?.advice_id ?? req.body?.adviceId ?? ''), 10);
  if (!Number.isFinite(adviceId) || adviceId < 1) {
    return res.status(400).json({ message: 'advice_id is required' });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const advice = await tx.testAdvice.findUnique({
          where: { id: adviceId },
          include: {
            items: { include: { test: true } },
            consultation: { select: { appointmentId: true } },
          },
        });
        if (!advice) throw new Error('ADVICE_NOT_FOUND');
        if (advice.status !== TEST_ADVICE_PENDING) throw new Error('ADVICE_NOT_PENDING');
        if (!advice.items?.length) throw new Error('ADVICE_NO_ITEMS');

        const sponsor = await getLatestPatientSponsor(tx, advice.patientId);
        const ayushman = isAyushmanSponsor(sponsor);
        const lines = [];
        const orderItems = [];
        for (const it of advice.items) {
          const test = it.test;
          if (!test) continue;
          const unitPrice = Math.max(0, Math.round(Number(test.price) || 0));
          const qty = 1;
          const lineTotal = qty * unitPrice;
          if (lineTotal <= 0) continue;
          lines.push({
            description: `Lab Test: ${test.name}`,
            quantity: qty,
            unitPrice,
            lineTotal,
          });
          orderItems.push({
            testName: test.name,
            category: test.category || null,
            unit: null,
            referenceRange: null,
            price: unitPrice,
            quantity: qty,
            testId: null,
          });
        }
        if (!lines.length) throw new Error('ADVICE_NO_CHARGE_LINES');

        const orderNumber = await allocateNextLabOrderNumber(tx, new Date());
        const billDate = new Date();
        const billNumber = await allocateNextBillNumber(tx, billDate);
        const subtotalAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
        const totalAmount = subtotalAmount;
        let paidAmount = 0;
        let billStatus = computeBillStatus(paidAmount, totalAmount);
        let lastPaymentMode = null;
        if (ayushman) {
          const z = createAyushmanBillTotals({ subtotalAmount, discountAmount: 0, taxAmount: 0, totalAmount });
          paidAmount = z.paidAmount;
          billStatus = z.status;
          lastPaymentMode = z.lastPaymentMode;
        }

        const bill = await tx.bill.create({
          data: {
            billNumber,
            patientId: advice.patientId,
            visitType: 'OPD',
            status: billStatus,
            subtotalAmount,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount,
            paidAmount,
            lastPaymentMode,
            appointmentId: advice.consultation?.appointmentId || null,
            notes: ayushman
              ? `OPD lab advice #${advice.id} · ${orderNumber} · PAID BY AYUSHMAN`
              : `OPD lab advice #${advice.id} · ${orderNumber}`,
            billDate,
            lineItems: {
              create: lines.map((l) => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
              })),
            },
          },
          select: { id: true, billNumber: true, totalAmount: true, paidAmount: true, status: true },
        });

        const order = await tx.labOrder.create({
          data: {
            orderNumber,
            patientId: advice.patientId,
            doctorId: advice.doctorId,
            appointmentId: advice.consultation?.appointmentId || null,
            consultationId: advice.consultationId || null,
            status: 'BILLED',
            reportStatus: 'PENDING',
            notes: `From OPD test advice #${advice.id}`,
            billedAt: new Date(),
            billedByUserId: userId,
            billId: bill.id,
            items: { create: orderItems },
          },
          select: { id: true, orderNumber: true, status: true },
        });

        const linked = await tx.testAdvice.updateMany({
          where: { id: advice.id, status: TEST_ADVICE_PENDING },
          data: { status: TEST_ADVICE_CONVERTED, labOrderId: order.id },
        });
        if (!linked.count) throw new Error('ADVICE_RACE');

        return { order, bill };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    await notifyRoleUsers({
      role: 'LAB_TECHNICIAN',
      title: 'New lab order',
      message: `OPD lab billed: ${result.order.orderNumber}. Ready for processing.`,
      severity: 'INFO',
    });

    return res.json({ ok: true, order: result.order, bill: result.bill });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'ADVICE_NOT_FOUND') return res.status(404).json({ message: 'Advice not found' });
    if (msg === 'ADVICE_NOT_PENDING') return res.status(409).json({ message: 'Advice already processed' });
    if (msg === 'ADVICE_NO_ITEMS') return res.status(400).json({ message: 'No tests on this advice' });
    if (msg === 'ADVICE_NO_CHARGE_LINES') {
      return res.status(400).json({ message: 'No billable tests — set prices on catalog tests' });
    }
    if (msg === 'ADVICE_RACE') return res.status(409).json({ message: 'Advice was updated by another user; refresh and try again' });
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not confirm lab advice' });
  }
}

async function resolveLabOrderDoctorId(tx, { doctorId, patientId }) {
  const wanted = normalizeString(doctorId);
  if (wanted) {
    const d = await tx.doctor.findUnique({
      where: { id: wanted },
      select: { id: true, user: { select: { isActive: true } } },
    });
    if (d?.user?.isActive) return d.id;
  }
  const appt = await tx.appointment.findFirst({
    where: { patientId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { doctorId: true },
  });
  if (appt?.doctorId) return appt.doctorId;
  const fallback = await tx.doctor.findFirst({
    where: { user: { isActive: true } },
    orderBy: { user: { createdAt: 'asc' } },
    select: { id: true },
  });
  if (!fallback?.id) throw new Error('NO_DOCTOR');
  return fallback.id;
}

/** Reception lab bill: [{ testId?, name, price? }] */
function parseManualTestLines(body) {
  const raw = body?.tests;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    if (typeof t === 'string') {
      const name = normalizeString(t);
      if (name) out.push({ testId: null, name, price: null });
      continue;
    }
    if (t && typeof t === 'object') {
      const name = normalizeString(t.name || t.testName);
      if (!name) continue;
      const testIdRaw = t.testId ?? t.id;
      const testId = testIdRaw != null && testIdRaw !== '' ? parseInt(String(testIdRaw), 10) : null;
      const priceRaw = t.price ?? t.amount ?? t.unitPrice;
      let price = null;
      if (priceRaw != null && priceRaw !== '') {
        const n = Number(priceRaw);
        if (Number.isFinite(n) && n >= 0) price = Math.trunc(n);
      }
      out.push({
        testId: Number.isFinite(testId) && testId > 0 ? testId : null,
        name,
        price,
      });
    }
  }
  return out;
}

async function resolveManagedLabTest(tx, { testId, name }) {
  if (testId) {
    const row = await tx.labTest.findFirst({ where: { id: testId, isActive: true } });
    if (row) return row;
  }
  const n = normalizeString(name);
  if (!n) return null;
  return tx.labTest.findFirst({
    where: { isActive: true, name: { equals: n, mode: 'insensitive' } },
  });
}

/** Split total across N test lines (last line absorbs rounding remainder). */
function splitAmountAcrossTests(total, count) {
  const n = Math.max(1, count);
  const t = Math.max(0, Math.round(Number(total) || 0));
  const base = Math.floor(t / n);
  let remainder = t - base * n;
  return Array.from({ length: n }, (_, i) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return base + extra;
  });
}

/** Close doctor test advice when the same tests were billed via reception direct lab bill. */
async function closeMatchingPendingAdvice(tx, patientId, labOrderId, billedTestNames) {
  const billedSet = new Set(billedTestNames.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean));
  if (!billedSet.size) return;
  const pending = await tx.testAdvice.findMany({
    where: { patientId, status: TEST_ADVICE_PENDING },
    include: { items: { include: { test: { select: { name: true } } } } },
  });
  let linked = false;
  for (const a of pending) {
    const adviceNames = (a.items || []).map((it) => it.test?.name).filter(Boolean);
    if (!adviceNames.length) continue;
    const allInBill = adviceNames.every((n) => billedSet.has(String(n).trim().toLowerCase()));
    if (allInBill) {
      await tx.testAdvice.update({
        where: { id: a.id },
        data: { status: TEST_ADVICE_CONVERTED, ...(linked ? {} : { labOrderId }) },
      });
      linked = true;
    }
  }
}

/** POST /lab/receptionist/bills — walk-in / direct lab billing for any patient (repeatable). */
async function createReceptionistLabBill(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const uhid = normalizeString(req.body?.uhid);
  const patientIdBody = normalizeString(req.body?.patientId);
  const doctorIdBody = normalizeString(req.body?.doctorId);
  const notes = normalizeString(req.body?.notes) || null;
  const paymentMode = normalizeString(req.body?.paymentMode) || 'Cash';
  const paidAmountInput = Number(req.body?.paidAmount);
  const totalAmountInput = Number(req.body?.totalAmount);
  const testLines = parseManualTestLines(req.body);

  if (!testLines.length) return res.status(400).json({ message: 'Enter at least one lab test name' });
  if (!uhid && !patientIdBody) return res.status(400).json({ message: 'Patient UHID or patientId is required' });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        let patient = null;
        if (patientIdBody) {
          patient = await tx.patient.findUnique({ where: { id: patientIdBody }, select: { id: true, uhid: true, name: true } });
        } else if (uhid) {
          patient = await tx.patient.findUnique({ where: { uhid }, select: { id: true, uhid: true, name: true } });
        }
        if (!patient) throw new Error('PATIENT_NOT_FOUND');

        const doctorId = await resolveLabOrderDoctorId(tx, { doctorId: doctorIdBody, patientId: patient.id });
        const sponsor = await getLatestPatientSponsor(tx, patient.id);
        const ayushman = isAyushmanSponsor(sponsor);

        const resolvedLines = [];
        for (const t of testLines) {
          const hit = await resolveManagedLabTest(tx, { testId: t.testId, name: t.name });
          if (!hit) throw new Error('TEST_NOT_IN_CATALOG');
          const unitPrice =
            t.price != null && t.price >= 0 ? Math.trunc(t.price) : Math.max(0, Math.round(Number(hit.price) || 0));
          if (unitPrice <= 0 && !ayushman) throw new Error('TEST_PRICE_ZERO');
          resolvedLines.push({
            testId: hit.id,
            name: hit.name,
            category: hit.category || 'Other',
            unitPrice,
          });
        }

        const lines = [];
        const orderItems = [];
        resolvedLines.forEach((t) => {
          const qty = 1;
          const lineTotal = t.unitPrice * qty;
          lines.push({
            description: `Lab Test: ${t.name}`,
            quantity: qty,
            unitPrice: t.unitPrice,
            lineTotal,
          });
          orderItems.push({
            testId: null,
            testName: t.name,
            category: t.category,
            unit: null,
            referenceRange: null,
            price: t.unitPrice,
            quantity: qty,
          });
        });
        if (!lines.length) throw new Error('NO_CHARGE_LINES');

        const orderNumber = await allocateNextLabOrderNumber(tx, new Date());
        const billDate = new Date();
        const billNumber = await allocateNextBillNumber(tx, billDate);
        const subtotalAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
        const totalAmount = subtotalAmount;
        let paidAmount = 0;
        let lastPaymentMode = null;
        let billStatus = computeBillStatus(paidAmount, totalAmount);
        if (ayushman) {
          const z = createAyushmanBillTotals({ subtotalAmount, discountAmount: 0, taxAmount: 0, totalAmount });
          paidAmount = z.paidAmount;
          lastPaymentMode = z.lastPaymentMode;
          billStatus = z.status;
        } else {
          if (Number.isFinite(paidAmountInput) && paidAmountInput >= 0) {
            paidAmount = Math.min(Math.trunc(paidAmountInput), totalAmount);
          }
          if (paidAmount > 0) lastPaymentMode = paymentMode || 'Cash';
          billStatus = computeBillStatus(paidAmount, totalAmount);
        }

        const bill = await tx.bill.create({
          data: {
            billNumber,
            patientId: patient.id,
            visitType: 'OPD',
            status: billStatus,
            subtotalAmount,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount,
            paidAmount,
            lastPaymentMode,
            notes: notes || `Reception lab bill · ${orderNumber}`,
            billDate,
            lineItems: {
              create: lines.map((l) => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
              })),
            },
          },
          select: { id: true, billNumber: true, totalAmount: true, paidAmount: true, status: true },
        });

        const order = await tx.labOrder.create({
          data: {
            orderNumber,
            patientId: patient.id,
            doctorId,
            status: 'BILLED',
            reportStatus: 'PENDING',
            notes: notes || 'Reception direct lab billing',
            billedAt: new Date(),
            billedByUserId: userId,
            billId: bill.id,
            items: { create: orderItems },
          },
          select: { id: true, orderNumber: true, status: true },
        });

        await closeMatchingPendingAdvice(
          tx,
          patient.id,
          order.id,
          resolvedLines.map((t) => t.name),
        );

        const doctor = await tx.doctor.findUnique({
          where: { id: doctorId },
          select: { user: { select: { name: true } } },
        });

        return {
          order,
          bill,
          patient,
          doctorName: doctor?.user?.name || '',
          sponsor,
          isAyushman: ayushman,
          tests: resolvedLines.map((t) => ({
            testId: t.testId,
            name: t.name,
            price: t.unitPrice,
          })),
        };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    await notifyRoleUsers({
      role: 'LAB_TECHNICIAN',
      title: 'New lab order',
      message: `Reception lab bill: ${result.order.orderNumber}. Ready for processing.`,
      severity: 'INFO',
    });

    return res.status(201).json({ ok: true, ...result });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'PATIENT_NOT_FOUND') return res.status(404).json({ message: 'Patient not found' });
    if (msg === 'TOTAL_AMOUNT_REQUIRED') return res.status(400).json({ message: 'Enter a valid bill amount (₹)' });
    if (msg === 'TEST_PRICE_REQUIRED') {
      return res.status(400).json({ message: 'Har test ke saath amount (₹) enter karein' });
    }
    if (msg === 'TEST_NOT_IN_CATALOG') {
      return res.status(400).json({ message: 'Test admin catalog se select karein (active test)' });
    }
    if (msg === 'TEST_PRICE_ZERO') {
      return res.status(400).json({ message: 'Test price admin me set karein' });
    }
    if (msg === 'INVALID_TEST_PRICE') return res.status(400).json({ message: 'Test amount invalid' });
    if (msg === 'NO_CHARGE_LINES') return res.status(400).json({ message: 'Could not build bill lines' });
    if (msg === 'NO_DOCTOR') return res.status(400).json({ message: 'No active doctor available — add a doctor first' });
    if (msg === 'BILL_NUMBER_EXHAUSTED') return res.status(500).json({ message: 'Bill number limit reached — try again tomorrow' });
    if (msg === 'LAB_ORDER_NUMBER_EXHAUSTED') return res.status(500).json({ message: 'Order number limit reached — try again tomorrow' });
    if (msg === 'BILL_DATE_INVALID' || msg === 'LAB_ORDER_DATE_INVALID') return res.status(500).json({ message: 'Server date error — contact admin' });
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not create lab bill' });
  }
}

/** GET /lab/receptionist/bills — all lab bills; ?dueOnly=1 → payment pending only */
async function listReceptionistLabBills(req, res) {
  const q = normalizeString(req.query.q).toLowerCase();
  const dueOnly = ['1', 'true', 'yes'].includes(String(req.query.dueOnly || '').toLowerCase());
  const rows = await prisma.labOrder.findMany({
    where: { billId: { not: null } },
    orderBy: [{ billedAt: 'desc' }, { createdAt: 'desc' }],
    take: 400,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      billedAt: true,
      createdAt: true,
      patient: { select: { id: true, name: true, uhid: true, mobile: true } },
      doctor: { select: { user: { select: { name: true } } } },
      bill: {
        select: {
          id: true,
          billNumber: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          billDate: true,
          lastPaymentMode: true,
        },
      },
      items: { select: { testName: true, price: true, quantity: true } },
    },
  });

  const items = rows
    .map((o) => {
      const tests = (o.items || []).map((it) => ({
        name: it.testName,
        price: it.price || 0,
        qty: it.quantity || 1,
      }));
      const totalFromItems = tests.reduce((s, t) => s + Math.max(0, t.price) * (t.qty || 1), 0);
      const bill = o.bill || {};
      const totalAmount = bill.totalAmount ?? totalFromItems;
      const paidAmount = bill.paidAmount ?? 0;
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        orderStatus: o.status,
        billedAt: o.billedAt || o.createdAt,
        patient: o.patient,
        doctorName: o.doctor?.user?.name || '',
        tests,
        billId: bill.id || null,
        billNumber: bill.billNumber || '',
        totalAmount,
        paidAmount,
        pendingAmount: Math.max(0, totalAmount - paidAmount),
        paymentStatus: bill.status || '',
        paymentMode: bill.lastPaymentMode || '',
        billDate: bill.billDate || o.billedAt || o.createdAt,
      };
    })
    .filter((row) => {
      if (!q) return true;
      const p = row.patient || {};
      const blob = `${row.orderNumber} ${row.billNumber} ${p.name} ${p.uhid} ${p.mobile} ${row.doctorName} ${row.tests.map((t) => t.name).join(' ')}`.toLowerCase();
      return blob.includes(q);
    })
    .filter((row) => {
      if (!dueOnly) return true;
      const st = String(row.paymentStatus || '').toUpperCase();
      if (st === 'PAID') return false;
      return (row.pendingAmount ?? 0) > 0;
    });

  return res.json({ items });
}

const CUSTOM_PARAMS_PATH = path.join(__dirname, 'customParams.json');

function readCustomParams() {
  try {
    if (!fs.existsSync(CUSTOM_PARAMS_PATH)) return {};
    return JSON.parse(fs.readFileSync(CUSTOM_PARAMS_PATH, 'utf8'));
  } catch { return {}; }
}

function writeCustomParams(data) {
  fs.writeFileSync(CUSTOM_PARAMS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

const listCustomParams = async (req, res) => {
  try {
    const { department, testName } = req.query;
    const all = readCustomParams();
    if (department && testName) {
      return res.json({ items: all[`${department}::${testName}`] || [] });
    }
    return res.json({ items: [] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createCustomParam = async (req, res) => {
  try {
    const { department, testName, parameter, unit, referenceRange } = req.body;
    if (!department || !testName || !parameter) return res.status(400).json({ message: 'department, testName, parameter required' });
    const all = readCustomParams();
    const key = `${department}::${testName}`;
    if (!all[key]) all[key] = [];
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    all[key].push({ id, department, testName, parameter, unit: unit || '', referenceRange: referenceRange || '', createdAt: new Date().toISOString() });
    writeCustomParams(all);
    res.json({ message: 'Parameter added', id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const deleteCustomParam = async (req, res) => {
  try {
    const { id } = req.params;
    const all = readCustomParams();
    for (const key of Object.keys(all)) {
      const before = all[key].length;
      all[key] = all[key].filter((p) => p.id !== id);
      if (all[key].length === 0 && before > 0) delete all[key];
    }
    writeCustomParams(all);
    res.json({ message: 'Parameter deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/**
 * POST /lab/orders/:id/repeat
 * Create a fresh IN_PROGRESS lab order (a new test session) for the same patient as the
 * source order, so a repeat/new test does NOT overwrite the previous completed report.
 * The new order carries no results yet — the technician submits them via the results endpoint.
 */
async function createRepeatLabOrder(req, res) {
  if (!LS.IN_PROGRESS) {
    return res.status(503).json({
      message:
        'Lab workflow enum is outdated (missing IN_PROGRESS). Run: npx prisma migrate deploy && npx prisma generate',
    });
  }
  const sourceId = normalizeString(req.params.id);
  if (!sourceId) return res.status(400).json({ message: 'Source order id is required' });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const source = await tx.labOrder.findUnique({
        where: { id: sourceId },
        select: { id: true, patientId: true, doctorId: true },
      });
      if (!source) throw new Error('ORDER_NOT_FOUND');

      const orderNumber = await allocateNextLabOrderNumber(tx, new Date());
      return tx.labOrder.create({
        data: {
          orderNumber,
          patientId: source.patientId,
          doctorId: source.doctorId,
          status: LS.IN_PROGRESS,
          reportStatus: 'PENDING',
          notes: null,
        },
        select: { id: true, orderNumber: true, status: true, patientId: true },
      });
    });

    return res.status(201).json({ ok: true, order });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'ORDER_NOT_FOUND') return res.status(404).json({ message: 'Source lab order not found' });
    if (msg === 'LAB_ORDER_NUMBER_EXHAUSTED') {
      return res.status(500).json({ message: 'Order number limit reached — try again tomorrow' });
    }
    // eslint-disable-next-line no-console
    console.error('createRepeatLabOrder', e);
    return res.status(500).json({ message: 'Could not start a new test for this patient' });
  }
}

// ─── Nurse IPD Lab Advice ───

async function listNurseLabAdvice(req, res) {
  try {
    const admissionId = normalizeString(req.params.admissionId);
    if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true, doctorId: true },
    });
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const gate = await assertNurseLabPatientAccess(req, admission.patientId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const rows = await prisma.testAdvice.findMany({
      where: { admissionId, source: 'NURSE_IPD' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        clinicalNote: true,
        createdAt: true,
        items: {
          select: {
            test: { select: { name: true } },
          },
        },
      },
    });

    const out = rows.map((a) => ({
      id: a.id,
      status: a.status,
      clinicalNote: a.clinicalNote || '',
      tests: (a.items || []).map((it) => ({ name: it.test?.name || '—' })),
      createdAt: a.createdAt,
    }));

    return res.json(out);
  } catch (e) {
    console.error('listNurseLabAdvice', e);
    return res.status(500).json({ message: 'Could not load nurse lab advice' });
  }
}

async function createNurseLabAdvice(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });

    const admissionId = normalizeString(req.body?.admissionId);
    const testIds = Array.isArray(req.body?.testIds) ? req.body.testIds.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0) : [];
    const clinicalNote = String(req.body?.clinicalNote || '').trim();

    if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });
    if (!testIds.length) return res.status(400).json({ message: 'Select at least one test' });

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true, doctorId: true },
    });
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const gate = await assertNurseLabPatientAccess(req, admission.patientId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const advice = await prisma.testAdvice.create({
      data: {
        patientId: admission.patientId,
        doctorId: admission.doctorId,
        admissionId,
        source: 'NURSE_IPD',
        status: 'PENDING_BILLING',
        clinicalNote: clinicalNote || undefined,
        requestedByUserId: userId,
        items: {
          create: testIds.map((id) => ({ testId: id })),
        },
      },
      select: { id: true, status: true, createdAt: true },
    });

    return res.status(201).json({ advice });
  } catch (e) {
    console.error('createNurseLabAdvice', e);
    return res.status(500).json({ message: 'Could not create nurse lab advice' });
  }
}

module.exports = {
  listCatalog,
  listTestsSimple,
  createManagedLabTest,
  updateManagedLabTest,
  deleteManagedLabTest,
  listManagedLabCategories,
  createManagedLabCategory,
  renameManagedLabCategory,
  deleteManagedLabCategory,
  createLabOrderFromDoctor,
  listPendingTestAdvice,
  confirmTestAdvice,
  listReceptionistPendingOrders,
  getReceptionistOrderDetail,
  approveReceptionistOrderAndGenerateBill,
  listLabWorkOrders,
  listLabRequests,
  getLabOrderDetail,
  submitLabResults,
  createRepeatLabOrder,
  collectLabRequest,
  startLabRequest,
  getLabReportByRequestId,
  postLabReports,
  listPatientLabReports,
  createReceptionistLabBill,
  listReceptionistLabBills,
  listCustomParams,
  createCustomParam,
  deleteCustomParam,
  listNurseLabAdvice,
  createNurseLabAdvice,
};

