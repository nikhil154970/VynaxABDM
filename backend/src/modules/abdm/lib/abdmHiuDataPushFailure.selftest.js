require('dotenv').config();
const crypto = require('crypto');
const { prisma } = require('../../../config/prisma');
const { generateFideliusKeyMaterial } = require('./abdmHealthDataCrypto');
const { saveHiSession } = require('./abdmHiSessionStore');
const { pushHealthInformation } = require('./abdmHiDataPush');
const {
  handleHiuOnDataCallback,
  notifyHiuHealthInformation,
  upsertHiuClinicalRecord,
} = require('./abdmHiuDataFlow');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runHipPushFailures() {
  const hiu = generateFideliusKeyMaterial();
  const transactionId = crypto.randomUUID();
  saveHiSession({
    consentId: crypto.randomUUID(),
    transactionId,
    dateRange: { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.000Z' },
    dataPushUrl: 'http://127.0.0.1:9/mock-hiu/data/notification',
    keyMaterial: hiu.keyMaterial,
    requestId: crypto.randomUUID(),
  });
  const fhirBundle = { resourceType: 'Bundle', type: 'document', id: 'fail-push' };

  const conn = await pushHealthInformation({
    transactionId,
    fhirBundle,
    careContextReference: 'CC-FAIL-CONN',
    httpPost: async () => {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:9');
      err.code = 'ECONNREFUSED';
      throw err;
    },
  });
  assert(conn.status === 0 && conn.error === true, 'connection failure status 0');
  assert(String(conn.errorCode || '').includes('ECONNREFUSED') || Boolean(conn.errorMessage), 'connection error persisted on result');

  const http500 = await pushHealthInformation({
    transactionId,
    fhirBundle,
    careContextReference: 'CC-FAIL-500',
    httpPost: async () => ({ status: 500, data: { message: 'internal error' } }),
  });
  assert(http500.status === 500, 'HTTP 500 returned');
  assert(!(http500.status >= 200 && http500.status < 300), '500 is not success');

  const timeout = await pushHealthInformation({
    transactionId,
    fhirBundle,
    careContextReference: 'CC-FAIL-TIMEOUT',
    httpPost: async () => {
      const err = new Error('timeout of 30000ms exceeded');
      err.code = 'ECONNABORTED';
      throw err;
    },
  });
  assert(timeout.status === 0, 'timeout status 0');

  const malformed = await pushHealthInformation({
    transactionId,
    fhirBundle,
    careContextReference: 'CC-FAIL-MALFORMED',
    httpPost: async () => ({ status: 200, data: 'not-json-ack' }),
  });
  assert(malformed.status === 200, 'malformed body still has HTTP status');
  assert(typeof malformed.data === 'string', 'malformed acknowledgement body preserved');
}

async function runHiuOnDataFailures() {
  const keys = generateFideliusKeyMaterial();
  const transactionId = crypto.randomUUID();
  const consentId = crypto.randomUUID();
  const notifies = [];
  notifyHiuHealthInformation._testHook = async (payload) => {
    notifies.push(payload);
    return { status: 202, error: false };
  };

  const txn = await prisma.abdmHiuHiTransaction.create({
    data: {
      transactionId,
      consentId,
      dateFrom: '2026-01-01T00:00:00.000Z',
      dateTo: '2026-12-31T23:59:59.000Z',
      dataPushUrl: 'https://example.test/on-data',
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      nonce: keys.nonce,
      status: 'ACKNOWLEDGED',
    },
  });

  try {
    const unmatched = await handleHiuOnDataCallback({ foo: 'bar' });
    assert(unmatched.status === 202 && unmatched.body.acknowledgement === 'ACCEPTED', 'malformed ACK 202');
    const stillAck = await prisma.abdmHiuHiTransaction.findUnique({ where: { id: txn.id } });
    assert(stillAck.status === 'ACKNOWLEDGED', 'unmatched payload does not mark RECEIVED');

    const empty = await handleHiuOnDataCallback({ transactionId, entries: [] });
    assert(empty.status === 202 && empty.body.acknowledgement === 'ACCEPTED', 'empty entries ACK 202');
    const afterEmpty = await prisma.abdmHiuHiTransaction.findUnique({ where: { id: txn.id } });
    assert(afterEmpty.status === 'FAILED', 'empty entries marked FAILED');
    assert(afterEmpty.errorCode === 'HIU_DATA_FAILED', 'empty entries persist errorCode');
    assert(String(afterEmpty.errorMessage || '').includes('entries missing'), 'empty entries errorMessage');
    assert(notifies.some((row) => row.sessionStatus === 'FAILED'), 'empty entries notify FAILED');

    const missingCrypto = await handleHiuOnDataCallback({
      transactionId,
      entries: [{ careContextReference: 'CC-FAIL-1', content: null }],
    });
    assert(missingCrypto.status === 202, 'missing crypto ACK 202');
    const afterCrypto = await prisma.abdmHiuHiTransaction.findUnique({ where: { id: txn.id } });
    assert(afterCrypto.status === 'FAILED', 'missing crypto not RECEIVED');
    assert(afterCrypto.status !== 'RECEIVED', 'never false RECEIVED');

    const bundle = { resourceType: 'Bundle', type: 'document', id: 'retry-bundle' };
    await upsertHiuClinicalRecord({
      transactionId,
      consentId,
      careContextReference: 'CC-RETRY',
      resourceType: 'Bundle',
      recordType: 'OPConsultation',
      fhirPayload: bundle,
    });
    await upsertHiuClinicalRecord({
      transactionId: crypto.randomUUID(),
      consentId,
      careContextReference: 'CC-RETRY',
      resourceType: 'Bundle',
      recordType: 'OPConsultation',
      fhirPayload: bundle,
    });
    const recordCount = await prisma.abdmHiuHealthRecord.count({
      where: { consentId, careContextReference: 'CC-RETRY', recordType: 'OPConsultation' },
    });
    assert(recordCount === 1, 'retry does not duplicate health records');

    const txnCount = await prisma.abdmHiuHiTransaction.count({ where: { transactionId } });
    assert(txnCount === 1, 'retry does not duplicate HIU transactions');
  } finally {
    notifyHiuHealthInformation._testHook = null;
    await prisma.abdmHiuHealthRecord.deleteMany({ where: { consentId } }).catch(() => {});
    await prisma.abdmHiuHiTransaction.deleteMany({ where: { id: txn.id } }).catch(() => {});
  }
}

async function main() {
  await runHipPushFailures();
  await runHiuOnDataFailures();
  console.log('abdmHiuDataPushFailure.selftest OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
