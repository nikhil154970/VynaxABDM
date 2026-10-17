const { client } = require('./abdmClient');
const { buildAbdmHeaders } = require('./abdmHeaders');
const { ensureAccessToken } = require('./abdmSession');
const { getHiSessionByTransactionId } = require('./abdmHiSessionStore');
const { abdmConfig } = require('./abdmConfig');

/** Gateway base already includes /api/hiecm. */
const NOTIFY_PATH = '/data-flow/v3/health-information/notify';

function logNotify(label, payload) {
  console.log(`[abdm-hi-notify] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function normalizeCareContextRefs(careContextReference) {
  if (Array.isArray(careContextReference)) {
    return careContextReference.map((value) => String(value || '').trim()).filter(Boolean);
  }
  const single = String(careContextReference || '').trim();
  return single ? [single] : [];
}

function resolveStatuses(sessionStatus) {
  const session = String(sessionStatus || 'TRANSFERRED').trim().toUpperCase();
  if (session === 'FAILED') {
    return {
      sessionStatus: 'FAILED',
      hiStatus: 'ERRORED',
      description: 'Health information transfer failed',
    };
  }
  if (session !== 'TRANSFERRED') {
    throw new Error('sessionStatus must be TRANSFERRED or FAILED.');
  }
  return {
    sessionStatus: 'TRANSFERRED',
    hiStatus: 'OK',
    description: 'Data transferred successfully',
  };
}

function buildHealthInformationNotifyPayload({
  transactionId,
  consentId,
  careContextReference,
  sessionStatus,
  hipId,
  doneAt,
}) {
  const statuses = resolveStatuses(sessionStatus);
  const refs = normalizeCareContextRefs(careContextReference);
  const txnId = String(transactionId || '').trim();
  const consent = String(consentId || '').trim();
  const resolvedHipId = String(hipId || '').trim();
  if (!txnId) {
    throw new Error('transactionId is required.');
  }
  if (!consent) {
    throw new Error('consentId is required.');
  }
  if (!resolvedHipId) {
    throw new Error('HIP ID is required.');
  }
  if (!refs.length) {
    throw new Error('careContextReference is required.');
  }
  return {
    notification: {
      consentId: consent,
      transactionId: txnId,
      doneAt: doneAt || new Date().toISOString(),
      notifier: {
        type: 'HIP',
        id: resolvedHipId,
      },
      statusNotification: {
        sessionStatus: statuses.sessionStatus,
        hipId: resolvedHipId,
        statusResponses: refs.map((careContextReference) => ({
          careContextReference,
          hiStatus: statuses.hiStatus,
          description: statuses.description,
        })),
      },
    },
  };
}

async function postNotify(payload, httpPost) {
  if (typeof httpPost === 'function') {
    return httpPost(NOTIFY_PATH, payload);
  }

  const accessToken = await ensureAccessToken();
  const headers = buildAbdmHeaders({ accessToken });
  const outboundRequestId = headers['REQUEST-ID'];
  try {
    const response = await client.post(NOTIFY_PATH, payload, { headers });
    return {
      status: response.status,
      data: response.data ?? null,
      outboundRequestId,
      error: false,
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };
    return {
      status,
      data,
      outboundRequestId,
      error: true,
    };
  }
}

/**
 * M2 6.3.6 HIP health-information notify.
 * transactionId must already exist in the HI session store.
 */
async function notifyHealthInformation({
  transactionId,
  careContextReference,
  sessionStatus = 'TRANSFERRED',
  hiStatus,
  httpPost,
} = {}) {
  const txnId = String(transactionId || '').trim();
  if (!txnId) {
    throw new Error('transactionId is required.');
  }

  const session = getHiSessionByTransactionId(txnId);
  if (!session?.transactionId) {
    throw new Error('HI session not found for transactionId.');
  }

  const payload = buildHealthInformationNotifyPayload({
    transactionId: session.transactionId,
    consentId: session.consentId,
    careContextReference,
    sessionStatus,
    hipId: abdmConfig.hipId,
  });

  logNotify('NOTIFY request', {
    transactionId: session.transactionId,
    consentId: session.consentId || null,
    sessionStatus: payload.notification.statusNotification.sessionStatus,
    careContextCount: payload.notification.statusNotification.statusResponses.length,
  });

  const result = await postNotify(payload, httpPost);
  logNotify(result.error ? 'NOTIFY failed' : 'NOTIFY response', {
    transactionId: session.transactionId,
    status: result.status || null,
    error: Boolean(result.error),
  });

  return {
    ...result,
    transactionId: session.transactionId,
    payload,
  };
}

module.exports = {
  notifyHealthInformation,
  buildHealthInformationNotifyPayload,
  NOTIFY_PATH,
};
