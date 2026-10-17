import api, { getApiErrorMessage } from '../../utils/api';

const REQUEST_AADHAAR_OTP_PATH =
  import.meta.env.VITE_ABDM_REQUEST_AADHAAR_OTP_PATH || '/abdm/request-aadhaar-otp';

const VERIFY_AADHAAR_OTP_PATH =
  import.meta.env.VITE_ABDM_VERIFY_AADHAAR_OTP_PATH || '/abdm/verify-aadhaar-otp';
const REQUEST_EXISTING_ABHA_OTP_PATH =
  import.meta.env.VITE_ABDM_REQUEST_EXISTING_ABHA_OTP_PATH || '/abdm/request-existing-abha-otp';
const VERIFY_EXISTING_ABHA_OTP_PATH =
  import.meta.env.VITE_ABDM_VERIFY_EXISTING_ABHA_OTP_PATH || '/abdm/verify-existing-abha-otp';

/** Normalize to Indian 10-digit mobile (handles 0XXXXXXXXXX / 91XXXXXXXXXX). */
export function normalizeMobile(mobile) {
  let digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return /^\d{10}$/.test(digits) ? digits : '';
}

/**
 * Request Aadhaar OTP via our backend (backend talks to ABDM Sandbox).
 * Body: { aadhaar, mobile? } — mobile is preserved for enrol step (not used by OTP gov API).
 */
export async function requestAadhaarOtp(aadhaar, mobile) {
  const payload = {
    aadhaar: String(aadhaar || '').replace(/\D/g, ''),
  };
  const phone = normalizeMobile(mobile);
  if (phone) payload.mobile = phone;

  const res = await api.post(REQUEST_AADHAAR_OTP_PATH, payload);
  const data = res?.data || {};
  return {
    txnId: data.txnId || data.transactionId || '',
    message: data.message || '',
    raw: data,
  };
}

/**
 * Verify Aadhaar OTP and create/enrol ABHA via our backend.
 * Body: { txnId, otp, mobile }
 */
export async function verifyAadhaarOtp({ txnId, otp, mobile } = {}) {
  const payload = {
    txnId: String(txnId || '').trim(),
    otp: String(otp || '').replace(/\D/g, ''),
  };
  const phone = normalizeMobile(mobile);
  if (phone) {
    payload.mobile = phone;
  }

  const res = await api.post(VERIFY_AADHAAR_OTP_PATH, payload);
  const data = res?.data || {};

  return {
    success: Boolean(data.success ?? (data.abhaNumber || data.ABHAProfile)),
    message: data.message || '',
    txnId: data.txnId || payload.txnId,
    abhaNumber: data.abhaNumber || data.ABHAProfile?.ABHANumber || '',
    abhaAddress: data.abhaAddress || (Array.isArray(data.ABHAProfile?.phrAddress) ? data.ABHAProfile.phrAddress[0] : '') || '',
    fullName: data.fullName || '',
    firstName: data.firstName || data.ABHAProfile?.firstName || '',
    middleName: data.middleName || data.ABHAProfile?.middleName || '',
    lastName: data.lastName || data.ABHAProfile?.lastName || '',
    gender: data.gender || data.ABHAProfile?.gender || '',
    dob: data.dob || data.ABHAProfile?.dob || '',
    mobile: data.mobile || data.ABHAProfile?.mobile || '',
    email: data.email ?? data.ABHAProfile?.email ?? null,
    address: data.address || data.ABHAProfile?.address || data.ABHAProfile?.addressLine1 || '',
    abhaStatus: data.abhaStatus || data.ABHAProfile?.abhaStatus || '',
    isNew: data.isNew,
    raw: data.raw || data,
  };
}

/**
 * Request OTP for existing ABHA login/link flow.
 * loginHint: "abha-number" | "abha-address"
 */
export async function requestExistingAbhaOtp({ loginHint, loginId } = {}) {
  const payload = {
    loginHint: String(loginHint || '').trim().toLowerCase(),
    loginId: String(loginId || '').trim(),
  };
  const res = await api.post(REQUEST_EXISTING_ABHA_OTP_PATH, payload);
  const data = res?.data || {};
  return {
    txnId: data.txnId || data.transactionId || '',
    message: data.message || '',
    raw: data,
  };
}

/**
 * Verify OTP for existing ABHA login/link flow.
 */
