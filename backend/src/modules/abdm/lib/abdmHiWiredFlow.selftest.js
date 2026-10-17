require('dotenv').config();

const axios = require('axios');
const abdmSession = require('./abdmSession');
const { client } = require('./abdmClient');
const { prisma } = require('../../../config/prisma');

abdmSession.ensureAccessToken = async () => 'mock-access-token';

const notifyBodies = [];
client.post = async (path, body) => {
  const route = String(path || '');
  if (route.includes('/health-information/hip/on-request')) {
    return { status: 202, data: {} };
  }
  if (route.includes('/health-information/notify')) {
    notifyBodies.push(body);
    return { status: 202, data: { status: 'Notification is Accepted' } };
  }
  throw new Error(`unexpected gateway path: ${route}`);
};

let pushStatus = 202;
const pushPosts = [];
axios.post = async (url, body) => {
  pushPosts.push({ url, body });
  if (pushStatus === 0) {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:9');
    err.code = 'ECONNREFUSED';
    throw err;
  }
  if (pushStatus === 'TIMEOUT') {
    const err = new Error('timeout of 30000ms exceeded');
    err.code = 'ECONNABORTED';
    throw err;
  }
  return { status: pushStatus, data: pushStatus >= 200 && pushStatus < 300 ? { acknowledgement: 'ACCEPTED' } : { error: 'mock-fail' } };
};

const { generateFideliusKeyMaterial, checksumHealthInformation } = require('./abdmHealthDataCrypto');
const { getHiSessionByTransactionId } = require('./abdmHiSessionStore');
const { buildOpdConsultationBundleFromConsultationId } = require('../fhir/opConsultation');
const { handleHealthInformationRequestCallback } = require('../callbacks/dataFlowHip.controller');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildHiRequest({ transactionId, requestId, careContextReference, keyMaterial, dataPushUrl }) {
  return {
    headers: {
      'REQUEST-ID': requestId,
      TIMESTAMP: '2026-10-04T03:00:00.000Z',
      'X-HIP-ID': 'IN1010001531',
    },
    body: {
      transactionId,
      hiRequest: {
        consent: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
        dateRange: {
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-12-31T23:59:59.000Z',
        },
        dataPushUrl,
        keyMaterial,
        careContexts: [{ careContextReference }],
      },
    },
  };
}

