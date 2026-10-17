const { prisma } = require('../../../config/prisma');
const { abdmConfig } = require('./abdmConfig');
const abdmClient = require('./abdmClient');
const { client } = abdmClient;
const { generateFideliusKeyMaterial, decryptHealthInformation, checksumHealthInformation } = require('./abdmHealthDataCrypto');
const { classifyRecordType, summarizeBundle, groupKey } = require('./abdmHiuFhirSummary');
const { maskAbhaAddress, parseCallbackError } = require('./abdmConsentRequestStore');
const { buildAbdmHeaders } = require('./abdmHeaders');
const { ensureAccessToken } = require('./abdmSession');

const HI_REQUEST_PATH = '/data-flow/v3/health-information/request';
const NOTIFY_PATH = '/data-flow/v3/health-information/notify';

const TXN_SELECT_SAFE = {
  id: true,
  transactionId: true,
  consentId: true,
  requestId: true,
  dateFrom: true,
  dateTo: true,
  dataPushUrl: true,
  publicKey: true,
  hipId: true,
  careContextReferences: true,
  status: true,
  errorCode: true,
  errorMessage: true,
  resultMeta: true,
  createdAt: true,
  updatedAt: true,
};

function logHiuData(label, payload) {
  console.log(`[abdm-hiu-data] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function stripSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function extractCareContextRefs(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => {
    if (typeof item === 'string') return item.trim();
    return String(item?.careContextReference || item?.referenceNumber || '').trim();
  }).filter(Boolean))];
}

function dateRangeFromConsent(row) {
  const permission = asObject(asObject(asObject(row?.rawPayload)?.consent)?.consentDetail)?.permission
    || asObject(asObject(row?.rawPayload)?.consentDetail)?.permission
    || asObject(asObject(row?.rawPayload)?.permission);
  const range = asObject(permission?.dateRange);
  return {
    from: String(range?.from || '').trim() || null,
    to: String(range?.to || '').trim() || null,
  };
}

function parseConsentInstant(value, bound = 'start') {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const iso = bound === 'end' ? `${text}T23:59:59.999Z` : `${text}T00:00:00.000Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : ms;
}

function evaluateHiRequestDates(consent, requested = {}) {
  const granted = dateRangeFromConsent(consent);
  const grantedFromMs = parseConsentInstant(granted.from, 'start');
  const grantedToMs = parseConsentInstant(granted.to, 'end');
  if (grantedFromMs == null || grantedToMs == null || grantedFromMs > grantedToMs) {
    return {
      ok: false,
      message: 'Consent permission date range is invalid.',
    };
  }
  const requestedFrom = String(requested.from || granted.from || '').trim();
  const requestedTo = String(requested.to || granted.to || '').trim();
  const requestFromMs = parseConsentInstant(requestedFrom, 'start');
  const requestToMs = parseConsentInstant(requestedTo, 'end');
  if (requestFromMs == null || requestToMs == null || requestFromMs > requestToMs) {
    return {
      ok: false,
      message: 'Requested information date range is invalid.',
    };
  }
  if (requestFromMs < grantedFromMs || requestToMs > grantedToMs) {
    return {
      ok: false,
      message: 'Requested information date range is outside the granted permission period.',
    };
  }
  return {
    ok: true,
    from: new Date(requestFromMs).toISOString(),
    to: new Date(requestToMs).toISOString(),
  };
}

function hipIdFromConsent(row) {
  const detail = asObject(asObject(row?.rawPayload)?.consent)?.consentDetail
    || asObject(row?.rawPayload)?.consentDetail;
  return String(asObject(detail?.hip)?.id || '').trim() || null;
}

function careContextsFromConsent(row) {
  const detail = asObject(asObject(row?.rawPayload)?.consent)?.consentDetail
    || asObject(row?.rawPayload)?.consentDetail;
  return extractCareContextRefs(detail?.careContexts);
}

function publicDataPushUrl() {
  const base = stripSlash(abdmConfig.bridgeCallbackUrl);
  if (!base || !/^https:\/\//i.test(base)) return null;
  return `${base}/api/v3/hiu/health-information/on-data`;
}

function serializeTxn(row) {
  if (!row) return null;
  return {
    id: row.id,
    transactionId: row.transactionId || null,
    consentId: row.consentId,
    requestId: row.requestId || null,
    dateFrom: row.dateFrom || null,
    dateTo: row.dateTo || null,
    dataPushUrl: row.dataPushUrl,
    hipId: row.hipId || null,
    status: row.status,
    errorCode: row.errorCode || null,
    errorMessage: row.errorMessage || null,
    resultMeta: row.resultMeta || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const BLOCKED_CONSENT_STATUSES = new Set(['DENIED', 'REVOKED', 'EXPIRED']);
const IN_FLIGHT_HI_STATUSES = ['PENDING', 'REQUESTED', 'ACKNOWLEDGED'];

async function loadLatestConsent(consentId) {
  const id = String(consentId || '').trim();
  if (!id) return null;
  return prisma.abdmConsentRequest.findFirst({
    where: {
      OR: [{ consentId: id }, { artefactId: id }, { consentRequestId: id }],
    },
    orderBy: { updatedAt: 'desc' },
  });
}

function hasCompleteOnFetchArtefact(row) {
  const detail = asObject(asObject(row?.rawPayload)?.consent)?.consentDetail
    || asObject(row?.rawPayload)?.consentDetail;
  if (!detail) return false;
  const range = asObject(asObject(detail.permission)?.dateRange);
  const from = String(range?.from || '').trim();
  const to = String(range?.to || '').trim();
  const careContexts = extractCareContextRefs(detail.careContexts);
  const hiTypes = Array.isArray(detail.hiTypes) ? detail.hiTypes.filter(Boolean) : [];
  return Boolean(from && to && (careContexts.length || hiTypes.length));
}

async function resolveConsentForHiRequest(consentId) {
  const id = String(consentId || '').trim();
  if (!id) {
    return { status: 400, body: { success: false, message: 'consentId is required.' } };
  }
  const consent = await loadLatestConsent(id);
  if (!consent) {
    return { status: 404, body: { success: false, message: 'Consent record not found.' } };
  }
  const latestStatus = String(consent.status || '').trim().toUpperCase();
  if (BLOCKED_CONSENT_STATUSES.has(latestStatus)) {
    return {
      status: 409,
      body: {
        success: false,
        consentStatus: latestStatus,
        message: `Consent is ${latestStatus}; health information cannot be requested.`,
      },
    };
  }
  if (latestStatus !== 'GRANTED') {
    return {
      status: 409,
      body: {
        success: false,
        consentStatus: latestStatus || null,
        message: `Consent status is ${latestStatus || 'UNKNOWN'}; GRANTED artefact is required.`,
      },
    };
  }
  if (!hasCompleteOnFetchArtefact(consent)) {
    return {
      status: 409,
      body: {
        success: false,
        consentStatus: latestStatus,
        message: 'Consent artefact is incomplete. Fetch the granted artefact before requesting health records.',
      },
    };
  }
  const artefactStatus = String(asObject(asObject(consent.rawPayload)?.consent)?.status || '').trim().toUpperCase();
  if (BLOCKED_CONSENT_STATUSES.has(artefactStatus)) {
    return {
      status: 409,
      body: {
        success: false,
        consentStatus: artefactStatus,
        message: `Consent is ${artefactStatus}; health information cannot be requested.`,
      },
    };
  }
  const dates = evaluateHiRequestDates(consent);
  if (!dates.ok) {
    return {
      status: 409,
      body: {
        success: false,
        consentStatus: latestStatus,
        message: dates.message,
      },
    };
  }
  return { status: 200, body: { success: true }, consent, dates };
}

function buildHiuNotifyPayload({
  transactionId,
  consentId,
  hiuId,
  hipId,
  careContextReferences,
  sessionStatus,
}) {
  const failed = String(sessionStatus || '').toUpperCase() === 'FAILED';
  const refs = extractCareContextRefs(careContextReferences);
  const list = refs.length ? refs : ['unknown'];
  const resolvedHiu = String(hiuId || abdmConfig.hipId || '').trim();
  const resolvedHip = String(hipId || resolvedHiu).trim();
  return {
    notification: {
      consentId: String(consentId || '').trim(),
      transactionId: String(transactionId || '').trim(),
      doneAt: new Date().toISOString(),
      notifier: {
        type: 'HIU',
        id: resolvedHiu,
      },
      statusNotification: {
        sessionStatus: failed ? 'FAILED' : 'RECEIVED',
        hipId: resolvedHip,
        statusResponses: list.map((careContextReference) => ({
          careContextReference,
          hiStatus: failed ? 'ERRORED' : 'OK',
          description: failed ? 'Health information receive failed' : 'Health information received',
        })),
      },
    },
  };
}

async function notifyHiuHealthInformation({ transactionId, consentId, hipId, careContextReferences, sessionStatus }) {
  if (typeof notifyHiuHealthInformation._testHook === 'function') {
    return notifyHiuHealthInformation._testHook({ transactionId, consentId, hipId, careContextReferences, sessionStatus });
  }
  const payload = buildHiuNotifyPayload({
    transactionId,
    consentId,
    hiuId: abdmConfig.hipId,
    hipId,
    careContextReferences,
    sessionStatus,
  });
  const accessToken = await ensureAccessToken();
  const headers = buildAbdmHeaders({
    accessToken,
    additionalHeaders: { 'X-HIU-ID': abdmConfig.hipId },
  });
  logHiuData('NOTIFY sent', {
    transactionId,
    consentId,
    sessionStatus: payload.notification.statusNotification.sessionStatus,
    careContextCount: payload.notification.statusNotification.statusResponses.length,
  });
  try {
    const response = await client.post(NOTIFY_PATH, payload, { headers });
    logHiuData('NOTIFY response', {
      transactionId,
      status: response.status,
      error: false,
    });
    return { status: response.status, error: false };
  } catch (err) {
    logHiuData('NOTIFY response', {
      transactionId,
      status: err.response?.status || 500,
      error: true,
      errorCode: err.response?.data?.code || null,
    });
    return { status: err.response?.status || 500, error: true };
  }
}

async function createHiuHealthInformationRequest(body = {}) {
  const consentId = String(body.consentId || body.consent?.id || '').trim();
  const resolved = await resolveConsentForHiRequest(consentId);
  if (resolved.status !== 200) {
    return { status: resolved.status, body: resolved.body };
  }
  const consent = resolved.consent;

  const artefactId = String(consent.consentId || consent.artefactId || consentId).trim();
  const dates = evaluateHiRequestDates(consent, {
    from: body.dateRange?.from || body.from,
    to: body.dateRange?.to || body.to,
  });
  if (!dates.ok) {
    return {
      status: 409,
      body: {
        success: false,
        message: dates.message,
      },
    };
  }
  const dateFrom = dates.from;
  const dateTo = dates.to;

  const dataPushUrl = publicDataPushUrl();
  if (!dataPushUrl) {
    return {
      status: 400,
      body: { success: false, message: 'ABDM_BRIDGE_CALLBACK_URL must be a public HTTPS URL for dataPushUrl.' },
    };
  }

  const careContextReferences = careContextsFromConsent(consent);
  const hipId = hipIdFromConsent(consent) || abdmConfig.hipId || null;

  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${artefactId}))`;
    const inflight = await tx.abdmHiuHiTransaction.findFirst({
      where: { consentId: artefactId, status: { in: IN_FLIGHT_HI_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    if (inflight) {
      return { duplicate: true, row: inflight };
    }
    const generated = generateFideliusKeyMaterial();
    const row = await tx.abdmHiuHiTransaction.create({
      data: {
        consentId: artefactId,
        dateFrom,
        dateTo,
        dataPushUrl,
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        nonce: generated.nonce,
        hipId,
        careContextReferences,
        status: 'PENDING',
      },
    });
    return { duplicate: false, row, keyMaterial: generated.keyMaterial };
  });

  if (claimed.duplicate) {
    logHiuData('HI REQUEST skipped; in-flight transaction exists', {
      consentId: artefactId,
      transactionStatus: claimed.row.status,
    });
    return {
      status: 409,
      body: {
        success: false,
        duplicate: true,
        message: 'A health-information request is already in progress for this consent.',
        ...serializeTxn(claimed.row),
      },
    };
  }

  const row = claimed.row;
  const keyMaterial = claimed.keyMaterial;

  const hiRequest = {
    consent: { id: artefactId },
    dateRange: { from: dateFrom, to: dateTo },
    dataPushUrl,
    keyMaterial,
  };

  logHiuData('HI REQUEST created', {
    consentId: artefactId,
    dateFrom,
    dateTo,
    dataPushUrlHost: (() => {
      try { return new URL(dataPushUrl).host; } catch { return 'invalid'; }
    })(),
    careContextCount: careContextReferences.length,
  });

  try {
    const response = await abdmClient.abdmRequest({
      method: 'POST',
      path: HI_REQUEST_PATH,
      data: { hiRequest },
      apiName: 'HIU_HI_REQUEST',
      additionalHeaders: { 'X-HIU-ID': abdmConfig.hipId },
      auditRequestBody: {
        hiRequest: {
          consent: hiRequest.consent,
          dateRange: hiRequest.dateRange,
          dataPushUrl: hiRequest.dataPushUrl,
          keyMaterial: { cryptoAlg: 'ECDH', curve: 'Curve25519' },
        },
      },
    });

    const txnFromGateway = String(
      response.data?.hiRequest?.transactionId ||
        response.data?.transactionId ||
        ''
    ).trim() || null;

    const updated = await prisma.abdmHiuHiTransaction.update({
      where: { id: row.id },
      data: {
        requestId: response.requestId || null,
        transactionId: txnFromGateway,
        status: txnFromGateway ? 'ACKNOWLEDGED' : 'REQUESTED',
      },
      select: TXN_SELECT_SAFE,
    });

    return {
      status: 202,
      body: {
        success: true,
        ...serializeTxn(updated),
        gatewayStatus: response.status,
      },
    };
  } catch (err) {
    await prisma.abdmHiuHiTransaction.update({
      where: { id: row.id },
      data: {
        status: 'FAILED',
        errorCode: String(err.status || 'HI_REQUEST_FAILED'),
        errorMessage: String(err.message || 'HIU health-information request failed').slice(0, 2000),
      },
    });
    return {
      status: err.status && err.status < 500 ? err.status : 502,
      body: {
        success: false,
        message: err.message || 'HIU health-information request failed.',
      },
    };
  }
}

async function handleHiuOnRequestCallback(body = {}) {
  const hiRequest = asObject(body?.hiRequest);
  const response = asObject(body?.response);
  const transactionId = String(hiRequest?.transactionId || body?.transactionId || '').trim();
  const requestId = String(response?.requestId || body?.requestId || '').trim();
  const sessionStatus = String(hiRequest?.sessionStatus || '').trim().toUpperCase();
  const hasError = body?.error != null && body?.error !== '';
  const errorMeta = parseCallbackError(body?.error);

  logHiuData('ON-REQUEST received', {
    transactionId: transactionId || null,
    requestId: requestId || null,
    sessionStatus: sessionStatus || null,
    error: hasError,
    errorCode: errorMeta.errorCode,
    errorMessage: errorMeta.errorMessage,
  });

  try {
    let row = null;
    if (requestId) {
      row = await prisma.abdmHiuHiTransaction.findFirst({
        where: { requestId },
        orderBy: { updatedAt: 'desc' },
      });
    }
    if (!row && transactionId) {
      row = await prisma.abdmHiuHiTransaction.findUnique({
        where: { transactionId },
      });
    }
    if (row) {
      await prisma.abdmHiuHiTransaction.update({
        where: { id: row.id },
        data: {
          transactionId: transactionId || row.transactionId,
          status: hasError ? 'FAILED' : 'ACKNOWLEDGED',
          errorCode: hasError ? (errorMeta.errorCode || 'ON_REQUEST_ERROR') : null,
          errorMessage: hasError
            ? String(errorMeta.errorMessage || 'HIU on-request error').slice(0, 2000)
            : null,
        },
      });
    } else {
      logHiuData('ON-REQUEST unmatched', {
        transactionId: transactionId || null,
        requestId: requestId || null,
      });
    }
  } catch (err) {
    logHiuData('ON-REQUEST persist failed', { reason: err.message });
  }

  return { status: 202, body: { acknowledgement: 'ACCEPTED' } };
}

function parseDataPushBody(body = {}) {
  const transactionId = String(body?.transactionId || '').trim();
  const entries = Array.isArray(body?.entries) ? body.entries : [];
  const keyMaterial = asObject(body?.keyMaterial);
  return { transactionId, entries, keyMaterial };
}

async function handleHiuOnDataCallback(body = {}) {
  const parsed = parseDataPushBody(body);
  logHiuData('DATA PUSH received', {
    transactionId: parsed.transactionId || null,
    entryCount: parsed.entries.length,
    hasKeyMaterial: Boolean(parsed.keyMaterial),
  });

  let txn = null;
  try {
    if (parsed.transactionId) {
      txn = await prisma.abdmHiuHiTransaction.findUnique({
        where: { transactionId: parsed.transactionId },
      });
    }
    if (!txn) {
      logHiuData('DATA PUSH unmatched transactionId', {
        transactionId: parsed.transactionId || null,
      });
      return { status: 202, body: { acknowledgement: 'ACCEPTED' } };
    }

    const careContextReferences = [];
    let decryptedCount = 0;
    let failed = !parsed.entries.length;
    let failReason = failed ? 'Malformed data-push payload: entries missing' : null;
    let resourceType = null;

    for (const entry of parsed.entries) {
      const ccRef = String(entry?.careContextReference || '').trim();
      if (ccRef) careContextReferences.push(ccRef);
      const content = entry?.content;
      if (!content || !parsed.keyMaterial) {
        failed = true;
        failReason = 'Missing encrypted content or HIP keyMaterial';
        continue;
      }
      try {
        const plaintext = decryptHealthInformation({
          content,
          hipKeyMaterial: parsed.keyMaterial,
          hiuPrivateKey: txn.privateKey,
          hiuNonce: txn.nonce,
        });
        const expected = String(entry?.checksum || '').trim();
        if (expected) {
          const actual = checksumHealthInformation(plaintext);
          if (actual !== expected) {
            failed = true;
            failReason = 'Checksum mismatch';
            continue;
          }
        }
        let parsedFhir = null;
        try {
          parsedFhir = JSON.parse(plaintext);
        } catch {
          failed = true;
          failReason = 'Decrypted payload is not JSON';
          continue;
        }
        if (!parsedFhir || parsedFhir.resourceType !== 'Bundle') {
          failed = true;
          failReason = 'Decrypted payload is not a FHIR Bundle';
          continue;
        }
        resourceType = parsedFhir.resourceType;
        decryptedCount += 1;
        const resources = Array.isArray(parsedFhir.entry)
          ? parsedFhir.entry.map((row) => row?.resource).filter(Boolean)
          : [];
        const recordType = classifyRecordType(parsedFhir, resources);
        const ccKey = ccRef || `entry-${decryptedCount}`;
        try {
          await upsertHiuClinicalRecord({
            transactionId: txn.transactionId,
            consentId: txn.consentId,
            careContextReference: ccKey,
            resourceType,
            recordType,
            fhirPayload: parsedFhir,
            sourceHipId: txn.hipId || null,
          });
        } catch (persistErr) {
          failed = true;
          failReason = 'Record persist failed';
          logHiuData('DATA record persist failed', {
            transactionId: txn.transactionId,
            reason: persistErr.message,
          });
        }
      } catch (err) {
        failed = true;
        failReason = 'Decrypt failed';
      }
    }

    const refs = [...new Set([
      ...extractCareContextRefs(txn.careContextReferences),
      ...careContextReferences,
    ])];

    logHiuData('DATA decrypted', {
      transactionId: txn.transactionId,
      decryptedCount,
      entryCount: parsed.entries.length,
      failed,
      resourceType,
    });

    const receivedOk = !failed && decryptedCount > 0;
    await prisma.abdmHiuHiTransaction.update({
      where: { id: txn.id },
      data: {
        status: receivedOk ? 'RECEIVED' : 'FAILED',
        errorCode: receivedOk ? null : 'HIU_DATA_FAILED',
        errorMessage: receivedOk ? null : String(failReason || 'Data receive failed').slice(0, 2000),
        resultMeta: {
          resourceType,
          decryptedCount,
          entryCount: parsed.entries.length,
          careContextReferences: refs,
        },
        careContextReferences: refs,
      },
    });

    try {
      await notifyHiuHealthInformation({
        transactionId: txn.transactionId,
        consentId: txn.consentId,
        hipId: txn.hipId,
        careContextReferences: refs,
        sessionStatus: receivedOk ? 'RECEIVED' : 'FAILED',
      });
    } catch (err) {
      logHiuData('NOTIFY skipped', { transactionId: txn.transactionId, reason: err.message });
    }
  } catch (err) {
    logHiuData('DATA PUSH failed', { reason: err.message });
    if (txn?.id) {
      await prisma.abdmHiuHiTransaction.update({
        where: { id: txn.id },
        data: {
          status: 'FAILED',
          errorCode: 'HIU_DATA_FAILED',
          errorMessage: String(err.message || 'Data receive failed').slice(0, 2000),
        },
      }).catch(() => {});
    }
    if (txn?.transactionId) {
      try {
        await notifyHiuHealthInformation({
          transactionId: txn.transactionId,
          consentId: txn.consentId,
          hipId: txn.hipId,
          careContextReferences: txn.careContextReferences,
          sessionStatus: 'FAILED',
        });
      } catch {
        /* ignore */
      }
    }
  }

  return { status: 202, body: { acknowledgement: 'ACCEPTED' } };
}

const EMPTY_GROUPS = {
  opConsultation: [],
  prescription: [],
  ipd: [],
  discharge: [],
  lab: [],
  additional: [],
};

function uniqueHealthRecordRows(rows) {
  const seen = new Map();
  for (const row of rows || []) {
    const key = `${row.careContextReference || ''}|${row.recordType || ''}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

async function upsertHiuClinicalRecord({
  transactionId,
  consentId,
  careContextReference,
  resourceType,
  recordType,
  fhirPayload,
  sourceHipId,
} = {}) {
  const ccKey = String(careContextReference || '').trim();
  const cid = String(consentId || '').trim();
  const type = String(recordType || '').trim();
  if (!ccKey || !cid) {
    throw new Error('careContextReference and consentId are required.');
  }
  const lockKey = `${cid}:${ccKey}:${type}`;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const payload = {
      transactionId: String(transactionId || '').trim(),
      consentId: cid,
      resourceType: resourceType || 'Bundle',
      recordType: type || 'Additional',
      fhirPayload,
      sourceHipId: sourceHipId || null,
      receivedAt: new Date(),
    };
    const existing = await tx.abdmHiuHealthRecord.findFirst({
      where: {
        consentId: cid,
        careContextReference: ccKey,
        recordType: payload.recordType,
      },
      orderBy: { receivedAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      return tx.abdmHiuHealthRecord.update({
        where: { id: existing.id },
        data: payload,
      });
    }
    return tx.abdmHiuHealthRecord.create({
      data: {
        ...payload,
        careContextReference: ccKey,
      },
    });
  });
}

async function getLatestHiuHiTransaction({ consentId } = {}) {
  const id = String(consentId || '').trim();
  if (!id) {
    return { status: 400, body: { success: false, message: 'consentId is required.' } };
  }
  const row = await prisma.abdmHiuHiTransaction.findFirst({
    where: { consentId: id },
    orderBy: { createdAt: 'desc' },
    select: TXN_SELECT_SAFE,
  });
  if (!row) {
    return { status: 404, body: { success: false, message: 'No health-information request found for this consent.' } };
  }
  return {
    status: 200,
    body: {
      success: true,
      transaction: serializeTxn(row),
    },
  };
}

async function listHiuHealthRecords({ consentId } = {}) {
  const id = String(consentId || '').trim();
  if (!id) {
    return { status: 400, body: { success: false, message: 'consentId is required.' } };
  }
  try {
    const consent = await prisma.abdmConsentRequest.findFirst({
      where: { OR: [{ consentId: id }, { artefactId: id }, { consentRequestId: id }] },
      orderBy: { updatedAt: 'desc' },
      select: { consentId: true, artefactId: true, abhaAddress: true, status: true },
    });
    const artefact = String(consent?.consentId || consent?.artefactId || id).trim();
    const rows = uniqueHealthRecordRows(await prisma.abdmHiuHealthRecord.findMany({
      where: { consentId: { in: [...new Set([id, artefact].filter(Boolean))] } },
      orderBy: { receivedAt: 'desc' },
    }));
    const groups = {
      opConsultation: [],
      prescription: [],
      ipd: [],
      discharge: [],
      lab: [],
      additional: [],
    };
    for (const row of rows) {
      const summary = summarizeBundle(row.fhirPayload, {
        careContextReference: row.careContextReference,
        sourceHipId: row.sourceHipId,
      });
      const key = groupKey(row.recordType || summary.recordType);
      const item = {
        id: row.id,
        recordType: row.recordType,
        title: summary.title,
        date: summary.date,
        patientName: summary.patientName,
        uhid: summary.uhid,
        facilityName: summary.facilityName,
        receivedAt: row.receivedAt,
        clinical: summary.clinical,
      };
      (groups[key] || groups.additional).push(item);
    }
    return {
      status: 200,
      body: {
        success: true,
        consentId: artefact,
        patientAbha: maskAbhaAddress(consent?.abhaAddress),
        recordCount: rows.length,
        groups,
      },
    };
  } catch (err) {
    logHiuData('List HIU records failed', { reason: err.message });
    return { status: 500, body: { success: false, message: 'Unable to load health records.' } };
  }
}

module.exports = {
  createHiuHealthInformationRequest,
  handleHiuOnRequestCallback,
  handleHiuOnDataCallback,
  notifyHiuHealthInformation,
  listHiuHealthRecords,
  getLatestHiuHiTransaction,
  resolveConsentForHiRequest,
  evaluateHiRequestDates,
  upsertHiuClinicalRecord,
  EMPTY_GROUPS,
};
