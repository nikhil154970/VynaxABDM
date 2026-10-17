const axios = require('axios');
const { buildAbdmHeaders } = require('./abdmHeaders');
const { ensureAccessToken, getAbhaApiBase } = require('./abdmCertificate');
const {
  encryptAadhaar,
  encryptOtp,
  encryptWithPublicKey,
  getGovernmentPublicKey,
} = require('./abdmCrypto');
const { abdmConfig } = require('./abdmConfig');

const REQUEST_OTP_PATH = '/v3/enrollment/request/otp';
const ENROL_BY_AADHAAR_PATH = '/v3/enrollment/enrol/byAadhaar';
const LOGIN_REQUEST_OTP_PATH = '/v3/profile/login/request/otp';
const LOGIN_VERIFY_PATH = '/v3/profile/login/verify';
const LOGIN_VERIFY_USER_PATH = '/v3/profile/login/verify/user';
const PROFILE_ACCOUNT_PATH = '/v3/profile/account';

/** In-memory txn context so OTP-verify can reuse values captured at OTP-request time. */
const enrollmentTxnStore = new Map();

function normalizeAadhaar(aadhaar) {
  return String(aadhaar || '').replace(/\D/g, '');
}

/** Normalize to Indian 10-digit mobile (handles 0XXXXXXXXXX / 91XXXXXXXXXX). */
function normalizeMobile(mobile) {
  let digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return /^\d{10}$/.test(digits) ? digits : '';
}

function validateAadhaar(aadhaar) {
  const value = normalizeAadhaar(aadhaar);
  if (!/^\d{12}$/.test(value)) {
    const err = new Error('Aadhaar must be a valid 12-digit number.');
    err.status = 400;
    throw err;
  }
  return value;
}

function validateOtp(otp) {
  const value = String(otp || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(value)) {
    const err = new Error('OTP must be a valid 6-digit number.');
    err.status = 400;
    throw err;
  }
  return value;
}

function validateTxnId(txnId) {
  const value = String(txnId || '').trim();
  if (!value) {
    const err = new Error('txnId is required.');
    err.status = 400;
    throw err;
  }
  return value;
}

function validateLoginHint(loginHint) {
  const hint = String(loginHint || '').trim().toLowerCase();
  if (!['abha-number', 'abha-address'].includes(hint)) {
    const err = new Error('loginHint must be either "abha-number" or "abha-address".');
    err.status = 400;
    throw err;
  }
  return hint;
}

function saveEnrollmentTxnContext(txnId, context = {}) {
  if (!txnId) return;
  const prev = enrollmentTxnStore.get(txnId) || {};
  enrollmentTxnStore.set(txnId, {
    ...prev,
    ...context,
    txnId,
    updatedAt: new Date().toISOString(),
  });
}

function getEnrollmentTxnContext(txnId) {
  if (!txnId) return null;
  return enrollmentTxnStore.get(txnId) || null;
}

