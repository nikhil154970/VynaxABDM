const { prisma } = require('../../../config/prisma');
const { client } = require('../lib/abdmClient');
const { buildAbdmHeaders } = require('../lib/abdmHeaders');
const { ensureAccessToken } = require('../lib/abdmSession');
const { saveHiSession } = require('../lib/abdmHiSessionStore');
const {
  resolvePatientIdsByConsentId,
  resolveConsentCareContextReferences,
} = require('../lib/abdmHipConsentStore');
const { filterConsentConsultationCareContexts } = require('../lib/abdmCareContextStore');
const { buildOpdConsultationBundleFromConsultationId } = require('../fhir/opConsultation');
const {
  buildPrescriptionBundleFromConsultationId,
  buildPrescriptionBundleFromTreatmentPlanId,
} = require('../fhir/prescription');
const { buildDiagnosticReportBundleFromLabOrderId } = require('../fhir/diagnosticReport');
const { buildInpatientBundleFromAdmissionId } = require('../fhir/inpatient');
const { buildDischargeSummaryBundleFromAdmissionId } = require('../fhir/dischargeSummary');
const { pushHealthInformation } = require('../lib/abdmHiDataPush');
const { notifyHealthInformation } = require('../lib/abdmHiNotify');

/** Gateway base already includes /api/hiecm. */
const ON_REQUEST_PATH = '/data-flow/v3/health-information/hip/on-request';

