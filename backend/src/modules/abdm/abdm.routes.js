const express = require('express');
const { client } = require('./lib/abdmClient');
const { abdmConfig } = require('./lib/abdmConfig');
const {
  createGatewaySession,
  getToken,
  isTokenExpired,
  saveToken,
} = require('./lib/abdmSession');
const { fetchCertificate } = require('./lib/abdmCertificate');
const { encryptAadhaar } = require('./lib/abdmCrypto');
const {
  requestAadhaarOtp,
  verifyAadhaarOtp,
  requestExistingAbhaOtp,
  verifyExistingAbhaOtp,
} = require('./lib/abdmEnrollment');
const {
  linkHipPatient,
  retryContextNotify,
  handleOnGenerateTokenCallback,
  getHipPatientStatus,
} = require('./lib/abdmHipLinking');
const {
  emitAbdmClinicalEvent,
  retryAbdmHealthDocument,
  getAbdmHealthDocument,
  listAbdmPatientHealthRecords,
} = require('./lib/abdmHealthRecord');
const {
  updateBridgeUrl,
  updateFacilityBridgeUrl,
  registerHospitalHrp,
  getBridgeServices,
  getBridgeServiceById,
  getGatewayCerts,
  getOpenIdConfiguration,
} = require('./lib/abdmBridge');
const {
  handleConsentHiuOnInitCallback,
  handleConsentHiuNotifyCallback,
  handleConsentHiuOnStatusCallback,
  handleConsentHiuOnFetchCallback,
  listHiuConsentsApi,
  getHiuConsentApi,
  listHiuConsentPatientsApi,
  initiateHiuConsentRequestApi,
} = require('./callbacks/consentHiu.controller');
const {
  createHiuHealthInformationRequest,
  handleHiuOnRequestCallback,
  handleHiuOnDataCallback,
  listHiuHealthRecords,
  getLatestHiuHiTransaction,
} = require('./callbacks/dataPushHiu.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');

const router = express.Router();
const adminOnly = [authMiddleware, roleMiddleware(['SUPER_ADMIN'])];

router.get('/health', (req, res) => {
  res.json({
    success: true,
    module: 'ABDM',
    status: 'healthy',
    message: 'ABDM module is running',
    env: abdmConfig.env,
    gatewayBase: abdmConfig.gatewayBase,
    hspBase: abdmConfig.hspBase,
  });
});

router.get('/client-test', (req, res) => {
  res.json({
    success: true,
    baseURL: client.defaults.baseURL,
    timeout: client.defaults.timeout,
    headers: client.defaults.headers,
  });
});

router.get('/session-test', (req, res) => {
  saveToken('TEST_TOKEN_123', new Date(Date.now() + 60 * 60 * 1000).toISOString());
  const stored = getToken();
  res.json({
    hasToken: Boolean(stored?.accessToken),
    expiresAt: stored?.expiresAt || null,
    expired: isTokenExpired(),
  });
});

async function createSession() {
  try {
    const result = await createGatewaySession();
    return {
      status: result.status,
      body: {
        success: true,
        expiresAt: result.body.expiresAt,
        // Never expose accessToken on API responses in production paths;
        // keep boolean for local verification only.
        tokenStored: Boolean(result.body.accessToken),
      },
    };
  } catch (err) {
    const status = err.status || err.response?.status || 500;
    const body = err.response?.data || {
      success: false,
      message: err.message || 'ABDM Session API request failed.',
    };
    return { status, body };
  }
}

router.post('/sessions', async (req, res) => {
  const result = await createSession();
  return res.status(result.status).json(result.body);
});

router.get('/session-api-test', async (req, res) => {
  const result = await createSession();
  return res.status(result.status).json(result.body);
});

router.get('/certificate-test', async (req, res) => {
  const result = await fetchCertificate();
  if (result.body?.success) {
    return res.status(result.status).json({
      success: true,
      publicKey: result.body.publicKey,
      keyId: result.body.keyId,
      expiresAt: result.body.expiresAt,
    });
  }
  return res.status(result.status).json(result.body);
});

