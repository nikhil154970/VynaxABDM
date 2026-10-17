require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const http = require('http');

const prisma = new PrismaClient();

function request(method, path, token, body) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
        timeout: 10000,
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(b) });
          } catch {
            resolve({ status: res.statusCode, body: b });
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
}

async function login(email, password, role) {
  const res = await request('POST', '/api/auth/login', null, { email, password, role });
  return res.body?.accessToken;
}

async function main() {
  const rr = await prisma.recoveryRecord.findFirst({
    where: { status: 'READY_FOR_TRANSFER' },
    include: {
      assessments: { select: { id: true } },
      surgerySession: {
        include: {
          surgerySchedule: {
            include: { otRequest: { include: { patient: { select: { name: true, uhid: true } } } } },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!rr) {
    console.log('No READY_FOR_TRANSFER recovery record found');
    return;
  }

  console.log('Record:', {
    id: rr.id,
    status: rr.status,
    transferRequestStatus: rr.transferRequestStatus,
    assessments: rr.assessments.length,
    patient: rr.surgerySession?.surgerySchedule?.otRequest?.patient,
  });

  const cols = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'RecoveryRecord' AND column_name LIKE 'transfer%'
  `;
  console.log('DB columns:', cols);

  let token = await login('ot@gmail.com', '12345678', 'OT_TECHNICIAN');
  if (!token) token = await login('ot@test.com', '12345678', 'OT_TECHNICIAN');
  if (!token) token = await login('admin@vyanx.local', 'admin123', 'SUPER_ADMIN');
  if (!token) {
    const t2 = await login('shivani@gmail.com', '12345678', 'NURSE');
    if (!t2) {
      console.log('Login failed for all test accounts');
      return;
    }
    await testTransfer(t2);
    return;
  }
  await testTransfer(token);
}

async function testTransfer(token) {
  const rr = await prisma.recoveryRecord.findFirst({
    where: { status: 'READY_FOR_TRANSFER' },
    select: { id: true },
  });
  const res = await request('POST', '/api/ot/recovery/request-reception-transfer', token, {
    recoveryRecordId: rr.id,
    preferredWardType: 'GENERAL',
  });
  console.log('API response:', res);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
