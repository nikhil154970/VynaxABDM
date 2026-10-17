const { saveHiSession } = require('./abdmHiSessionStore');
const { abdmConfig } = require('./abdmConfig');
const { notifyHealthInformation, NOTIFY_PATH } = require('./abdmHiNotify');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  if (!abdmConfig.hipId) {
    abdmConfig.hipId = 'IN1010001531';
  }

  const transactionId = '11111111-2222-4333-8444-555555555555';
  const consentId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  saveHiSession({
    consentId,
    transactionId,
    dateRange: { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.000Z' },
    dataPushUrl: 'http://127.0.0.1:9/mock-hiu/data/notification',
    keyMaterial: { cryptoAlg: 'ECDH', curve: 'Curve25519' },
    requestId: '99999999-aaaa-4bbb-8ccc-dddddddddddd',
  });

  let postedPath = null;
  let postedBody = null;
  const transferred = await notifyHealthInformation({
    transactionId,
    careContextReference: 'CC-OPD-TEST-1',
    sessionStatus: 'TRANSFERRED',
    httpPost: async (path, payload) => {
      postedPath = path;
      postedBody = payload;
      return { status: 202, data: { status: 'Notification is Accepted' }, error: false };
    },
  });

  const notify = postedBody.notification;
  const statusNotification = notify.statusNotification;
  assert(postedPath === NOTIFY_PATH, 'notify path');
  assert(notify.consentId === consentId, 'consentId from HI session');
  assert(notify.transactionId === transactionId, 'session transactionId');
  assert(typeof notify.doneAt === 'string' && Boolean(Date.parse(notify.doneAt)), 'doneAt ISO');
  assert(notify.notifier.type === 'HIP', 'notifier.type');
  assert(notify.notifier.id === abdmConfig.hipId, 'notifier.id');
  assert(statusNotification.sessionStatus === 'TRANSFERRED', 'TRANSFERRED');
  assert(statusNotification.hipId === abdmConfig.hipId, 'statusNotification.hipId');
  assert(statusNotification.statusResponses[0].careContextReference === 'CC-OPD-TEST-1', 'careContext');
  assert(statusNotification.statusResponses[0].hiStatus === 'OK', 'OK');
  assert(transferred.status === 202, '202');

  const failed = await notifyHealthInformation({
    transactionId,
    careContextReference: 'CC-OPD-TEST-1',
    sessionStatus: 'FAILED',
    httpPost: async (_path, payload) => ({ status: 202, data: null, error: false, payload }),
  });
  assert(failed.payload.notification.statusNotification.sessionStatus === 'FAILED', 'FAILED');
  assert(failed.payload.notification.statusNotification.statusResponses[0].hiStatus === 'ERRORED', 'ERRORED');

  let invented = false;
  try {
    await notifyHealthInformation({
      transactionId: '00000000-0000-4000-8000-000000000000',
      careContextReference: 'CC-MISSING',
      httpPost: async () => ({ status: 202 }),
    });
  } catch (err) {
    invented = /HI session not found/.test(err.message);
  }
  assert(invented, 'must not invent transactionId');

  console.log(JSON.stringify({
    ok: true,
    mockPost: true,
    path: NOTIFY_PATH,
    transferred: true,
    failed: true,
  }));
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