function createAbhaClient() {
  return axios.create({
    baseURL: getAbhaApiBase(),
    timeout: 30000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
}

function maskOtp(otp) {
  const value = String(otp || '');
  if (value.length < 2) return '******';
  return `${value[0]}****${value[value.length - 1]}`;
}

function maskMobile(mobile) {
  const value = String(mobile || '');
  if (value.length !== 10) return '**********';
  return `${value.slice(0, 2)}******${value.slice(-2)}`;
}

function mapAbhaEnrolmentResponse(data = {}) {
  const profile = data.ABHAProfile || data.abhaProfile || data.profile || {};
  const firstName = profile.firstName || '';
  const middleName = profile.middleName || '';
  const lastName = profile.lastName || '';
  const fullName =
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim() ||
    profile.name ||
    profile.fullName ||
    '';

  const phr = profile.phrAddress || profile.abhaAddress || profile.preferredAbhaAddress;
  const abhaAddress = Array.isArray(phr) ? (phr[0] || '') : String(phr || '');

  return {
    success: true,
    message: data.message || 'ABHA created successfully.',
    txnId: data.txnId || '',
    abhaNumber: profile.ABHANumber || profile.abhaNumber || data.healthIdNumber || '',
    abhaAddress,
    fullName,
    firstName,
    middleName,
    lastName,
    gender: profile.gender || '',
    dob: profile.dob || profile.dateOfBirth || '',
    mobile: profile.mobile || '',
    email: profile.email ?? null,
    address: profile.address || profile.addressLine1 || '',
    district: profile.district || '',
    state: profile.state || '',
    pinCode: profile.pinCode || profile.pincode || '',
    abhaStatus: profile.abhaStatus || '',
    isNew: data.isNew,
    tokens: data.tokens || null,
    ABHAProfile: profile,
    raw: data,
  };
}

function mapAbhaLoginProfileResponse(data = {}) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const primaryAccount = accounts[0] || {};
  const profile = data.ABHAProfile || data.profile || data.account || data || {};
  const firstName = profile.firstName || '';
  const middleName = profile.middleName || '';
  const lastName = profile.lastName || '';
  const fullName =
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim() ||
    primaryAccount.name ||
    profile.name ||
    profile.fullName ||
    data.name ||
    '';
  const phr =
    profile.phrAddress ||
    profile.abhaAddress ||
    profile.preferredAbhaAddress ||
    primaryAccount.preferredAbhaAddress ||
    data.preferredAbhaAddress;
  const abhaAddress = Array.isArray(phr) ? (phr[0] || '') : String(phr || '');
  const abhaNumber =
    profile.ABHANumber ||
    profile.abhaNumber ||
    primaryAccount.ABHANumber ||
    primaryAccount.abhaNumber ||
    data.ABHANumber ||
    data.abhaNumber ||
    data.healthIdNumber ||
    '';

  const dob =
    profile.dob ||
    profile.dateOfBirth ||
    primaryAccount.dob ||
    buildDobFromParts(profile) ||
    buildDobFromParts(data) ||
    '';

  const mobileRaw = profile.mobile || primaryAccount.mobile || data.mobile || '';
  const mobile = normalizeMobile(mobileRaw) || (String(mobileRaw).includes('*') ? '' : String(mobileRaw || '').replace(/\D/g, '').slice(0, 10));

  const addressParts = [
    profile.address || profile.addressLine1 || primaryAccount.address || data.address || '',
    profile.districtName || profile.district || '',
    profile.stateName || profile.state || '',
    profile.pinCode || profile.pincode || '',
  ].filter(Boolean);

  return {
    success: true,
    message: data.message || 'ABHA verified successfully.',
    txnId: data.txnId || '',
    abhaNumber,
    healthIdNumber: abhaNumber || data.healthIdNumber || '',
    abhaAddress,
    fullName,
    firstName,
    middleName,
    lastName,
    gender: profile.gender || primaryAccount.gender || data.gender || '',
    dob,
    mobile,
    email: profile.email ?? data.email ?? null,
    address: addressParts.join(', ') || profile.address || profile.addressLine1 || '',
    abhaStatus: profile.abhaStatus || primaryAccount.status || data.abhaStatus || data.status || '',
    phrAddress: Array.isArray(profile.phrAddress)
      ? profile.phrAddress
      : Array.isArray(data.phrAddress)
        ? data.phrAddress
        : abhaAddress
          ? [abhaAddress]
          : [],
    accounts,
    tokens: data.tokens || null,
    ABHAProfile: profile.ABHANumber || profile.firstName ? profile : primaryAccount,
    raw: data,
  };
}

function buildDobFromParts(source = {}) {
  const y = String(source.yearOfBirth || source.year || '').trim();
  const m = String(source.monthOfBirth || source.month || '').trim().padStart(2, '0');
  const d = String(source.dayOfBirth || source.day || '').trim().padStart(2, '0');
  if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m) && /^\d{2}$/.test(d) && m !== '00' && d !== '00') {
    return `${d}-${m}-${y}`;
  }
  if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m) && m !== '00') {
    return `01-${m}-${y}`;
  }
  return '';
}

