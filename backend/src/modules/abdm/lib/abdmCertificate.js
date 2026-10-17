const axios = require('axios');
const { abdmConfig } = require('./abdmConfig');
const { buildAbdmHeaders } = require('./abdmHeaders');
const { ensureAccessToken } = require('./abdmSession');

const CERTIFICATE_PATH = '/v3/profile/public/certificate';

function getAbhaApiBase() {
  const base = String(abdmConfig.abhaBase || '').replace(/\/+$/, '');
  if (base.endsWith('/abha/api')) return base;
  return `${base}/abha/api`;
}

function parseCertificateResponse(data = {}) {
  const publicKey =
    data.publicKey ||
    data.public_key ||
    data.certificate ||
    data.cert ||
    data?.keys?.[0]?.key ||
    null;

  const keyId =
    data.keyId ||
    data.key_id ||
    data.kid ||
    data?.keys?.[0]?.kid ||
    null;

  const expiresAt =
    data.expiry ||
    data.expiresAt ||
    data.expires_at ||
    data.validUntil ||
    data.valid_until ||
    null;

  return {
    publicKey,
    keyId,
    expiresAt,
    raw: data,
  };
}

async function fetchCertificate() {
  if (!abdmConfig.clientId || !abdmConfig.clientSecret) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'ABDM_CLIENT_ID and ABDM_CLIENT_SECRET must be configured in environment variables.',
      },
    };
  }

  try {
    const accessToken = await ensureAccessToken();
    const abhaClient = axios.create({
      baseURL: getAbhaApiBase(),
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const headers = buildAbdmHeaders({ accessToken });
    const requestUrl = `${getAbhaApiBase()}${CERTIFICATE_PATH}`;
    console.log('[ABDM][CERTIFICATE] Request started');
    console.log(
      JSON.stringify({
        apiName: 'CERTIFICATE',
        method: 'GET',
        url: requestUrl,
        requestId: headers['REQUEST-ID'],
      })
    );

    const response = await abhaClient.get(CERTIFICATE_PATH, { headers });
    console.log(`[ABDM][CERTIFICATE] Response: ${response.status}`);

    const parsed = parseCertificateResponse(response.data);

    if (!parsed.publicKey) {
      return { status: response.status, body: parsed.raw };
    }

    return {
      status: 200,
      body: {
        success: true,
        publicKey: parsed.publicKey,
        keyId: parsed.keyId,
        expiresAt: parsed.expiresAt,
        raw: parsed.raw,
      },
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message || 'ABDM Certificate API request failed.' };
    console.log(`[ABDM][CERTIFICATE] Response: ${status}`);
    return { status, body };
  }
}

module.exports = {
  fetchCertificate,
  ensureAccessToken,
  getAbhaApiBase,
};