export async function verifyExistingAbhaOtp({ txnId, otp } = {}) {
  const payload = {
    txnId: String(txnId || '').trim(),
    otp: String(otp || '').replace(/\D/g, ''),
  };
  const res = await api.post(VERIFY_EXISTING_ABHA_OTP_PATH, payload);
  const data = res?.data || {};

  return {
    success: Boolean(data.success ?? (data.abhaNumber || data.ABHAProfile)),
    message: data.message || '',
    txnId: data.txnId || payload.txnId,
    abhaNumber: data.abhaNumber || data.healthIdNumber || data.ABHAProfile?.ABHANumber || '',
    healthIdNumber: data.healthIdNumber || data.abhaNumber || data.ABHAProfile?.ABHANumber || '',
    abhaAddress: data.abhaAddress || (Array.isArray(data.ABHAProfile?.phrAddress) ? data.ABHAProfile.phrAddress[0] : '') || '',
    fullName: data.fullName || '',
    firstName: data.firstName || data.ABHAProfile?.firstName || '',
    middleName: data.middleName || data.ABHAProfile?.middleName || '',
    lastName: data.lastName || data.ABHAProfile?.lastName || '',
    gender: data.gender || data.ABHAProfile?.gender || '',
    dob: data.dob || data.ABHAProfile?.dob || '',
    mobile: data.mobile || data.ABHAProfile?.mobile || '',
    email: data.email ?? data.ABHAProfile?.email ?? null,
    address: data.address || data.ABHAProfile?.address || data.ABHAProfile?.addressLine1 || '',
    abhaStatus: data.abhaStatus || data.ABHAProfile?.abhaStatus || '',
    phrAddress: Array.isArray(data.phrAddress)
      ? data.phrAddress
      : Array.isArray(data.ABHAProfile?.phrAddress)
        ? data.ABHAProfile.phrAddress
        : [],
    raw: data.raw || data,
  };
}

export async function retryContextNotify({ patientId } = {}) {
  const res = await api.post('/abdm/hip/patient/context-notify', {
    patientId: String(patientId || '').trim(),
  });
  return res?.data || {};
}

/**
 * HIP care-context link for a verified ABHA patient.
 * POST /abdm/hip/patient/link
 */
export async function linkHipPatient({ patientId, force = false, linkToken } = {}) {
  const payload = {
    patientId: String(patientId || '').trim(),
    force: Boolean(force),
  };
  if (linkToken) payload.linkToken = String(linkToken).trim();
  const res = await api.post('/abdm/hip/patient/link', payload);
  return res?.data || {};
}

/**
 * HIP link status for a patient.
 * GET /abdm/hip/patient/status/:patientId
 */
export async function getHipPatientStatus(patientId) {
  const id = String(patientId || '').trim();
  const res = await api.get(`/abdm/hip/patient/status/${encodeURIComponent(id)}`);
  return res?.data || {};
}

export const ABDM_LINK_LABEL = {
  NOT_LINKED: 'ABDM Not Linked',
  TOKEN_PENDING: 'Link Token Pending',
  TOKEN_GENERATED: 'Link Token Generated',
  CARE_LINKING: 'Care Context Linking',
  CARE_LINKED: 'Care Context Linked',
  UNAVAILABLE: 'ABDM Temporarily Unavailable',
  LINK_FAILED: 'ABDM Link Failed',
};

export function isAbdmTemporarilyBlocked(data = {}) {
  const text = JSON.stringify(data || {});
  return text.includes('ABDM-1027') || /you are blocked/i.test(text) || /try again after 24 hours/i.test(text);
}

function readAbdmStatuses(data = {}) {
  const patient = data.patient && typeof data.patient === 'object' ? data.patient : {};
  return {
    patient,
    careContextStatus: String(data.careContextStatus || patient.careContextStatus || '').toUpperCase(),
    syncStatus: String(data.syncStatus || patient.syncStatus || '').toUpperCase(),
  };
}

export function readAbdmLinkState(data = {}) {
  const { careContextStatus, syncStatus } = readAbdmStatuses(data);
  if (isAbdmTemporarilyBlocked(data)) return 'UNAVAILABLE';
  if (careContextStatus === 'FAILED' || syncStatus === 'FAILED') return 'LINK_FAILED';
  if (careContextStatus === 'LINKED') return 'CARE_LINKED';
  if (data.success === false) return 'LINK_FAILED';
  if (data.pendingCallback || careContextStatus === 'PENDING' || syncStatus === 'PENDING') return 'TOKEN_PENDING';
  return 'NOT_LINKED';
}

export function shouldRetryContextNotify(data = {}) {
  const { careContextStatus, syncStatus } = readAbdmStatuses(data);
  return careContextStatus === 'LINKED' && (syncStatus === 'PENDING' || syncStatus === 'FAILED');
}

export function shouldStopAbdmPoll(data = {}) {
  const state = readAbdmLinkState(data);
  if (state === 'LINK_FAILED' || state === 'UNAVAILABLE') return true;
  if (state !== 'CARE_LINKED') return false;
  return readAbdmStatuses(data).syncStatus === 'SYNCED';
}

export function abdmLinkTokenLabel(state) {
  if (state === 'CARE_LINKED' || state === 'TOKEN_GENERATED' || state === 'CARE_LINKING') return 'Generated';
  if (state === 'TOKEN_PENDING') return 'Pending';
  if (state === 'UNAVAILABLE') return 'Temporarily Unavailable';
  if (state === 'LINK_FAILED') return 'Failed';
  return 'Not linked';
}