function extractUserToken(data = {}) {
  return (
    data?.tokens?.token ||
    data?.token ||
    data?.tokens?.accessToken ||
    data?.accessToken ||
    data?.xToken ||
    data?.tokens?.xToken ||
    ''
  );
}

/**
 * Fetch full ABHA demographics after login using:
 * GET /v3/profile/account with X-token: Bearer <userToken>
 */
async function fetchExistingAbhaAccountProfile({ accessToken, userToken } = {}) {
  const token = String(userToken || '').trim();
  if (!token) return null;

  const xToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const headers = buildAbdmHeaders({
    accessToken,
    additionalHeaders: {
      'X-token': xToken,
      'X-TOKEN': xToken,
    },
  });
  const abhaClient = createAbhaClient();
  const requestUrl = `${getAbhaApiBase()}${PROFILE_ACCOUNT_PATH}`;
  console.log('[abdm] ✓ Existing ABHA profile fetch:', requestUrl);
  const response = await abhaClient.get(PROFILE_ACCOUNT_PATH, { headers });
  console.log('[abdm] ✓ Existing ABHA profile status:', response.status);
  console.log('[abdm] ✓ Existing ABHA profile response keys:', Object.keys(response.data || {}));
  return response.data || null;
}

/**
 * Select ABHA account when login verify returns accounts list:
 * POST /v3/profile/login/verify/user
 */
async function verifyExistingAbhaUser({ accessToken, txnId, abhaNumber } = {}) {
  const payload = {
    txnId,
    scope: ['abha-login'],
    ABHANumber: abhaNumber,
  };
  const headers = buildAbdmHeaders({
    accessToken,
    additionalHeaders: { 'T-TOKEN': txnId },
  });
  const abhaClient = createAbhaClient();
  console.log('[abdm] ✓ Existing ABHA verify/user:', `${getAbhaApiBase()}${LOGIN_VERIFY_USER_PATH}`);
  const response = await abhaClient.post(LOGIN_VERIFY_USER_PATH, payload, { headers });
  console.log('[abdm] ✓ Existing ABHA verify/user status:', response.status);
  return response.data || null;
}

/**
 * Request Aadhaar OTP from ABDM Sandbox enrollment API.
 * Encrypts Aadhaar with government public key, then POSTs to official endpoint.
 * Optional mobile is stored against txnId for later enrol/byAadhaar (not sent to OTP API).
 */
async function requestAadhaarOtp(aadhaar, options = {}) {
  if (!abdmConfig.clientId || !abdmConfig.clientSecret) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'ABDM_CLIENT_ID and ABDM_CLIENT_SECRET must be configured in environment variables.',
      },
    };
  }

  let plainAadhaar;
  try {
    plainAadhaar = validateAadhaar(aadhaar);
  } catch (err) {
    return { status: err.status || 400, body: { success: false, message: err.message } };
  }

  const storedMobile = normalizeMobile(options.mobile);

  try {
    console.log('[abdm] ✓ Aadhaar OTP Request started');
    console.log('[abdm] ✓ Ensuring session access token');
    const accessToken = await ensureAccessToken();

    console.log('[abdm] ✓ Encrypting Aadhaar with government public key');
    const encryptedAadhaar = await encryptAadhaar(plainAadhaar);
    console.log('[abdm] ✓ Aadhaar encrypted, length:', encryptedAadhaar.length);

    const abhaClient = createAbhaClient();
    const headers = buildAbdmHeaders({ accessToken });
    const requestUrl = `${getAbhaApiBase()}${REQUEST_OTP_PATH}`;
    const payload = {
      txnId: options.txnId || '',
      scope: ['abha-enrol'],
      loginHint: 'aadhaar',
      loginId: encryptedAadhaar,
      otpSystem: 'aadhaar',
    };

    console.log('[abdm] ✓ Aadhaar OTP API Request:', requestUrl);
    console.log('[abdm] ✓ Aadhaar OTP Request Body:', {
      txnId: payload.txnId,
      scope: payload.scope,
      loginHint: payload.loginHint,
      loginId: `[encrypted length=${encryptedAadhaar.length}]`,
      otpSystem: payload.otpSystem,
    });

    const response = await abhaClient.post(REQUEST_OTP_PATH, payload, { headers });
    console.log('[abdm] ✓ Aadhaar OTP API Response Status:', response.status);
    console.log('[abdm] ✓ Aadhaar OTP Government Response:', response.data);

    const govTxnId = response.data?.txnId || response.data?.transactionId || '';
    if (govTxnId) {
      saveEnrollmentTxnContext(govTxnId, {
        aadhaar: plainAadhaar,
        mobile: storedMobile || undefined,
        otpRequestedAt: new Date().toISOString(),
      });
      console.log('[abdm] ✓ Enrolment txn context saved:', {
        txnId: govTxnId,
        mobilePresent: Boolean(storedMobile),
        mobile: storedMobile ? maskMobile(storedMobile) : null,
      });
    }

    return {
      status: response.status,
      body: response.data,
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const body = err.response?.data || {
      success: false,
      message: err.message || 'ABDM Aadhaar OTP request failed.',
      details: err.details || undefined,
    };
    console.log('[abdm] Aadhaar OTP API Error Status:', status);
    console.log('[abdm] Aadhaar OTP API Error Response:', body);
    return { status, body };
  }
}

