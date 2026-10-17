const axios = require('axios');
const { getHiSessionByTransactionId } = require('./abdmHiSessionStore');
const { encryptHealthInformation } = require('./abdmHealthDataCrypto');

function logPush(label, payload) {
  console.log(`[abdm-hi-push] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function safeHost(url) {
  try {
    return new URL(url).host || null;
  } catch {
    return 'invalid';
  }
}

function safeResponseHeaders(headers) {
  if (!headers || typeof headers !== 'object') return null;
  const redacted = {};
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === 'authorization') continue;
    redacted[key] = value;
  }
  return redacted;
}

function buildDataPushPayload({ transactionId, encrypted, careContextReference }) {
  return {
    pageNumber: 0,
    pageCount: 1,
    transactionId,
    entries: [
      {
        content: encrypted.content,
        media: 'application/fhir+json',
        checksum: encrypted.checksum,
        careContextReference,
      },
    ],
    keyMaterial: encrypted.keyMaterial,
  };
}

function dataPushFailure(err) {
  const code = String(err?.code || '').trim();
  const message = String(err?.message || 'dataPushUrl request failed');
  let errorCode = code || 'DATA_PUSH_FAILED';
  if (!code && /timeout/i.test(message)) errorCode = 'ETIMEDOUT';
  return {
    status: 0,
    error: true,
    errorCode: errorCode.slice(0, 80),
    errorMessage: message.slice(0, 500),
    data: null,
    headers: null,
  };
}

async function postDataPushUrl(dataPushUrl, payload, httpPost) {
  try {
    if (typeof httpPost === 'function') {
      return await httpPost(dataPushUrl, payload);
    }
    const response = await axios.post(dataPushUrl, payload, {
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });
    return {
      status: response.status,
      data: response.data ?? null,
      headers: response.headers || null,
    };
  } catch (err) {
    logPush('dataPushUrl request failed', {
      dataPushUrlHost: safeHost(dataPushUrl),
      errorCode: err.code || null,
      errorMessage: String(err.message || 'dataPushUrl request failed').slice(0, 200),
    });
    return dataPushFailure(err);
  }
}

/**
 * POST encrypted OPD health information to the HIU dataPushUrl from the HI session.
 * Does not call the ABDM gateway. Does not send TRANSFERRED notify.
 */
async function pushHealthInformation({
  transactionId,
  fhirBundle,
  careContextReference,
  httpPost,
} = {}) {
  const txnId = String(transactionId || '').trim();
  const ccRef = String(careContextReference || '').trim();
  if (!txnId) {
    throw new Error('transactionId is required.');
  }
  if (!ccRef) {
    throw new Error('careContextReference is required.');
  }

  const session = getHiSessionByTransactionId(txnId);
  if (!session) {
    throw new Error(`HI session not found for transactionId.`);
  }
  if (!session.dataPushUrl) {
    throw new Error('HI session dataPushUrl is missing.');
  }
  if (!session.keyMaterial) {
    throw new Error('HI session HIU keyMaterial is missing.');
  }

  const encrypted = encryptHealthInformation({
    fhirBundle,
    keyMaterial: session.keyMaterial,
  });
  const payload = buildDataPushPayload({
    transactionId: session.transactionId,
    encrypted,
    careContextReference: ccRef,
  });

  logPush('POST dataPushUrl', {
    transactionId: session.transactionId,
    dataPushUrlHost: safeHost(session.dataPushUrl),
    careContextReference: ccRef,
    media: 'application/fhir+json',
    contentPresent: Boolean(payload.entries[0].content),
    checksumPresent: Boolean(payload.entries[0].checksum),
    keyMaterialPresent: Boolean(payload.keyMaterial),
  });

  const result = await postDataPushUrl(session.dataPushUrl, payload, httpPost);
  logPush('dataPushUrl response', {
    transactionId: session.transactionId,
    status: result.status ?? null,
    data: result.data ?? null,
    headers: safeResponseHeaders(result.headers),
  });

  return {
    status: result.status ?? null,
    data: result.data ?? null,
    error: Boolean(result.error),
    errorCode: result.errorCode || null,
    errorMessage: result.errorMessage || null,
    transactionId: session.transactionId,
    careContextReference: ccRef,
    payload,
  };
}

module.exports = {
  pushHealthInformation,
  buildDataPushPayload,
};