export function abdmCareContextLabel(state, data = {}) {
  const { careContextStatus } = readAbdmStatuses(data);
  if (careContextStatus === 'LINKED') return 'Linked';
  if (careContextStatus === 'FAILED') return 'Failed';
  if (state === 'CARE_LINKING') return 'Linking';
  return 'Not Linked';
}

export function abdmLinkUserMessage(data = {}, err) {
  const payload = err?.response?.data || data || {};
  if (isAbdmTemporarilyBlocked(payload)) {
    return 'You are blocked. Please try again after 24 hours.';
  }
  const state = readAbdmLinkState(payload);
  const { careContextStatus, syncStatus } = readAbdmStatuses(payload);
  if (careContextStatus === 'LINKED' && syncStatus === 'SYNCED') {
    return 'Care context linked and ABDM sync completed.';
  }
  if (careContextStatus === 'LINKED' && syncStatus === 'FAILED') {
    return 'Care context linked, but context notification failed.';
  }
  if (careContextStatus === 'LINKED' && syncStatus === 'PENDING') {
    return 'Care context linked. Waiting for context notify confirmation.';
  }
  if (state === 'TOKEN_PENDING') return 'ABDM linking request sent. Waiting for confirmation.';
  if (state === 'LINK_FAILED') return 'ABDM linking could not be completed. The patient was still registered.';
  return '';
}

export async function getHealthDocument({ documentId, sourceType, sourceId } = {}) {
  if (documentId) {
    const res = await api.get(`/abdm/health-records/${encodeURIComponent(documentId)}`);
    return res?.data || {};
  }
  const res = await api.get('/abdm/health-records', {
    params: { sourceType, sourceId },
  });
  return res?.data || {};
}

export async function retryHealthDocument(documentId) {
  const res = await api.post(`/abdm/health-records/${encodeURIComponent(documentId)}/retry`);
  return res?.data || {};
}

export async function listHiuConsents() {
  const res = await api.get('/abdm/hiu/consents');
  return res?.data || {};
}

export async function searchHiuConsentPatients(q) {
  const res = await api.get('/abdm/hiu/consent-patients', { params: { q: q || undefined } });
  return res?.data || {};
}

export async function initiateHiuConsentRequest(payload) {
  const res = await api.post('/abdm/hiu/consents/init', payload);
  return res?.data || {};
}

export async function getHiuConsent(consentRequestId) {
  const res = await api.get(`/abdm/hiu/consents/${encodeURIComponent(consentRequestId)}`);
  return res?.data || {};
}

export async function requestHiuHealthInformation(consentId) {
  const res = await api.post(
    '/abdm/hiu/health-information/request',
    { consentId },
    { silent: true }
  );
  return res?.data || {};
}

export async function getHiuHealthInformationStatus(consentId) {
  const res = await api.get('/abdm/hiu/health-information/status', {
    params: { consentId },
    silent: true,
  });
  return res?.data || {};
}

export async function listHiuHealthRecords(consentId) {
  const res = await api.get('/abdm/hiu/health-information/records', {
    params: { consentId },
    silent: true,
  });
  return res?.data || {};
}

export async function listPatientHealthRecords(patientId) {
  const res = await api.get('/abdm/health-records', {
    params: { patientId },
  });
  return res?.data || {};
}

export function shouldRetryHealthDocument(doc) {
  if (!doc) return false;
  const sync = String(doc.syncStatus || '').toUpperCase();
  if (sync === 'FAILED') return true;
  return sync === 'PENDING' && Boolean(doc.errorCode || doc.errorMessage);
}

export function shouldStopHealthDocumentPoll(doc) {
  const sync = String(doc?.syncStatus || '').toUpperCase();
  return sync === 'SYNCED' || sync === 'FAILED';
}

export function healthDocumentUserMessage(doc) {
  const sync = String(doc?.syncStatus || '').toUpperCase();
  if (sync === 'SYNCED') return 'ABDM Sync Completed';
  if (sync === 'FAILED') return doc.errorMessage || 'ABDM sync failed.';
  if (sync === 'PENDING') return 'ABDM sync in progress.';
  if (sync === 'NOT_SENT') return 'Not sent to ABDM. Waiting for a Health Information Request.';
  return '';
}

export function getAbdmErrorMessage(err, fallback = 'ABDM service request failed.') {
  const data = err?.response?.data;
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.error?.code === 'string' && typeof data?.message === 'string') {
    return `${data.error.code}: ${data.message}`;
  }
  if (typeof data?.error?.code === 'string' && typeof data?.error?.message === 'string') {
    return `${data.error.code}: ${data.error.message}`;
  }
  if (data?.details?.[0]?.message) return data.details[0].message;
  if (typeof data?.code === 'string' && typeof data?.message === 'string') {
    return data.message;
  }
  return getApiErrorMessage(err, fallback);
}