router.get('/encryption-test', async (req, res) => {
  try {
    const sampleAadhaar = String(req.query.aadhaar || '999999999999').replace(/\D/g, '');
    const encrypted = await encryptAadhaar(sampleAadhaar);

    return res.json({
      success: true,
      algorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding',
      originalLength: sampleAadhaar.length,
      encryptedLength: String(encrypted || '').length,
    });
  } catch (err) {
    const status = err.details ? 502 : 400;
    return res.status(status).json({
      success: false,
      message: err.message || 'ABDM encryption test failed.',
      details: err.details || undefined,
    });
  }
});

router.post('/request-aadhaar-otp', async (req, res) => {
  const aadhaar = req.body?.aadhaar ?? req.body?.aadhaarNumber ?? req.body?.aadhaarId;
  const mobile = req.body?.mobile ?? req.body?.phone;

  if (!aadhaar) {
    return res.status(400).json({
      success: false,
      message: 'aadhaar is required in the request body.',
    });
  }

  const result = await requestAadhaarOtp(aadhaar, {
    txnId: req.body?.txnId || '',
    mobile,
  });

  return res.status(result.status).json(result.body);
});

router.post('/verify-aadhaar-otp', async (req, res) => {
  const txnId = req.body?.txnId ?? req.body?.transactionId;
  const otp = req.body?.otp ?? req.body?.otpValue;
  const mobile = req.body?.mobile ?? req.body?.phone;

  if (!txnId || !otp) {
    return res.status(400).json({
      success: false,
      message: 'txnId and otp are required in the request body.',
    });
  }

  const result = await verifyAadhaarOtp({ txnId, otp, mobile });
  return res.status(result.status).json(result.body);
});

router.post('/request-existing-abha-otp', async (req, res) => {
  const loginHint = req.body?.loginHint;
  const loginId = req.body?.loginId;

  if (!loginHint || !loginId) {
    return res.status(400).json({
      success: false,
      message: 'loginHint and loginId are required in the request body.',
    });
  }

  const result = await requestExistingAbhaOtp({ loginHint, loginId });
  return res.status(result.status).json(result.body);
});

router.post('/verify-existing-abha-otp', async (req, res) => {
  const txnId = req.body?.txnId ?? req.body?.transactionId;
  const otp = req.body?.otp ?? req.body?.otpValue;

  if (!txnId || !otp) {
    return res.status(400).json({
      success: false,
      message: 'txnId and otp are required in the request body.',
    });
  }

  const result = await verifyExistingAbhaOtp({ txnId, otp });
  return res.status(result.status).json(result.body);
});

router.post('/health-record/retry', async (req, res) => {
  const type = req.body?.type;
  const sourceId = req.body?.sourceId;
  const patientId = req.body?.patientId;
  if (!type || !sourceId || !patientId) {
    return res.status(400).json({ success: false, message: 'type, sourceId, and patientId are required.' });
  }
  const result = await emitAbdmClinicalEvent({ type, sourceId, patientId });
  return res.status(200).json({ success: !result?.error, ...result });
});

router.get('/health-records', async (req, res) => {
  if (req.query.patientId) {
    const result = await listAbdmPatientHealthRecords(req.query.patientId);
    return res.status(result.status).json(result.body);
  }
  const result = await getAbdmHealthDocument({
    sourceType: req.query.sourceType,
    sourceId: req.query.sourceId,
  });
  return res.status(result.status).json(result.body);
});

router.get('/health-records/:documentId', async (req, res) => {
  const result = await getAbdmHealthDocument({ documentId: req.params.documentId });
  return res.status(result.status).json(result.body);
});

router.post('/health-records/:documentId/retry', async (req, res) => {
  const result = await retryAbdmHealthDocument({ documentId: req.params.documentId });
  return res.status(result.status).json(result.body);
});