function headerValue(headers, name) {
  if (!headers) return '';
  const value = headers[name] || headers[String(name).toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function logHi(label, payload) {
  console.log(`[abdm-hi] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseHiRequest(body = {}, headers = {}) {
  const requestId = headerValue(headers, 'REQUEST-ID') || String(body?.requestId || '').trim();
  const transactionId = String(body?.transactionId || body?.hiRequest?.transactionId || '').trim();
  const hiRequest = body?.hiRequest && typeof body.hiRequest === 'object' ? body.hiRequest : null;
  const consentId = String(hiRequest?.consent?.id || '').trim();
  const dateRange = hiRequest?.dateRange && typeof hiRequest.dateRange === 'object' ? hiRequest.dateRange : null;
  const dateFrom = String(dateRange?.from || '').trim();
  const dateTo = String(dateRange?.to || '').trim();
  const dataPushUrl = String(hiRequest?.dataPushUrl || '').trim();
  const keyMaterial = hiRequest?.keyMaterial && typeof hiRequest.keyMaterial === 'object' ? hiRequest.keyMaterial : null;
  const cryptoAlg = String(keyMaterial?.cryptoAlg || '').trim();
  const curve = String(keyMaterial?.curve || '').trim();
  const dhPublicKey = keyMaterial?.dhPublicKey && typeof keyMaterial.dhPublicKey === 'object'
    ? keyMaterial.dhPublicKey
    : null;

  return {
    requestId,
    transactionId,
    hiRequest,
    consentId,
    dateFrom,
    dateTo,
    dataPushUrl,
    keyMaterial,
    cryptoAlg,
    curve,
    dhPublicKey,
  };
}

function validationError(parsed) {
  if (!parsed.requestId) {
    return 'REQUEST-ID is required.';
  }
  if (!parsed.hiRequest) {
    return 'hiRequest is required.';
  }
  if (!parsed.consentId) {
    return 'hiRequest.consent.id is required.';
  }
  if (!parsed.dateFrom || !parsed.dateTo) {
    return 'hiRequest.dateRange.from and hiRequest.dateRange.to are required.';
  }
  if (!isNonEmptyString(parsed.dataPushUrl)) {
    return 'hiRequest.dataPushUrl is required.';
  }
  if (!parsed.keyMaterial) {
    return 'hiRequest.keyMaterial is required.';
  }
  if (!parsed.cryptoAlg || !parsed.curve || !parsed.dhPublicKey) {
    return 'hiRequest.keyMaterial must include cryptoAlg, curve, and dhPublicKey.';
  }
  if (!isNonEmptyString(parsed.dhPublicKey.expiry) || !isNonEmptyString(parsed.dhPublicKey.parameters) || !isNonEmptyString(parsed.dhPublicKey.keyValue)) {
    return 'hiRequest.keyMaterial.dhPublicKey must include expiry, parameters, and keyValue.';
  }
  if (!isNonEmptyString(parsed.keyMaterial.nonce)) {
    return 'hiRequest.keyMaterial.nonce is required.';
  }
  return null;
}

function safeDataPushHost(dataPushUrl) {
  try {
    return new URL(dataPushUrl).host || null;
  } catch {
    return 'invalid';
  }
}

function extractCareContextReferences(body = {}, hiRequest = null) {
  const refs = [];
  const lists = [hiRequest?.careContexts, hiRequest?.consent?.careContexts, body?.careContexts];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const ref = String(item?.careContextReference || item?.referenceNumber || '').trim();
      if (ref) refs.push(ref);
    }
  }
  const single = String(hiRequest?.careContextReference || body?.careContextReference || '').trim();
  if (single) refs.push(single);
  return [...new Set(refs)];
}

async function resolveClinicalSource(careContextReference) {
  const careContext = await prisma.abdmCareContext.findUnique({
    where: { careContextId: careContextReference },
    select: { sourceType: true, sourceId: true, careContextId: true, hiType: true },
  });
  if (!careContext) {
    return { error: `No AbdmCareContext for careContextReference ${careContextReference}` };
  }
  if (!careContext.sourceId) {
    return { error: `Care context ${careContextReference} has no sourceId` };
  }
  return { careContext };
}

async function buildFhirBundleForCareContext(careContext) {
  const sourceType = String(careContext.sourceType || '').toUpperCase();
  if (sourceType === 'CONSULTATION') {
    return buildOpdConsultationBundleFromConsultationId(careContext.sourceId);
  }
  if (sourceType === 'PRESCRIPTION') {
    return buildPrescriptionBundleFromConsultationId(careContext.sourceId);
  }
  if (sourceType === 'TREATMENT_PLAN') {
    return buildPrescriptionBundleFromTreatmentPlanId(careContext.sourceId);
  }
  if (sourceType === 'LAB_ORDER') {
    return buildDiagnosticReportBundleFromLabOrderId(careContext.sourceId);
  }
  if (sourceType === 'ADMISSION') {
    return buildInpatientBundleFromAdmissionId(careContext.sourceId);
  }
  if (sourceType === 'DISCHARGE') {
    return buildDischargeSummaryBundleFromAdmissionId(careContext.sourceId);
  }
  throw new Error(`Unsupported sourceType ${sourceType}`);
}

function isSuccessfulPush(status) {
  const code = Number(status);
  return code >= 200 && code < 300;
}

function isSuccessfulNotify(result) {
  return Boolean(result) && !result.error && isSuccessfulPush(result.status);
}

function transferErrorMeta(result, fallbackCode, fallbackMessage) {
  const data = result?.data && typeof result.data === 'object' ? result.data : {};
  const err = data.error && typeof data.error === 'object' ? data.error : data;
  return {
    errorCode: String(err?.code || err?.errorCode || result?.errorCode || result?.status || fallbackCode).slice(0, 80),
    errorMessage: String(err?.message || data.message || result?.errorMessage || fallbackMessage).slice(0, 2000),
  };
}

/**
 * Updates only the AbdmHealthDocument for this HI careContext (sourceType+sourceId).
 * Never throws into the HI transfer loop.
 */
async function markHiTransferDocument(careContext, data) {
  const sourceType = String(careContext?.sourceType || '').trim();
  const sourceId = String(careContext?.sourceId || '').trim();
  if (!sourceType || !sourceId) return;
  try {
    const existing = await prisma.abdmHealthDocument.findUnique({
      where: { sourceType_sourceId: { sourceType, sourceId } },
      select: { id: true },
    });
    if (!existing) {
      logHi('HI document status skipped; no AbdmHealthDocument', {
        careContextId: careContext.careContextId || null,
        sourceType,
        sourceId,
      });
      return;
    }
    await prisma.abdmHealthDocument.update({
      where: { id: existing.id },
      data,
    });
    logHi('HI document status updated', {
      documentId: existing.id,
      careContextId: careContext.careContextId || null,
      sourceType,
      sourceId,
      syncStatus: data.syncStatus,
    });
  } catch (err) {
    logHi('HI document status update failed', {
      careContextId: careContext.careContextId || null,
      sourceType,
      sourceId,
      reason: err.message,
    });
  }
}

async function resolveCareContextsFromConsent({ transactionId, consentId, dateFrom, dateTo }) {
  const approvedRefs = await resolveConsentCareContextReferences(consentId);
  if (!approvedRefs.length) {
    logHi('HI transfer skipped', {
      transactionId,
      consentId: consentId || null,
      reason: 'Consent has no careContextReference list; will not select arbitrary OPD care contexts.',
    });
    return [];
  }

  const patientIds = await resolvePatientIdsByConsentId(consentId);
  if (!patientIds.length) {
    logHi('HI transfer skipped', {
      transactionId,
      consentId: consentId || null,
      reason: 'Cannot resolve patient from consentId; no persisted consent ABHA mapping.',
    });
    return [];
  }

  const resolved = await filterConsentConsultationCareContexts({
    careContextIds: approvedRefs,
    patientIds,
    dateFrom,
    dateTo,
  });
  if (!resolved.length) {
    logHi('HI transfer skipped', {
      transactionId,
      consentId: consentId || null,
      patientIds,
      approvedRefs,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      reason: 'No existing AbdmCareContext matches consent careContexts and HI dateRange.',
    });
    return [];
  }

  logHi('HI sources resolved from consent careContexts', {
    transactionId,
    consentId: consentId || null,
    patientIds,
    count: resolved.length,
    careContextIds: resolved.map((row) => row.careContextId),
  });
  return resolved;
}

async function transferHealthInformation({
  transactionId,
  careContextReferences,
  consentId,
  dateFrom,
  dateTo,
}) {
  if (!transactionId) {
    logHi('HI transfer skipped', { reason: 'transactionId missing from HI request' });
    return;
  }

  let refs = Array.isArray(careContextReferences) ? [...careContextReferences] : [];
  const approved = await resolveConsentCareContextReferences(consentId);
  if (refs.length && approved.length) {
    const allowed = new Set(approved);
    refs = refs.filter((ref) => allowed.has(ref));
  }
  if (!refs.length) {
    const resolved = await resolveCareContextsFromConsent({
      transactionId,
      consentId,
      dateFrom,
      dateTo,
    });
    refs = resolved.map((row) => row.careContextId);
    if (!refs.length) return;
  }

  for (const careContextReference of refs) {
    let careContext = null;
    try {
      const resolved = await resolveClinicalSource(careContextReference);
      if (resolved.error) {
        logHi('HI transfer skipped', { transactionId, careContextReference, reason: resolved.error });
        continue;
      }
      careContext = resolved.careContext;

      const fhirBundle = await buildFhirBundleForCareContext(careContext);
      const pushed = await pushHealthInformation({
        transactionId,
        fhirBundle,
        careContextReference: careContext.careContextId,
      });

      if (!isSuccessfulPush(pushed.status)) {
        logHi('HI data push unsuccessful', {
          transactionId,
          careContextReference: careContext.careContextId,
          status: pushed.status ?? null,
          errorCode: pushed.errorCode || null,
          data: pushed.data ?? null,
        });
        await notifyHealthInformation({
          transactionId,
          careContextReference: careContext.careContextId,
          sessionStatus: 'FAILED',
          hiStatus: 'ERRORED',
        }).catch((notifyErr) => {
          logHi('HI FAILED notify skipped', { transactionId, reason: notifyErr.message });
        });
        const meta = transferErrorMeta(pushed, 'HI_PUSH_FAILED', 'Health information dataPush failed');
        await markHiTransferDocument(careContext, {
          syncStatus: 'FAILED',
          lastNotifiedAt: new Date(),
          ...meta,
        });
        continue;
      }

      const notified = await notifyHealthInformation({
        transactionId,
        careContextReference: careContext.careContextId,
        sessionStatus: 'TRANSFERRED',
      });

      if (!isSuccessfulNotify(notified)) {
        const meta = transferErrorMeta(notified, 'HI_NOTIFY_FAILED', 'Health information notify failed');
        await markHiTransferDocument(careContext, {
          syncStatus: 'FAILED',
          requestId: notified?.outboundRequestId || null,
          lastNotifiedAt: new Date(),
          ...meta,
        });
        continue;
      }

      await markHiTransferDocument(careContext, {
        syncStatus: 'SYNCED',
        errorCode: null,
        errorMessage: null,
        requestId: notified?.outboundRequestId || null,
        lastNotifiedAt: new Date(),
      });
    } catch (err) {
      logHi('HI transfer failed', {
        transactionId,
        careContextReference,
        reason: err.message,
      });
      if (careContext) {
        await markHiTransferDocument(careContext, {
          syncStatus: 'FAILED',
          errorCode: 'HI_TRANSFER_FAILED',
          errorMessage: String(err.message || 'Health information transfer failed'),
          lastNotifiedAt: new Date(),
        });
      }
    }
  }
}

async function callHipOnRequest({ incomingRequestId, transactionId }) {
  const accessToken = await ensureAccessToken();
  const headers = buildAbdmHeaders({ accessToken });
  const outboundRequestId = headers['REQUEST-ID'];

  // M2 6.3.4 exact body: hiRequest.{transactionId,sessionStatus} + response.requestId
  const payload = {
    hiRequest: {
      sessionStatus: 'ACKNOWLEDGED',
    },
    response: {
      requestId: incomingRequestId,
    },
  };
  if (transactionId) {
    payload.hiRequest.transactionId = transactionId;
  }

  try {
    const response = await client.post(ON_REQUEST_PATH, payload, { headers });
    logHi('on-request ACK response', {
      status: response.status,
      outboundRequestId,
      responseRequestId: incomingRequestId,
      transactionId: transactionId || null,
      sessionStatus: 'ACKNOWLEDGED',
      body: response.data ?? null,
    });
    return { status: response.status, data: response.data, error: false, outboundRequestId };
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };
    logHi('on-request ACK failed', {
      status,
      outboundRequestId,
      responseRequestId: incomingRequestId,
      transactionId: transactionId || null,
      error: true,
      errorCode: data?.code || data?.error?.code || null,
      errorMessage: data?.message || data?.error?.message || err.message,
    });
    return { status, data, error: true, outboundRequestId };
  }
}

/**
 * ABDM M2 6.3.3 HIP health-information request callback.
 * POST {bridge}/api/v3/hip/health-information/request
 * Then 6.3.4 POST /data-flow/v3/health-information/hip/on-request
 */
async function handleHealthInformationRequestCallback(body = {}, headers = {}) {
  const parsed = parseHiRequest(body, headers);

  logHi('HI REQUEST CALLBACK received', {
    requestId: parsed.requestId || null,
    consentId: parsed.consentId || null,
    transactionId: parsed.transactionId || null,
    hipId: headerValue(headers, 'X-HIP-ID') || null,
    dateFrom: parsed.dateFrom || null,
    dateTo: parsed.dateTo || null,
    dataPushUrlHost: parsed.dataPushUrl ? safeDataPushHost(parsed.dataPushUrl) : null,
    keyMaterialPresent: Boolean(parsed.keyMaterial),
    cryptoAlg: parsed.cryptoAlg || null,
    curve: parsed.curve || null,
  });

  const invalid = validationError(parsed);
  if (invalid) {
    logHi('HI REQUEST CALLBACK rejected', {
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

  const stored = saveHiSession({
    consentId: parsed.consentId,
    transactionId: parsed.transactionId,
    dateRange: { from: parsed.dateFrom, to: parsed.dateTo },
    dataPushUrl: parsed.dataPushUrl,
    keyMaterial: parsed.keyMaterial,
    requestId: parsed.requestId,
    receivedAt: new Date().toISOString(),
  });
  logHi('HI session stored', {
    requestId: parsed.requestId,
    consentId: parsed.consentId,
    transactionId: parsed.transactionId || null,
    stored: Boolean(stored),
    keyMaterialPresent: Boolean(parsed.keyMaterial),
  });

  try {
    await callHipOnRequest({
      incomingRequestId: parsed.requestId,
      transactionId: parsed.transactionId,
    });
  } catch (err) {
    logHi('on-request ACK failed', {
      status: err.status || 500,
      error: true,
      message: err.message,
      requestId: parsed.requestId,
      consentId: parsed.consentId,
    });
  }

  try {
    await transferHealthInformation({
      transactionId: parsed.transactionId,
      careContextReferences: extractCareContextReferences(body, parsed.hiRequest),
      consentId: parsed.consentId,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
    });
  } catch (err) {
    logHi('HI transfer failed', {
      transactionId: parsed.transactionId || null,
      reason: err.message,
    });
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

module.exports = {
  handleHealthInformationRequestCallback,
  ON_REQUEST_PATH,
};