/**
 * Verify Aadhaar OTP and enrol/create ABHA via official Sandbox API.
 *
 * Official ABDM Sandbox / wrapper implementations for Enroll by Aadhaar:
 * {
 *   "authData": {
 *     "authMethods": ["otp"],
 *     "otp": {
 *       "txnId": "<transactionId>",
 *       "otpValue": "<RSA encrypted OTP>",
 *       "mobile": "<10 digit mobile>"
 *     }
 *   },
 *   "consent": { "code": "abha-enrollment", "version": "1.4" }
 * }
 *
 * Required header (Postman): T-TOKEN: <transactionId>
 *
 * Official swagger also documents authData.otp.timeStamp — included per production integrators.
 * Mobile must be provided as 10-digit number in otp object for this flow.
 */
async function verifyAadhaarOtp({ txnId, otp, mobile } = {}) {
  if (!abdmConfig.clientId || !abdmConfig.clientSecret) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'ABDM_CLIENT_ID and ABDM_CLIENT_SECRET must be configured in environment variables.',
      },
    };
  }

  let plainTxnId;
  let plainOtp;
  try {
    plainTxnId = validateTxnId(txnId);
    plainOtp = validateOtp(otp);
  } catch (err) {
    return { status: err.status || 400, body: { success: false, message: err.message } };
  }

  const txnContext = getEnrollmentTxnContext(plainTxnId);
  const plainMobile =
    normalizeMobile(mobile) ||
    normalizeMobile(txnContext?.mobile) ||
    '';

  console.log('[abdm] ✓ OTP verify inputs:', {
    txnId: plainTxnId,
    otpReceived: maskOtp(plainOtp),
    mobileFromRequest: Boolean(normalizeMobile(mobile)),
    mobileFromTxnContext: Boolean(normalizeMobile(txnContext?.mobile)),
    mobilePresent: Boolean(plainMobile),
    mobileMasked: plainMobile ? maskMobile(plainMobile) : null,
  });

  if (!plainMobile) {
    return {
      status: 400,
      body: {
        success: false,
        message:
          'A valid 10-digit mobile number is required for ABHA enrolment (authData.otp.mobile).',
      },
    };
  }

  saveEnrollmentTxnContext(plainTxnId, {
    mobile: plainMobile,
    aadhaar: txnContext?.aadhaar,
  });

  try {
    console.log('[abdm] ✓ Aadhaar OTP Verify / ABHA Enrol started');
    const accessToken = await ensureAccessToken();
    const publicKey = await getGovernmentPublicKey();

    const encryptedOtp = await encryptOtp(plainOtp, publicKey);
    const timeStamp = new Date().toISOString();

    // OTP must be RSA encrypted; mobile must be sent as 10-digit number.
    const payload = {
      txnId: plainTxnId,
      scope: ['abha-enrol'],
      authData: {
        authMethods: ['otp'],
        otp: {
          timeStamp,
          txnId: plainTxnId,
          otpValue: encryptedOtp,
          mobile: plainMobile,
        },
      },
      consent: {
        code: 'abha-enrollment',
        version: '1.4',
      },
    };

    const abhaClient = createAbhaClient();
    const headers = buildAbdmHeaders({ accessToken });
    const requestUrl = `${getAbhaApiBase()}${ENROL_BY_AADHAAR_PATH}`;

    const maskedBody = {
      ...payload,
      authData: {
        ...payload.authData,
        otp: {
          ...payload.authData.otp,
          otpValue: `[encrypted length=${encryptedOtp.length}]`,
          mobile: maskMobile(plainMobile),
        },
      },
    };

    console.log('[abdm] ✓ Enrol by Aadhaar API Request:', requestUrl);
    console.log('[abdm] ✓ Pre-government checks:', {
      txnId: plainTxnId,
      otpReceived: maskOtp(plainOtp),
      mobilePresent: true,
      mobileMasked: maskMobile(plainMobile),
      encryptedOtpLength: encryptedOtp.length,
    });
    console.log('[abdm] ✓ Enrol by Aadhaar FINAL request body (masked):');
    console.log(JSON.stringify(maskedBody, null, 2));
    console.log('[abdm] ✓ Enrol by Aadhaar request headers:', {
      'REQUEST-ID': headers['REQUEST-ID'],
      TIMESTAMP: headers.TIMESTAMP,
      'X-CM-ID': headers['X-CM-ID'],
      Authorization: headers.Authorization ? 'Bearer ***' : undefined,
      'Content-Type': headers['Content-Type'],
    });

    const response = await abhaClient.post(ENROL_BY_AADHAAR_PATH, payload, { headers });
    console.log('[abdm] ✓ Enrol by Aadhaar Status Code:', response.status);
    console.log('[abdm] ✓ Enrol by Aadhaar Complete Response Body:');
    console.log(JSON.stringify(response.data, null, 2));

    const mapped = mapAbhaEnrolmentResponse(response.data || {});
    if (!mapped.abhaNumber && !mapped.abhaAddress) {
      return {
        status: response.status,
        body: {
          success: false,
          message: 'ABDM did not return ABHA profile details.',
          raw: response.data,
        },
      };
    }

    console.log('[abdm] ✓ ABHA created/retrieved:', {
      abhaNumber: mapped.abhaNumber,
      abhaAddress: mapped.abhaAddress,
      fullName: mapped.fullName,
    });

    return {
      status: response.status,
      body: mapped,
    };
  } catch (err) {
    const status = err.response?.status || (err.details ? 502 : 500);
    const body = err.response?.data || {
      success: false,
      message: err.message || 'ABDM Aadhaar OTP verification / ABHA enrolment failed.',
      details: err.details || undefined,
    };
    console.log('[abdm] Enrol by Aadhaar Status Code:', status);
    console.log('[abdm] Enrol by Aadhaar Complete Response Body:');
    console.log(JSON.stringify(body, null, 2));
    return { status, body };
  }
}