router.post('/hip/patient/context-notify', async (req, res) => {
  const patientId = req.body?.patientId || req.body?.id;
  if (!patientId) {
    return res.status(400).json({ success: false, message: 'patientId is required.' });
  }
  const result = await retryContextNotify({ patientId });
  return res.status(result.status).json(result.body);
});

router.post('/hip/patient/link', async (req, res) => {
  const patientId = req.body?.patientId || req.body?.id;
  const force = Boolean(req.body?.force);
  const linkToken = req.body?.linkToken || req.body?.accessToken || '';

  if (!patientId) {
    return res.status(400).json({ success: false, message: 'patientId is required.' });
  }

  const result = await linkHipPatient({ patientId, force, linkToken: linkToken || undefined });
  return res.status(result.status).json(result.body);
});

router.get('/hip/patient/status/:patientId', async (req, res) => {
  const result = await getHipPatientStatus(req.params.patientId);
  return res.status(result.status).json(result.body);
});

router.post('/hip/token/on-generate-token', async (req, res) => {
  const result = await handleOnGenerateTokenCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

router.post('/v3/hip/token/on-generate-token', async (req, res) => {
  const result = await handleOnGenerateTokenCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

router.post('/v3/hiu/consent/request/on-init', async (req, res) => {
  const result = await handleConsentHiuOnInitCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

router.post('/v3/hiu/consent/request/notify', async (req, res) => {
  const result = await handleConsentHiuNotifyCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

router.post('/v3/hiu/consent/request/on-status', async (req, res) => {
  const result = await handleConsentHiuOnStatusCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

router.post('/v3/hiu/consent/on-fetch', async (req, res) => {
  const result = await handleConsentHiuOnFetchCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

router.get('/hiu/consents', authMiddleware, async (req, res) => {
  const result = await listHiuConsentsApi();
  return res.status(result.status).json(result.body);
});

router.get('/hiu/consent-patients', ...adminOnly, async (req, res) => {
  const result = await listHiuConsentPatientsApi(req.query || {});
  return res.status(result.status).json(result.body);
});

router.post('/hiu/consents/init', ...adminOnly, async (req, res) => {
  const result = await initiateHiuConsentRequestApi(req.body || {});
  return res.status(result.status).json(result.body);
});

router.get('/hiu/consents/:consentRequestId', authMiddleware, async (req, res) => {
  const result = await getHiuConsentApi(req.params.consentRequestId);
  return res.status(result.status).json(result.body);
});

router.post('/hiu/health-information/request', authMiddleware, async (req, res) => {
  const result = await createHiuHealthInformationRequest(req.body || {});
  return res.status(result.status).json(result.body);
});

router.get('/hiu/health-information/status', authMiddleware, async (req, res) => {
  const result = await getLatestHiuHiTransaction({ consentId: req.query.consentId });
  return res.status(result.status).json(result.body);
});

router.get('/hiu/health-information/records', authMiddleware, async (req, res) => {
  const result = await listHiuHealthRecords({ consentId: req.query.consentId });
  return res.status(result.status).json(result.body);
});

router.post('/v3/hiu/health-information/on-request', async (req, res) => {
  const result = await handleHiuOnRequestCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

router.post('/v3/hiu/health-information/on-data', async (req, res) => {
  const result = await handleHiuOnDataCallback(req.body || {});
  return res.status(result.status).json(result.body);
});

/**
 * Bridge URL update — M2 Registration/Auth.
 * Local: POST|PATCH /api/abdm/bridge/url
 * Government: PATCH {ABDM_GATEWAY_BASE}/gateway/v3/bridge/url
 *
 * Important: hit THIS local URL from Postman (not dev.abdm.gov.in directly),
 * otherwise backend terminal will show nothing.
 */
async function handleUpdateBridgeUrl(req, res) {
  const incomingUrl = String(req.body?.url || req.body?.bridgeUrl || '').trim();
  console.log(`[ABDM][BRIDGE_URL] Local route hit: ${req.method} /api/abdm/bridge/url`);
  console.log(`[ABDM][BRIDGE_URL] Body url present: ${Boolean(incomingUrl)}`);

  const result = await updateBridgeUrl({
    bridgeUrl: incomingUrl || abdmConfig.bridgeCallbackUrl,
  });

  // ABDM often returns 202 with an empty body — always return meaningful VyanX JSON.
  if (result.status === 200 || result.status === 202) {
    console.log(`[ABDM][BRIDGE_URL] Bridge URL updated successfully (abdmStatus=${result.status})`);
    return res.status(200).json({
      success: true,
      message:
        result.status === 202
          ? 'ABDM Bridge URL update request accepted successfully'
          : 'ABDM Bridge URL registered successfully',
      data: {
        bridgeUrl: result.bridgeUrl,
        abdmStatus: result.status,
      },
    });
  }

  console.log(`[ABDM][BRIDGE_URL] Failed with status ${result.status}`);
  return res.status(result.status).json(
    result.body?.success === false
      ? result.body
      : {
          success: false,
          message: 'Failed to update ABDM Bridge URL',
          error: {
            status: result.status,
            description: result.body?.message || 'Unknown ABDM error',
          },
        }
  );
}

router.post('/bridge/url', handleUpdateBridgeUrl);
router.patch('/bridge/url', handleUpdateBridgeUrl);

router.get('/bridge/services', async (req, res) => {
  const result = await getBridgeServices();
  return res.status(result.status).json(result.body);
});

router.get('/bridge-services', async (req, res) => {
  const result = await getBridgeServices();
  return res.status(result.status).json(result.body);
});

router.get('/bridge-service/serviceId/:id', async (req, res) => {
  const result = await getBridgeServiceById(req.params.id);
  return res.status(result.status).json(result.body);
});

router.get('/certs', async (req, res) => {
  const result = await getGatewayCerts();
  return res.status(result.status).json(result.body);
});

router.get('/.well-known/openid-configuration', async (req, res) => {
  const result = await getOpenIdConfiguration();
  return res.status(result.status).json(result.body);
});

/**
 * Admin: PUT /api/abdm/facility/:hospitalId/bridge-url
 * Postman -> VyanX -> Session (if needed) -> PATCH /gateway/v3/bridge/url -> clean JSON.
 */
router.put('/facility/:hospitalId/bridge-url', ...adminOnly, async (req, res) => {
  const hospitalId = String(req.params.hospitalId || '').trim();
  const url = String(req.body?.url || req.body?.bridgeUrl || '').trim();

  console.log(`[ABDM][BRIDGE_URL] Local route hit: PUT /api/abdm/facility/${hospitalId || '<missing>'}/bridge-url`);
  console.log(`[ABDM][BRIDGE_URL] Body url present: ${Boolean(url)}`);

  if (!hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'hospitalId is required.',
    });
  }
  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'url is required in the request body and must be a public HTTPS Bridge callback URL.',
    });
  }

  const result = await updateFacilityBridgeUrl(hospitalId, {
    url,
    facilityId: req.body?.facilityId,
    facilityName: req.body?.facilityName,
    bridgeId: req.body?.bridgeId,
  });
  return res.status(result.status).json(result.body);
});

/**
 * Admin: POST /api/abdm/facility/:hospitalId/register-hrp
 * Calls HSP MutipleHRPAddUpdateServices ONLY when facilityId is configured/supplied.
 * Does not invent facilityId.
 */
router.post('/facility/:hospitalId/register-hrp', ...adminOnly, async (req, res) => {
  const hospitalId = req.params.hospitalId;
  const result = await registerHospitalHrp(hospitalId, {
    facilityId: req.body?.facilityId,
    facilityName: req.body?.facilityName,
    bridgeId: req.body?.bridgeId,
    hipName: req.body?.hipName,
    hipId: req.body?.hipId,
  });
  return res.status(result.status).json(result.body);
});

module.exports = router;