async function run() {
  const row = await prisma.abdmCareContext.findFirst({
    where: { sourceType: 'CONSULTATION', episodeType: 'OPD_CONSULTATION' },
    orderBy: { createdAt: 'desc' },
    select: { careContextId: true, sourceId: true },
  });
  if (!row?.careContextId || !row.sourceId) {
    throw new Error('FAIL: no existing OPD consultation/care context in DB');
  }

  restoreDoc = await prisma.abdmHealthDocument.findUnique({
    where: { sourceType_sourceId: { sourceType: 'CONSULTATION', sourceId: row.sourceId } },
    select: { id: true, syncStatus: true, errorCode: true, errorMessage: true },
  });

  const hiu = generateFideliusKeyMaterial();
  const dataPushUrl = 'http://127.0.0.1:9/mock-hiu/data/notification';
  const expectedBundle = await buildOpdConsultationBundleFromConsultationId(row.sourceId);
  const expectedChecksum = checksumHealthInformation(JSON.stringify(expectedBundle));

  const successTxn = 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb';
  const successReq = buildHiRequest({
    transactionId: successTxn,
    requestId: 'aaaaaaaa-0000-4000-8000-000000000001',
    careContextReference: row.careContextId,
    keyMaterial: hiu.keyMaterial,
    dataPushUrl,
  });

  pushStatus = 202;
  notifyBodies.length = 0;
  pushPosts.length = 0;
  const success = await handleHealthInformationRequestCallback(successReq.body, successReq.headers);
  assert(success.status === 202, 'HI request should return 202');

  const session = getHiSessionByTransactionId(successTxn);
  assert(session?.transactionId === successTxn, 'session save');
  assert(session.dataPushUrl === dataPushUrl, 'session dataPushUrl');
  assert(pushPosts.length === 1, 'dataPushUrl POST');
  assert(pushPosts[0].url === dataPushUrl, 'mock dataPushUrl');
  assert(pushPosts[0].body.transactionId === successTxn, 'push transactionId');
  assert(pushPosts[0].body.entries[0].media === 'application/fhir+json', 'media');
  assert(pushPosts[0].body.entries[0].careContextReference === row.careContextId, 'careContextReference');
  assert(pushPosts[0].body.entries[0].checksum === expectedChecksum, 'plaintext MD5 checksum');
  assert(typeof pushPosts[0].body.entries[0].content === 'string' && pushPosts[0].body.entries[0].content.length > 0, 'encrypted content');
  assert(notifyBodies.length === 1, 'notify after successful push');
  assert(notifyBodies[0].notification.transactionId === successTxn, 'notify transactionId');
  assert(notifyBodies[0].notification.statusNotification.sessionStatus === 'TRANSFERRED', 'TRANSFERRED');
  assert(notifyBodies[0].notification.statusNotification.statusResponses[0].hiStatus === 'OK', 'OK');

  const failTxn = 'bbbbbbbb-1111-4222-8333-cccccccccccc';
  const failReq = buildHiRequest({
    transactionId: failTxn,
    requestId: 'bbbbbbbb-0000-4000-8000-000000000002',
    careContextReference: row.careContextId,
    keyMaterial: hiu.keyMaterial,
    dataPushUrl,
  });
  pushStatus = 500;
  notifyBodies.length = 0;
  pushPosts.length = 0;
  const failed = await handleHealthInformationRequestCallback(failReq.body, failReq.headers);
  assert(failed.status === 202, 'callback still 202 on push fail');
  assert(pushPosts.length === 1, 'failed push still posted');
  assert(
    notifyBodies.length === 1
      && notifyBodies[0].notification.statusNotification.sessionStatus === 'FAILED'
      && notifyBodies[0].notification.statusNotification.statusResponses[0].hiStatus === 'ERRORED',
    'WIRING ERROR: push failure did not call notifyHealthInformation(FAILED/ERRORED)'
  );

  const connTxn = 'cccccccc-1111-4222-8333-dddddddddddd';
  const connReq = buildHiRequest({
    transactionId: connTxn,
    requestId: 'cccccccc-0000-4000-8000-000000000003',
    careContextReference: row.careContextId,
    keyMaterial: hiu.keyMaterial,
    dataPushUrl,
  });
  pushStatus = 0;
  notifyBodies.length = 0;
  pushPosts.length = 0;
  const connFailed = await handleHealthInformationRequestCallback(connReq.body, connReq.headers);
  assert(connFailed.status === 202, 'callback still 202 on connection fail');
  assert(
    notifyBodies.length === 1
      && notifyBodies[0].notification.statusNotification.sessionStatus === 'FAILED'
      && notifyBodies[0].notification.statusNotification.statusResponses[0].hiStatus === 'ERRORED',
    'connection failure must notify FAILED/ERRORED, not TRANSFERRED'
  );

  const timeoutTxn = 'dddddddd-1111-4222-8333-eeeeeeeeeeee';
  const timeoutReq = buildHiRequest({
    transactionId: timeoutTxn,
    requestId: 'dddddddd-0000-4000-8000-000000000004',
    careContextReference: row.careContextId,
    keyMaterial: hiu.keyMaterial,
    dataPushUrl,
  });
  pushStatus = 'TIMEOUT';
  notifyBodies.length = 0;
  const timeoutFailed = await handleHealthInformationRequestCallback(timeoutReq.body, timeoutReq.headers);
  assert(timeoutFailed.status === 202, 'callback still 202 on timeout');
  assert(
    notifyBodies.length === 1
      && notifyBodies[0].notification.statusNotification.sessionStatus === 'FAILED',
    'timeout must notify FAILED, not TRANSFERRED'
  );

  console.log(JSON.stringify({ pass: true }));
}

let restoreDoc = null;
run()
  .catch((err) => {
    console.log(JSON.stringify({ pass: false, error: err.message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (restoreDoc?.id) {
        await prisma.abdmHealthDocument.update({
          where: { id: restoreDoc.id },
          data: {
            syncStatus: 'SYNCED',
            errorCode: null,
            errorMessage: null,
          },
        });
      }
    } catch {
      // ignore
    }
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
