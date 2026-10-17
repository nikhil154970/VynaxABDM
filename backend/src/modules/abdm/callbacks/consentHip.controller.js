const { client } = require('../lib/abdmClient');
const { buildAbdmHeaders } = require('../lib/abdmHeaders');
const { ensureAccessToken } = require('../lib/abdmSession');
const { persistHipConsent } = require('../lib/abdmHipConsentStore');

/** Gateway base already includes /api/hiecm. */
const ON_NOTIFY_PATH = '/consent/v3/request/hip/on-notify';

function headerValue(headers, name) {
  if (!headers) return '';
  const value = headers[name] || headers[String(name).toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function logConsent(label, payload) {
  console.log(`[abdm-consent] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function maskAbhaAddress(value) {
  const address = String(value || '').trim();
  if (!address) return null;
  const at = address.indexOf('@');
  if (at <= 2) return '****';
  return `${address.slice(0, 2)}****${address.slice(at)}`;
}

function firstArtefactId(notification) {
  const list = notification?.consentArtefacts;
  if (!Array.isArray(list) || !list[0]) return '';
  return String(list[0].id || list[0].consentId || '').trim();
}

function extractConsentCareContextReferences(notification) {
  const refs = [];
  const lists = [
    notification?.consentDetail?.careContexts,
    notification?.careContexts,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const ref = String(item?.careContextReference || item?.referenceNumber || '').trim();
      if (ref) refs.push(ref);
    }
  }
  return [...new Set(refs)];
}

function parseConsentNotify(body = {}, headers = {}) {
  const requestId = headerValue(headers, 'REQUEST-ID') || String(body?.requestId || '').trim();
  const notification = body?.notification && typeof body.notification === 'object' ? body.notification : null;
  const status = String(notification?.status || '').trim();
  const consentId = String(
    notification?.consentId ||
      notification?.consentDetail?.consentId ||
      firstArtefactId(notification) ||
      ''
  ).trim();
  const patientId = String(notification?.consentDetail?.patient?.id || notification?.patient?.id || '').trim();
  const careContextReferences = extractConsentCareContextReferences(notification);

  return {
    requestId,
    notification,
    status,
    consentId,
    patientId,
    careContextReferences,
  };
}

function validationError(parsed) {
  if (!parsed.requestId) {
    return 'REQUEST-ID is required.';
  }
  if (!parsed.notification) {
    return 'notification is required.';
  }
  if (!parsed.status) {
    return 'notification.status is required.';
  }
  if (!parsed.consentId) {
    return 'notification.consentId is required.';
  }
  return null;
}

async function callHipConsentOnNotify({ incomingRequestId, consentId }) {
  const accessToken = await ensureAccessToken();
  const headers = buildAbdmHeaders({ accessToken });
  const outboundRequestId = headers['REQUEST-ID'];

  // M2 6.3.2 success body only — do not send error on ACK.
  const payload = {
    acknowledgement: {
      status: 'OK',
      consentId,
    },
    response: {
      requestId: incomingRequestId,
    },
  };

  try {
    const response = await client.post(ON_NOTIFY_PATH, payload, { headers });
    logConsent('consent on-notify ACK response', {
      status: response.status,
      outboundRequestId,
      responseRequestId: incomingRequestId,
      consentId,
      acknowledgementStatus: 'OK',
      body: response.data ?? null,
    });
    return { status: response.status, data: response.data, error: false, outboundRequestId };
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };
    logConsent('consent on-notify ACK failed', {
      status,
      outboundRequestId,
      responseRequestId: incomingRequestId,
      consentId,
      error: true,
      errorCode: data?.code || data?.error?.code || null,
      errorMessage: data?.message || data?.error?.message || err.message,
    });
    return { status, data, error: true, outboundRequestId };
  }
}

/**
 * ABDM M2 6.3.1 HIP consent notify callback.
 * POST {bridge}/api/v3/consent/request/hip/notify
 * Then 6.3.2 POST /consent/v3/request/hip/on-notify
 */
async function handleConsentHipNotifyCallback(body = {}, headers = {}) {
  const parsed = parseConsentNotify(body, headers);

  logConsent('CONSENT HIP NOTIFY received', {
    requestId: parsed.requestId || null,
    consentId: parsed.consentId || null,
    status: parsed.status || null,
    hipId: headerValue(headers, 'X-HIP-ID') || null,
    patientId: maskAbhaAddress(parsed.patientId),
    careContextCount: parsed.careContextReferences?.length || 0,
  });

  const invalid = validationError(parsed);
  if (invalid) {
    logConsent('CONSENT HIP NOTIFY rejected', {
      requestId: parsed.requestId || null,
      consentId: parsed.consentId || null,
      reason: invalid,
    });
    return {
      status: 400,
      body: {
        success: false,
        message: invalid,
      },
    };
  }

  try {
    await persistHipConsent({
      consentId: parsed.consentId,
      abhaAddress: parsed.patientId,
      status: parsed.status,
      careContextReferences: parsed.careContextReferences,
    });
  } catch (err) {
    logConsent('Consent mapping persist failed', {
      consentId: parsed.consentId,
      reason: err.message,
    });
  }

  try {
    await callHipConsentOnNotify({
      incomingRequestId: parsed.requestId,
      consentId: parsed.consentId,
    });
  } catch (err) {
    logConsent('consent on-notify ACK failed', {
      status: err.status || 500,
      error: true,
      message: err.message,
      requestId: parsed.requestId,
      consentId: parsed.consentId,
    });
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

module.exports = {
  handleConsentHipNotifyCallback,
  ON_NOTIFY_PATH,
};