/**
 * Request OTP for existing ABHA login using official API:
 * POST /v3/profile/login/request/otp
 * Body: { scope: ["abha-login", "mobile-verify"], loginHint, loginId, otpSystem: "abdm" }
 */
async function requestExistingAbhaOtp({ loginHint, loginId } = {}) {
  if (!abdmConfig.clientId || !abdmConfig.clientSecret) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'ABDM_CLIENT_ID and ABDM_CLIENT_SECRET must be configured in environment variables.',
      },
    };
  }

  let hint;
  let plainLoginId;
  try {
    hint = validateLoginHint(loginHint);
    plainLoginId = String(loginId || '').trim();
    if (!plainLoginId) {
      const err = new Error('loginId is required.');
      err.status = 400;
      throw err;
    }
  } catch (err) {
    return { status: err.status || 400, body: { success: false, message: err.message } };
  }

  try {
    const accessToken = await ensureAccessToken();
    const publicKey = await getGovernmentPublicKey();
    const encryptedLoginId = encryptWithPublicKey(plainLoginId, publicKey);

    const officialExpectedScope = ['abha-login', 'mobile-verify'];
    const payload = {
      scope: officialExpectedScope,
      loginHint: hint,
      loginId: encryptedLoginId,
      otpSystem: 'abdm',
    };

    const headers = buildAbdmHeaders({ accessToken });
    const requestUrl = `${getAbhaApiBase()}${LOGIN_REQUEST_OTP_PATH}`;
    const abhaClient = createAbhaClient();

    console.log('[abdm] ✓ Existing ABHA login OTP request:', requestUrl);
    console.log('[abdm] Existing ABHA login OTP scope check:', {
      endpointUsed: LOGIN_REQUEST_OTP_PATH,
      scopeSent: payload.scope,
      officialExpectedScope,
      fixed: 'Restored official login scope pair for ABHA login OTP.',
    });
    console.log('[abdm] ✓ Existing ABHA login OTP body (masked):', {
      scope: payload.scope,
      loginHint: payload.loginHint,
      loginId: `[encrypted length=${encryptedLoginId.length}]`,
      otpSystem: payload.otpSystem,
    });

    const response = await abhaClient.post(LOGIN_REQUEST_OTP_PATH, payload, { headers });
    console.log('[abdm] ✓ Existing ABHA login OTP status:', response.status);
    console.log('[abdm] ✓ Existing ABHA login OTP response:', response.data);

    const govTxnId = response.data?.txnId || response.data?.transactionId || '';
    if (govTxnId) {
      saveEnrollmentTxnContext(govTxnId, {
        flow: 'existing-abha-login',
        loginHint: hint,
        loginId: plainLoginId,
        loginOtpRequestedAt: new Date().toISOString(),
      });
    }

    return { status: response.status, body: response.data };
  } catch (err) {
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message || 'ABDM existing ABHA login OTP request failed.' };
    console.log('[abdm] Existing ABHA login OTP error:', status, body);
    return { status, body };
  }
}

