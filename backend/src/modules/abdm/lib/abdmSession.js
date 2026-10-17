const { abdmConfig } = require('./abdmConfig');
const { buildAbdmHeaders } = require('./abdmHeaders');
const { writeAbdmAudit } = require('./abdmAudit');
const axios = require('axios');

let tokenStore = null;

const SESSIONS_PATH = '/gateway/v3/sessions';

function saveToken(token, expiresAt) {
  tokenStore = {
    accessToken: token,
    expiresAt,
    createdAt: new Date().toISOString(),
  };
}

function getToken() {
  return tokenStore;
}

function clearToken() {
  tokenStore = null;
}

function isTokenExpired() {
  if (!tokenStore || !tokenStore.expiresAt) return true;
  // Refresh 60s early to avoid edge expiry mid-request.
  return new Date(tokenStore.expiresAt).getTime() <= Date.now() + 60_000;
}

function extractAccessToken(data = {}) {
  return (
    data.accessToken ||
    data.access_token ||
    data.token ||
    data.authToken ||
    data.jwtToken ||
    data?.response?.accessToken ||
    data?.response?.access_token ||
    null
  );
}

function getGatewayBase() {
  return String(abdmConfig.gatewayBase || '').replace(/\/+$/, '');
}

/**
 * POST {ABDM_GATEWAY_BASE}/gateway/v3/sessions
 * Body: { clientId, clientSecret, grantType: "client_credentials" }
 */
async function createGatewaySession({ hospitalId = null } = {}) {
  if (!abdmConfig.clientId || !abdmConfig.clientSecret) {
    const err = new Error(
      'ABDM_CLIENT_ID and ABDM_CLIENT_SECRET must be configured in environment variables.'
    );
    err.status = 400;
    throw err;
  }

  const headers = buildAbdmHeaders();
  const requestId = headers['REQUEST-ID'];
  const url = `${getGatewayBase()}${SESSIONS_PATH}`;
  const started = Date.now();

  console.log('[ABDM][SESSION] Request started');
  console.log(
    JSON.stringify({
      apiName: 'SESSION',
      method: 'POST',
      url,
      requestId,
    })
  );

  try {
    const response = await axios.post(
      url,
      {
        clientId: abdmConfig.clientId,
        clientSecret: abdmConfig.clientSecret,
        grantType: 'client_credentials',
      },
      { headers, timeout: 30000 }
    );

    const durationMs = Date.now() - started;
    const data = response.data || {};
    const statusCode = response.status;

    console.log(`[ABDM][SESSION] Response: ${statusCode}`);
    console.log(
      JSON.stringify({
        apiName: 'SESSION',
        method: 'POST',
        url,
        requestId,
        statusCode,
        durationMs,
        hasAccessToken: Boolean(extractAccessToken(data)),
        errorCode: data?.error?.code || data?.code || null,
        errorMessage: data?.error?.message || (data?.error ? data.message : null),
      })
    );

    await writeAbdmAudit({
      hospitalId,
      direction: 'OUT',
      apiName: 'SESSION',
      requestId,
      statusCode,
      requestBody: { grantType: 'client_credentials', clientIdPresent: true },
      responseBody: {
        hasAccessToken: Boolean(extractAccessToken(data)),
        expiresIn: data.expiresIn || data.tokenValidityInMinutes || null,
      },
      error: data?.error ? JSON.stringify(data.error) : null,
    });

    if (data.error) {
      const err = new Error(data.error.message || 'ABDM Session API returned an error.');
      err.status = statusCode;
      err.response = { status: statusCode, data };
      throw err;
    }

    const accessToken = extractAccessToken(data);
    if (!accessToken) {
      const err = new Error('ABDM Session API did not return an access token.');
      err.status = statusCode;
      err.response = { status: statusCode, data };
      throw err;
    }

    const expiresInSec =
      data.expiresIn ||
      (data.tokenValidityInMinutes ? data.tokenValidityInMinutes * 60 : null) ||
      1800;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
    saveToken(accessToken, expiresAt);

    return {
      status: 200,
      body: {
        success: true,
        expiresAt,
        // Token returned only for local session helper consumers — routes must not log it.
        accessToken,
      },
    };
  } catch (err) {
    if (err.response?.status && err.response?.data && !err.message?.includes('must be configured')) {
      const statusCode = err.response.status;
      const data = err.response.data;
      const durationMs = Date.now() - started;
      console.log(`[ABDM][SESSION] Response: ${statusCode}`);
      console.log(
        JSON.stringify({
          apiName: 'SESSION',
          method: 'POST',
          url,
          requestId,
          statusCode,
          durationMs,
          errorCode: data?.code || data?.error?.code || null,
          errorMessage: data?.message || data?.error?.message || err.message,
        })
      );
      await writeAbdmAudit({
        hospitalId,
        direction: 'OUT',
        apiName: 'SESSION',
        requestId,
        statusCode,
        requestBody: { grantType: 'client_credentials', clientIdPresent: true },
        responseBody: { code: data?.code || null, message: data?.message || null },
        error: data?.message || data?.description || err.message,
      });
    } else if (!err.response) {
      console.log('[ABDM][SESSION] Response: error');
      console.log(
        JSON.stringify({
          apiName: 'SESSION',
          method: 'POST',
          url,
          requestId,
          statusCode: err.status || 500,
          durationMs: Date.now() - started,
          errorMessage: err.message,
        })
      );
      await writeAbdmAudit({
        hospitalId,
        direction: 'OUT',
        apiName: 'SESSION',
        requestId,
        statusCode: err.status || 500,
        requestBody: { grantType: 'client_credentials', clientIdPresent: true },
        responseBody: null,
        error: err.message,
      });
    }
    throw err;
  }
}

async function ensureAccessToken(options = {}) {
  const stored = getToken();
  if (stored?.accessToken && !isTokenExpired()) {
    console.log('[ABDM][SESSION] Using cached token');
    return stored.accessToken;
  }
  const result = await createGatewaySession(options);
  return result.body.accessToken;
}

module.exports = {
  saveToken,
  getToken,
  clearToken,
  isTokenExpired,
  createGatewaySession,
  ensureAccessToken,
  extractAccessToken,
  SESSIONS_PATH,
};
