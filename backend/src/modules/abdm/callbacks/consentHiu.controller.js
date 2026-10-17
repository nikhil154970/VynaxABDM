const crypto = require('crypto');
const { prisma } = require('../../../config/prisma');
const { abdmRequest } = require('../lib/abdmClient');
const { abdmConfig } = require('../lib/abdmConfig');
const { resolveHospitalAbdmConfig } = require('../lib/hospitalResolver');
const {
  persistConsentRequestOnInit,
  persistConsentOnFetch,
  parseCallbackError,
  listHiuConsentRequests,
  getHiuConsentRequest,
  createPendingConsentRequest,
  serializeConsentRequest,
  canonicalAbha,
  maskAbhaAddress,
} = require('../lib/abdmConsentRequestStore');

function logHiuConsent(label, payload) {
  console.log(`[abdm-hiu-consent] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function parseOnInit(body = {}) {
  const consentRequest = body?.consentRequest && typeof body.consentRequest === 'object' ? body.consentRequest : null;
  const response = body?.response && typeof body.response === 'object' ? body.response : null;
  const consentRequestId = String(consentRequest?.id || '').trim();
  const requestId = String(response?.requestId || body?.requestId || '').trim();
  const error = body?.error == null ? null : body.error;
  return { consentRequestId, requestId, error };
}

/**
 * ABDM M3 HIU consent request on-init callback.
 * POST {bridge}/api/v3/hiu/consent/request/on-init
 */
async function handleConsentHiuOnInitCallback(body = {}) {
  const parsed = parseOnInit(body);
  const hasError = parsed.error != null && parsed.error !== '';
  const errorMeta = parseCallbackError(parsed.error);

  logHiuConsent('CONSENT HIU ON-INIT received', {
    consentRequestId: parsed.consentRequestId || null,
    requestId: parsed.requestId || null,
    error: hasError,
    errorCode: errorMeta.errorCode,
  });

  try {
    await persistConsentRequestOnInit({
      consentRequestId: parsed.consentRequestId,
      requestId: parsed.requestId,
      status: hasError ? 'FAILED' : 'REQUESTED',
      errorCode: errorMeta.errorCode,
      errorMessage: errorMeta.errorMessage,
      rawPayload: body,
    });
  } catch (err) {
    logHiuConsent('Consent request persist failed', {
      consentRequestId: parsed.consentRequestId || null,
      requestId: parsed.requestId || null,
      reason: err.message,
    });
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

function firstArtefactId(list) {
  if (!Array.isArray(list) || !list[0]) return '';
  return String(list[0].id || list[0].consentId || '').trim();
}

const KNOWN_HIU_CONSENT_STATUSES = new Set([
  'GRANTED',
  'DENIED',
  'REVOKED',
  'EXPIRED',
  'REQUESTED',
  'PENDING',
]);

function parseHiuConsentNotify(body = {}) {
  const notification = body?.notification && typeof body.notification === 'object' ? body.notification : null;
  const consentRequestId = String(
    notification?.consentRequestId ||
      notification?.consentRequest?.id ||
      body?.consentRequestId ||
      ''
  ).trim();
  const status = String(notification?.status || body?.status || '').trim().toUpperCase();
  const artefactId = firstArtefactId(notification?.consentArtefacts);
  const consentId = String(notification?.consentId || artefactId || '').trim();
  const abhaAddress = String(
    notification?.patient?.id ||
      notification?.consentDetail?.patient?.id ||
      ''
  ).trim();
  const error = body?.error == null ? null : body.error;
  return { consentRequestId, status, artefactId, consentId, abhaAddress, error, notification };
}

/**
 * ABDM M3 HIU consent request notify callback.
 * POST {bridge}/api/v3/hiu/consent/request/notify
 * Persist only — no consent fetch / HI request.
 */
async function handleConsentHiuNotifyCallback(body = {}) {
  const parsed = parseHiuConsentNotify(body);
  const hasError = parsed.error != null && parsed.error !== '';
  const errorMeta = parseCallbackError(parsed.error);
  const status = hasError ? 'FAILED' : parsed.status;

  logHiuConsent('CONSENT HIU NOTIFY received', {
    consentRequestId: parsed.consentRequestId || null,
    status: status || null,
    artefactId: parsed.artefactId || parsed.consentId || null,
    error: hasError,
  });

  try {
    if (!hasError && !KNOWN_HIU_CONSENT_STATUSES.has(status)) {
      logHiuConsent('Consent notify ignored; status missing or unknown', {
        consentRequestId: parsed.consentRequestId || null,
        artefactId: parsed.artefactId || parsed.consentId || null,
        status: parsed.status || null,
      });
    } else if (parsed.consentRequestId || parsed.consentId || parsed.artefactId) {
      await persistConsentRequestOnInit({
        consentRequestId: parsed.consentRequestId || undefined,
        status,
        consentId: parsed.consentId || parsed.artefactId || null,
        artefactId: parsed.artefactId || parsed.consentId || null,
        abhaAddress: parsed.abhaAddress || null,
        errorCode: errorMeta.errorCode,
        errorMessage: errorMeta.errorMessage,
        rawPayload: body,
      });
    } else {
      logHiuConsent('Consent notify ignored; consentRequestId and artefact id missing', {
        status: status || null,
      });
    }
  } catch (err) {
    logHiuConsent('Consent notify persist failed', {
      consentRequestId: parsed.consentRequestId || null,
      reason: err.message,
    });
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

function parseHiuConsentOnStatus(body = {}) {
  const consentRequest = body?.consentRequest && typeof body.consentRequest === 'object' ? body.consentRequest : null;
  const response = body?.response && typeof body.response === 'object' ? body.response : null;
  const consentRequestId = String(consentRequest?.id || '').trim();
  const status = String(consentRequest?.status || '').trim().toUpperCase();
  const artefactId = firstArtefactId(consentRequest?.consentArtefacts);
  const requestId = String(response?.requestId || '').trim();
  const error = body?.error == null ? null : body.error;
  return { consentRequestId, status, artefactId, requestId, error };
}

/**
 * ABDM M3 HIU consent request on-status callback.
 * POST {bridge}/api/v3/hiu/consent/request/on-status
 * Persist only — no consent fetch.
 */
async function handleConsentHiuOnStatusCallback(body = {}) {
  const parsed = parseHiuConsentOnStatus(body);
  const hasError = parsed.error != null && parsed.error !== '';
  const errorMeta = parseCallbackError(parsed.error);
  const status = hasError ? 'FAILED' : parsed.status;

  logHiuConsent('CONSENT HIU ON-STATUS received', {
    consentRequestId: parsed.consentRequestId || null,
    requestId: parsed.requestId || null,
    status: status || null,
    artefactId: parsed.artefactId || null,
    error: hasError,
  });

  try {
    if (!hasError && !KNOWN_HIU_CONSENT_STATUSES.has(status)) {
      logHiuConsent('Consent on-status ignored; status missing or unknown', {
        consentRequestId: parsed.consentRequestId || null,
        status: parsed.status || null,
      });
    } else if (parsed.consentRequestId || parsed.artefactId) {
      const persist = {
        consentRequestId: parsed.consentRequestId || undefined,
        requestId: parsed.requestId || undefined,
        status,
        errorCode: errorMeta.errorCode,
        errorMessage: errorMeta.errorMessage,
        rawPayload: body,
      };
      if (parsed.artefactId) {
        persist.consentId = parsed.artefactId;
        persist.artefactId = parsed.artefactId;
      }
      await persistConsentRequestOnInit(persist);
    } else {
      logHiuConsent('Consent on-status ignored; consentRequest.id missing', {
        status: status || null,
      });
    }
  } catch (err) {
    logHiuConsent('Consent on-status persist failed', {
      consentRequestId: parsed.consentRequestId || null,
      reason: err.message,
    });
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function parseHiuConsentOnFetch(body = {}) {
  const consent = asObject(body?.consent);
  const detail = asObject(consent?.consentDetail);
  const response = asObject(body?.response);
  const hip = asObject(detail?.hip);
  const hiu = asObject(detail?.hiu);
  const patient = asObject(detail?.patient);
  const purpose = asObject(detail?.purpose);
  const permission = asObject(detail?.permission);
  const consentManager = asObject(detail?.consentManager);
  const careContexts = Array.isArray(detail?.careContexts) ? detail.careContexts : [];
  const hiTypes = Array.isArray(detail?.hiTypes) ? detail.hiTypes : [];
  const status = String(consent?.status || '').trim().toUpperCase();
  const consentId = String(detail?.consentId || '').trim();
  const consentRequestId = String(
    detail?.consentRequestId ||
      consent?.consentRequestId ||
      body?.consentRequestId ||
      ''
  ).trim();
  return {
    status,
    consentId,
    consentRequestId,
    hipId: String(hip?.id || '').trim(),
    hiuId: String(hiu?.id || '').trim(),
    patientId: String(patient?.id || '').trim(),
    hiTypes,
    purpose,
    permission,
    careContexts,
    schemaVersion: String(detail?.schemaVersion || '').trim(),
    consentManager,
    signature: body?.signature == null ? null : body.signature,
    error: body?.error == null ? null : body.error,
    requestId: String(response?.requestId || '').trim(),
  };
}

/**
 * ABDM M3 HIU consent on-fetch callback.
 * POST {bridge}/api/v3/hiu/consent/on-fetch
 * Persist artefact only — no health information request.
 */
async function handleConsentHiuOnFetchCallback(body = {}) {
  const parsed = parseHiuConsentOnFetch(body);
  const hasError = parsed.error != null && parsed.error !== '';
  const errorMeta = parseCallbackError(parsed.error);
  const status = hasError ? 'FAILED' : parsed.status || 'GRANTED';

  logHiuConsent('CONSENT ON-FETCH received', {
    consentId: parsed.consentId || null,
    consentRequestId: parsed.consentRequestId || null,
    patientId: parsed.patientId || null,
    status: status || null,
    careContextCount: parsed.careContexts.length,
    hipId: parsed.hipId || null,
    hiuId: parsed.hiuId || null,
    hiTypeCount: parsed.hiTypes.length,
    schemaVersion: parsed.schemaVersion || null,
    hasPurpose: Boolean(parsed.purpose),
    hasPermission: Boolean(parsed.permission),
    hasConsentManager: Boolean(parsed.consentManager),
    hasSignature: parsed.signature != null && parsed.signature !== '',
    requestId: parsed.requestId || null,
    error: hasError,
  });

  try {
    await persistConsentOnFetch({
      consentRequestId: parsed.consentRequestId || undefined,
      consentId: parsed.consentId || undefined,
      artefactId: parsed.consentId || undefined,
      requestId: parsed.requestId || undefined,
      status,
      abhaAddress: parsed.patientId || undefined,
      errorCode: errorMeta.errorCode,
      errorMessage: errorMeta.errorMessage,
      rawPayload: body,
    });
  } catch (err) {
    logHiuConsent('Consent on-fetch persist failed', {
      consentId: parsed.consentId || null,
      reason: err.message,
    });
  }

  return {
    status: 202,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

const CONSENT_INIT_PATH = '/consent/v3/request/init';
const PURPOSE_TEXT = {
  CAREMGT: 'Care Management',
  BTG: 'Break the Glass',
  PUBHLTH: 'Public Health',
  HPAYMT: 'Healthcare Payment',
  DSRCH: 'Disease Related Research',
  PATRQT: 'Patient Requested',
};
const HI_TYPES = new Set([
  'OPConsultation',
  'Prescription',
  'DiagnosticReport',
  'DischargeSummary',
  'ImmunizationRecord',
  'HealthDocumentRecord',
  'WellnessRecord',
]);

function sandboxAbhaAddress(patient) {
  const address = String(patient?.abhaAddress || '').trim().toLowerCase();
  if (address.includes('@')) return address;
  const digits = String(patient?.abhaNumber || patient?.healthIdNumber || '').replace(/\D/g, '');
  if (digits.length >= 14) return `${digits}@sbx`;
  return '';
}

async function listHiuConsentPatientsApi(query = {}) {
  const q = String(query.q || '').trim();
  try {
    const where = {
      OR: [
        { abhaAddress: { not: null } },
        { abhaNumber: { not: null } },
      ],
    };
    if (q) {
      where.AND = [{
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { uhid: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q, mode: 'insensitive' } },
        ],
      }];
    }
    const rows = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        uhid: true,
        abhaAddress: true,
        abhaNumber: true,
        isAbhaVerified: true,
        abhaStatus: true,
      },
    });
    const items = rows.map((row) => {
      const abhaAddress = sandboxAbhaAddress(row);
      return {
        id: row.id,
        name: row.name,
        uhid: row.uhid,
        abhaAddress: abhaAddress || null,
        isAbhaVerified: Boolean(row.isAbhaVerified),
        abhaStatus: row.abhaStatus || null,
      };
    }).filter((row) => row.abhaAddress);
    return { status: 200, body: { success: true, items } };
  } catch (err) {
    logHiuConsent('List consent patients failed', { reason: err.message });
    return { status: 500, body: { success: false, message: 'Unable to list patients.' } };
  }
}

async function initiateHiuConsentRequestApi(body = {}) {
  const patientId = String(body.patientId || '').trim();
  if (!patientId) {
    return { status: 400, body: { success: false, message: 'patientId is required.' } };
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      uhid: true,
      abhaAddress: true,
      abhaNumber: true,
      healthIdNumber: true,
      isAbhaVerified: true,
    },
  });
  if (!patient) {
    return { status: 404, body: { success: false, message: 'Patient not found.' } };
  }

  const patientAbha = sandboxAbhaAddress(patient);
  if (!patientAbha) {
    return { status: 409, body: { success: false, message: 'Patient has no Sandbox ABHA address.' } };
  }

  const postedAbha = String(body.abhaAddress || '').trim().toLowerCase();
  if (postedAbha && canonicalAbha(postedAbha) !== canonicalAbha(patientAbha)) {
    return { status: 409, body: { success: false, message: 'ABHA address does not match the selected patient.' } };
  }

  const purposeCode = String(body.purposeCode || body.purpose?.code || 'CAREMGT').trim().toUpperCase();
  if (!PURPOSE_TEXT[purposeCode]) {
    return { status: 400, body: { success: false, message: 'Invalid purpose code.' } };
  }

  const hiTypes = (Array.isArray(body.hiTypes) ? body.hiTypes : [])
    .map((item) => String(item || '').trim())
    .filter((item) => HI_TYPES.has(item));
  if (!hiTypes.length) {
    return { status: 400, body: { success: false, message: 'At least one health-information type is required.' } };
  }

  const dateFrom = String(body.dateRange?.from || body.from || '').trim();
  const dateTo = String(body.dateRange?.to || body.to || '').trim();
  const dataEraseAt = String(body.dataEraseAt || body.permission?.dataEraseAt || '').trim();
  if (!dateFrom || !dateTo || !dataEraseAt) {
    return { status: 400, body: { success: false, message: 'dateRange.from, dateRange.to and dataEraseAt are required.' } };
  }

  const facility = await resolveHospitalAbdmConfig();
  const hiuId = String(facility.hiuId || facility.hipId || abdmConfig.hipId || '').trim();
  if (!hiuId) {
    return { status: 400, body: { success: false, message: 'HIU ID is not configured.' } };
  }

  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const consent = {
    purpose: {
      text: PURPOSE_TEXT[purposeCode],
      code: purposeCode,
      refUri: `https://nrces.in/ndhm/purposes/${purposeCode}.html`,
    },
    patient: { id: patientAbha },
    hiu: { id: hiuId },
    requester: {
      name: facility.facilityName || 'VyanX HIU',
      identifier: {
        type: 'REGNO',
        value: hiuId,
        system: 'https://www.mciindia.org',
      },
    },
    hiTypes,
    permission: {
      accessMode: 'VIEW',
      dateRange: { from: dateFrom, to: dateTo },
      dataEraseAt,
      frequency: { unit: 'HOUR', value: 1, repeats: 0 },
    },
  };

  const row = await createPendingConsentRequest({
    requestId,
    abhaAddress: patientAbha,
    rawPayload: { patientId: patient.id, uhid: patient.uhid, consent },
  });

  try {
    const response = await abdmRequest({
      method: 'POST',
      path: CONSENT_INIT_PATH,
      requestId,
      data: { requestId, timestamp, consent },
      apiName: 'HIU_CONSENT_INIT',
      additionalHeaders: { 'X-HIU-ID': hiuId },
      auditRequestBody: { consent: { ...consent, patient: { id: maskAbhaAddress(patientAbha) } } },
    });
    logHiuConsent('CONSENT INIT sent', {
      requestId,
      patientId: patient.id,
      status: response.status,
    });
    return {
      status: 202,
      body: {
        success: true,
        ...serializeConsentRequest(row),
        gatewayStatus: response.status,
      },
    };
  } catch (err) {
    await persistConsentRequestOnInit({
      consentRequestId: row.consentRequestId,
      requestId,
      status: 'FAILED',
      errorCode: String(err.status || 'CONSENT_INIT_FAILED'),
      errorMessage: String(err.message || 'Consent init failed').slice(0, 2000),
    });
    return {
      status: err.status && err.status < 500 ? err.status : 502,
      body: {
        success: false,
        message: err.message || 'Unable to initiate consent request.',
        consentRequestId: row.consentRequestId,
      },
    };
  }
}

async function listHiuConsentsApi() {
  try {
    const items = await listHiuConsentRequests();
    return { status: 200, body: { success: true, items } };
  } catch (err) {
    logHiuConsent('List HIU consents failed', { reason: err.message });
    return { status: 500, body: { success: false, message: 'Unable to list HIU consent requests.' } };
  }
}

async function getHiuConsentApi(consentRequestId) {
  try {
    const item = await getHiuConsentRequest(consentRequestId);
    if (!item) {
      return { status: 404, body: { success: false, message: 'Consent request not found.' } };
    }
    return { status: 200, body: { success: true, item } };
  } catch (err) {
    logHiuConsent('Get HIU consent failed', { reason: err.message });
    return { status: 500, body: { success: false, message: 'Unable to load HIU consent request.' } };
  }
}

module.exports = {
  handleConsentHiuOnInitCallback,
  handleConsentHiuNotifyCallback,
  handleConsentHiuOnStatusCallback,
  handleConsentHiuOnFetchCallback,
  listHiuConsentsApi,
  getHiuConsentApi,
  listHiuConsentPatientsApi,
  initiateHiuConsentRequestApi,
};