/**
 * Verify OTP for existing ABHA login using official API:
 * POST /v3/profile/login/verify
 * Body: {
 *   txnId,
 *   scope: ["abha-login", "mobile-verify"],
 *   authData: { authMethods: ["otp"], otp: { txnId, otpValue } }
 * }
 */
async function verifyExistingAbhaOtp({ txnId, otp } = {}) {
  if (!abdmConfig.clientId || !abdmConfig.clientSecret) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'ABDM_CLIENT_ID and ABDM_CLIENT_SECRET must be configured in environment variables.',
      },
    };
  }

  let plainTxnId;
  let plainOtp;
  try {
    plainTxnId = validateTxnId(txnId);
    plainOtp = validateOtp(otp);
  } catch (err) {
    return { status: err.status || 400, body: { success: false, message: err.message } };
  }

  try {
    const accessToken = await ensureAccessToken();
    const publicKey = await getGovernmentPublicKey();
    const encryptedOtp = await encryptOtp(plainOtp, publicKey);
    const timeStamp = new Date().toISOString();

    const officialExpectedScope = ['abha-login', 'mobile-verify'];
    const payload = {
      txnId: plainTxnId,
      scope: officialExpectedScope,
      authData: {
        authMethods: ['otp'],
        otp: {
          timeStamp,
          txnId: plainTxnId,
          otpValue: encryptedOtp,
        },
      },
    };

    const headers = buildAbdmHeaders({
      accessToken,
      additionalHeaders: { 'T-TOKEN': plainTxnId },
    });
    const requestUrl = `${getAbhaApiBase()}${LOGIN_VERIFY_PATH}`;
    const abhaClient = createAbhaClient();

    console.log('[abdm] ✓ Existing ABHA login verify request:', requestUrl);
    console.log('[abdm] Existing ABHA login verify scope check:', {
      endpointUsed: LOGIN_VERIFY_PATH,
      scopeSent: payload.scope,
      officialExpectedScope,
      fixed: 'Added explicit scope and top-level txnId in verify payload for existing ABHA login flow.',
    });
    console.log('[abdm] ✓ Existing ABHA login verify body (masked):', {
      txnId: payload.txnId,
      scope: payload.scope,
      authData: { authMethods: ['otp'], otp: { timeStamp, txnId: plainTxnId, otpValue: `[encrypted length=${encryptedOtp.length}]` } },
    });

    const response = await abhaClient.post(LOGIN_VERIFY_PATH, payload, { headers });
    console.log('[abdm] ✓ Existing ABHA login verify status:', response.status);
    console.log('[abdm] ✓ Existing ABHA login verify response:', response.data);

    let verifyData = response.data || {};
    let mapped = mapAbhaLoginProfileResponse(verifyData);
    if (!mapped.abhaNumber && !mapped.abhaAddress) {
      return {
        status: response.status,
        body: {
          success: false,
          message: 'ABDM did not return ABHA profile details after verify.',
          raw: response.data,
        },
      };
    }

    // Login verify often returns only account summary. Fetch full demographics via profile/account.
    try {
      let userToken = extractUserToken(verifyData);

      // If accounts were returned without usable X-token profile, select the ABHA first.
      if ((!userToken || (!mapped.mobile && !mapped.dob && !mapped.gender && !mapped.address)) && mapped.abhaNumber) {
        try {
          const userData = await verifyExistingAbhaUser({
            accessToken,
            txnId: plainTxnId,
            abhaNumber: mapped.abhaNumber,
          });
          if (userData) {
            verifyData = { ...verifyData, ...userData };
            userToken = extractUserToken(userData) || userToken;
            mapped = mapAbhaLoginProfileResponse({ ...mapped.raw, ...userData, accounts: verifyData.accounts || mapped.accounts });
          }
        } catch (userErr) {
          console.log('[abdm] Existing ABHA verify/user skipped/failed:', userErr.response?.status || userErr.message);
          console.log('[abdm] Existing ABHA verify/user body:', userErr.response?.data || null);
        }
      }

      if (userToken) {
        const accountProfile = await fetchExistingAbhaAccountProfile({ accessToken, userToken });
        if (accountProfile) {
          const mergedRaw = {
            ...verifyData,
            ...accountProfile,
            tokens: verifyData.tokens || accountProfile.tokens,
            accounts: verifyData.accounts,
            txnId: verifyData.txnId || plainTxnId,
          };
          mapped = mapAbhaLoginProfileResponse(mergedRaw);
          // Prefer account profile demographics when present.
          if (!mapped.fullName && accountProfile.name) mapped.fullName = accountProfile.name;
          mapped.raw = { verify: verifyData, account: accountProfile };
          console.log('[abdm] ✓ Existing ABHA full profile mapped:', {
            abhaNumber: mapped.abhaNumber,
            abhaAddress: mapped.abhaAddress,
            fullName: mapped.fullName,
            mobile: mapped.mobile ? maskMobile(mapped.mobile) : null,
            dob: mapped.dob || null,
            gender: mapped.gender || null,
            addressPresent: Boolean(mapped.address),
          });
        }
      } else {
        console.log('[abdm] Existing ABHA profile fetch skipped: no user token in verify response');
      }
    } catch (profileErr) {
      console.log('[abdm] Existing ABHA profile fetch failed:', profileErr.response?.status || profileErr.message);
      console.log('[abdm] Existing ABHA profile fetch body:', profileErr.response?.data || null);
      // Keep verify-mapped summary if full profile fetch fails.
    }

    return { status: response.status, body: mapped };
  } catch (err) {
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message || 'ABDM existing ABHA OTP verify failed.' };
    console.log('[abdm] Existing ABHA login verify error:', status, body);
    return { status, body };
  }
}

module.exports = {
  requestAadhaarOtp,
  verifyAadhaarOtp,
  requestExistingAbhaOtp,
  verifyExistingAbhaOtp,
  mapAbhaEnrolmentResponse,
  mapAbhaLoginProfileResponse,
  normalizeMobile,
  getEnrollmentTxnContext,
  saveEnrollmentTxnContext,
};
