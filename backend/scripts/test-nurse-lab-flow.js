require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const BASE = 'http://localhost:5000/api';

async function login(email, password, role) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Login ${role} failed: ${res.status} ${JSON.stringify(data)}`);
  return data.accessToken;
}

async function getJson(token, path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function postJson(token, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const nurseToken = await login('nurse@vyanx.local', 'ChangeMeNow123!', 'NURSE');
    const adminToken = await login('admin@vyanx.local', 'admin123', 'SUPER_ADMIN').catch(() => null);
    const receptionToken = await login('receptionist@gmail.com', '12345678', 'RECEPTIONIST');

    console.log('--- Nurse GET /lab/tests ---');
    const testsRes = await getJson(nurseToken, '/lab/tests');
    console.log('status', testsRes.status, 'body', JSON.stringify(testsRes.data)?.slice(0, 200), 'count', Array.isArray(testsRes.data) ? testsRes.data.length : testsRes.data?.tests?.length);

    console.log('--- Nurse GET /lab/tests?forBilling=1 ---');
    const billingRes = await getJson(nurseToken, '/lab/tests?forBilling=1');
    console.log('status', billingRes.status, 'count', billingRes.data?.tests?.length);

    if (adminToken) {
      console.log('--- Admin POST /lab/tests (no category) ---');
      const addRes = await postJson(adminToken, '/lab/tests', {
        name: `QA Test ${Date.now()}`,
        price: 99,
        isActive: true,
      });
      console.log('status', addRes.status, addRes.data);
    }

    const admission = await prisma.admission.findFirst({
      where: { nurseId: { not: null }, dischargeDate: null },
      select: { id: true, nurseId: true, patientId: true, nurse: { select: { email: true } } },
    });
    console.log('--- Sample active admission ---', admission);

    if (admission) {
      const nurseForAdmission = admission.nurse?.email
        ? await login(admission.nurse.email, '12345678', 'NURSE').catch(() => nurseToken)
        : nurseToken;

      const test = await prisma.labTest.findFirst({ where: { isActive: true }, select: { id: true, name: true } });
      console.log('--- Nurse POST /lab/advice/nurse ---', { admissionId: admission.id, testId: test?.id });
      const adviceRes = await postJson(nurseForAdmission, '/lab/advice/nurse', {
        admissionId: admission.id,
        testIds: test ? [test.id] : [1],
        clinicalNote: 'QA nurse lab request',
      });
      console.log('status', adviceRes.status, JSON.stringify(adviceRes.data)?.slice(0, 300));
    }

    console.log('--- Reception GET /lab/advice/pending ---');
    const pendingRes = await getJson(receptionToken, '/lab/advice/pending');
    console.log('status', pendingRes.status, 'count', Array.isArray(pendingRes.data) ? pendingRes.data.length : 'not-array');
    if (Array.isArray(pendingRes.data)) {
      const nurseRows = pendingRes.data.filter((r) => r.source === 'NURSE_IPD');
      console.log('NURSE_IPD rows', nurseRows.length, nurseRows.slice(0, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
