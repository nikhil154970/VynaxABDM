const { abdmConfig } = require('./abdmConfig');
const { abdmRequest } = require('./abdmClient');
const { prisma } = require('../../../config/prisma');

const BRIDGE_URL_PATH = '/gateway/v3/bridge/url';
const BRIDGE_SERVICES_PATH = '/gateway/v3/bridge-services';
const BRIDGE_SERVICE_BY_ID_PATH = '/gateway/v3/bridge-service/serviceId';
const GATEWAY_CERTS_PATH = '/gateway/v3/certs';
const OPENID_CONFIG_PATH = '/gateway/v3/.well-known/openid-configuration';
const HRP_REGISTER_PATH = '/v4/int/v1/bridges/MutipleHRPAddUpdateServices';

function isLocalOrPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

/**
 * Bridge URL must be public HTTPS (ABDM gateway callback requirement).
 */
function requireHttpsBridgeUrl(bridgeUrl) {
  const url = String(bridgeUrl || '').trim();
  if (!url) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        message: 'url is required and must be a public HTTPS Bridge callback URL.',
      },
    };
  }
  if (!/^https:\/\//i.test(url)) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        message: 'Bridge URL must be HTTPS. HTTP and local URLs are not allowed.',
      },
    };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        message: 'Bridge URL is not a valid URL.',
      },
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        message: 'Bridge URL must use HTTPS.',
      },
    };
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        message: 'Bridge URL must be a public HTTPS host. Localhost and private network URLs are not allowed.',
      },
    };
  }

  return { ok: true, url };
}

function extractAbdmError(payload, fallbackStatus = 500, fallbackMessage = 'ABDM request failed.') {
  const data = payload && typeof payload === 'object' ? payload : {};
  return {
    status: fallbackStatus,
    code: data.code || data.error?.code || data.errorCode || null,
    message: data.message || data.error?.message || fallbackMessage,
    description: data.description || data.error?.description || data.details || null,
  };
}

/**
 * M2 Step-2: Update bridge callback URL.
 * Official (verified): PATCH {ABDM_GATEWAY_BASE}/gateway/v3/bridge/url
 * Body: { url: "<public HTTPS callback>" }
 */
async function updateBridgeUrl({ hospitalId = null, bridgeUrl } = {}) {
  const resolved = requireHttpsBridgeUrl(
    bridgeUrl != null && String(bridgeUrl).trim() !== ''
      ? bridgeUrl
      : abdmConfig.bridgeCallbackUrl
  );
  if (!resolved.ok) return { status: resolved.status, body: resolved.body };

  console.log('[ABDM][BRIDGE_URL] Request started');
  if (hospitalId) console.log(`[ABDM][BRIDGE_URL] Hospital: ${hospitalId}`);
  console.log(`[ABDM][BRIDGE_URL] Target URL: ${resolved.url}`);

  const payload = { url: resolved.url };

  try {
    const response = await abdmRequest({
      method: 'PATCH',
      base: 'gateway',
      path: BRIDGE_URL_PATH,
      data: payload,
      apiName: 'BRIDGE_URL',
      hospitalId,
      auditRequestBody: { url: resolved.url },
    });

    const govBody =
      response.data === undefined || response.data === null || response.data === ''
        ? { status: 'ACCEPTED', message: 'Bridge URL update accepted.', url: resolved.url }
        : response.data;

    return { status: response.status, body: govBody, bridgeUrl: resolved.url };
  } catch (err) {
    const status = err.status || err.response?.status || 500;
    const raw = err.response?.data || { message: err.message || 'Bridge URL update failed.' };
    const parsed = extractAbdmError(raw, status, 'Failed to update ABDM Bridge URL');
    return {
      status,
      body: {
        success: false,
        message: 'Failed to update ABDM Bridge URL',
        error: {
          status: parsed.status,
          code: parsed.code,
          description: parsed.description || parsed.message,
        },
      },
    };
  }
}

/**
 * Persist bridgeUrl on AbdmFacilityConfig after a successful government update.
 */
async function saveFacilityBridgeUrl(hospitalId, bridgeUrl, extras = {}) {
  if (!hospitalId) return null;
  const existing = await prisma.abdmFacilityConfig.findUnique({ where: { hospitalId } });
  if (!existing) {
    const facilityId = String(extras.facilityId || '').trim();
    const facilityName = String(extras.facilityName || '').trim();
    if (!facilityId || !facilityName) {
      // Do not invent HFR facilityId. Government URL update still succeeds;
      // facility row is created only when identifiers are provided.
      return null;
    }
    return prisma.abdmFacilityConfig.create({
      data: {
        hospitalId,
        facilityId,
        facilityName,
        bridgeId: String(extras.bridgeId || abdmConfig.bridgeId || abdmConfig.clientId || '').trim() || 'PENDING_BRIDGE',
        bridgeUrl,
        isHipActive: false,
        isHiuActive: false,
      },
    });
  }
  return prisma.abdmFacilityConfig.update({
    where: { hospitalId },
    data: { bridgeUrl },
  });
}

/**
 * Admin helper: update government bridge URL + save on facility config.
 * Returns VyanX-style JSON suitable for Postman (HTTP 200 on ABDM 200/202).
 */
async function updateFacilityBridgeUrl(hospitalId, options = {}) {
  const id = String(hospitalId || '').trim();
  if (!id) {
    return {
      status: 400,
      body: { success: false, message: 'hospitalId is required.' },
    };
  }

  const providedUrl = String(options.url || options.bridgeUrl || '').trim();
  const validated = requireHttpsBridgeUrl(providedUrl);
  if (!validated.ok) {
    return { status: validated.status, body: validated.body };
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!hospital) {
    return { status: 404, body: { success: false, message: 'Hospital not found.' } };
  }

  const result = await updateBridgeUrl({
    hospitalId: id,
    bridgeUrl: validated.url,
  });

  if (result.status === 200 || result.status === 202) {
    const saved = await saveFacilityBridgeUrl(id, result.bridgeUrl || validated.url, {
      facilityId: options.facilityId,
      facilityName: options.facilityName,
      bridgeId: options.bridgeId,
    });

    console.log('[ABDM][BRIDGE_URL] Bridge URL updated successfully');

    const accepted = result.status === 202;
    return {
      status: 200,
      body: {
        success: true,
        message: accepted
          ? 'ABDM Bridge URL update request accepted successfully'
          : 'ABDM Bridge URL registered successfully',
        data: {
          hospitalId: id,
          bridgeUrl: saved?.bridgeUrl || result.bridgeUrl || validated.url,
          abdmStatus: result.status,
          facilityConfigSaved: Boolean(saved),
        },
      },
    };
  }

  // updateBridgeUrl already formats failure body when catch path is used.
  if (result.body?.success === false && result.body?.error) {
    return { status: result.status, body: result.body };
  }

  const parsed = extractAbdmError(result.body, result.status, 'Failed to update ABDM Bridge URL');
  return {
    status: result.status || 502,
    body: {
      success: false,
      message: 'Failed to update ABDM Bridge URL',
      error: {
        status: parsed.status,
        code: parsed.code,
        description: parsed.description || parsed.message,
      },
    },
  };
}

/**
 * Prepare HIP registration via HSP MutipleHRPAddUpdateServices.
 * Does NOT invent facilityId — requires configured/supplied HFR facilityId.
 */
async function registerHospitalHrp(hospitalId, options = {}) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { id: true, name: true },
  });
  if (!hospital) {
    return { status: 404, body: { success: false, message: 'Hospital not found.' } };
  }

  let facility = await prisma.abdmFacilityConfig.findUnique({ where: { hospitalId } });

  const facilityId = String(options.facilityId || facility?.facilityId || '').trim();
  const facilityName = String(
    options.facilityName || facility?.facilityName || hospital.name || ''
  ).trim();
  const bridgeId = String(
    options.bridgeId || facility?.bridgeId || abdmConfig.bridgeId || abdmConfig.clientId || ''
  ).trim();
  const hipName = String(options.hipName || facilityName || 'VyanX HIP').trim();

  if (!facilityId || facilityId === 'PENDING_HFR' || facilityId === abdmConfig.defaultHospitalCode) {
    return {
      status: 400,
      body: {
        success: false,
        message:
          'HFR facilityId is required before HIP registration. Configure AbdmFacilityConfig.facilityId (do not invent facilityId).',
        pending: true,
      },
    };
  }
  if (!facilityName) {
    return {
      status: 400,
      body: { success: false, message: 'facilityName is required for HIP registration.' },
    };
  }
  if (!bridgeId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'ABDM_BRIDGE_ID (or facility bridgeId) is required for HIP registration.',
      },
    };
  }

  const payload = {
    facilityId,
    facilityName,
    HRP: [
      {
        bridgeId,
        hipName,
        type: 'HIP',
        active: true,
      },
    ],
  };

  try {
    const response = await abdmRequest({
      method: 'POST',
      base: 'hsp',
      path: HRP_REGISTER_PATH,
      data: payload,
      apiName: 'REGISTER_HRP',
      hospitalId,
      auditRequestBody: {
        facilityId,
        facilityName,
        bridgeId,
        type: 'HIP',
      },
    });

    const gov = response.data || {};
    const returnedHipId =
      options.hipId ||
      gov.hipId ||
      gov?.HRP?.[0]?.hipId ||
      gov?.services?.[0]?.id ||
      facility?.hipId ||
      null;

    facility = await prisma.abdmFacilityConfig.upsert({
      where: { hospitalId },
      create: {
        hospitalId,
        facilityId,
        facilityName,
        bridgeId,
        bridgeUrl: facility?.bridgeUrl || abdmConfig.bridgeCallbackUrl || null,
        hipId: returnedHipId,
        isHipActive: true,
        isHiuActive: false,
        registeredAt: new Date(),
      },
      update: {
        facilityId,
        facilityName,
        bridgeId,
        hipId: returnedHipId || undefined,
        isHipActive: true,
        registeredAt: new Date(),
      },
    });

    return {
      status: response.status,
      body: {
        success: true,
        hospitalId,
        facilityId: facility.facilityId,
        facilityName: facility.facilityName,
        bridgeId: facility.bridgeId,
        hipId: facility.hipId,
        governmentResponse: gov,
        note: facility.hipId
          ? undefined
          : 'HIP registered; set hipId on AbdmFacilityConfig if government response did not return one.',
      },
    };
  } catch (err) {
    return {
      status: err.status || err.response?.status || 500,
      body: {
        success: false,
        message: 'HIP / HRP registration failed.',
        governmentResponse: err.response?.data || { message: err.message },
      },
    };
  }
}

async function getBridgeServices({ hospitalId = null } = {}) {
  try {
    const response = await abdmRequest({
      method: 'GET',
      path: BRIDGE_SERVICES_PATH,
      apiName: 'BRIDGE_SERVICES',
      hospitalId,
    });
    return { status: response.status, body: response.data };
  } catch (err) {
    return {
      status: err.status || 500,
      body: err.response?.data || { success: false, message: err.message },
    };
  }
}

async function getBridgeServiceById(serviceId, { hospitalId = null } = {}) {
  const id = String(serviceId || '').trim();
  if (!id) {
    return { status: 400, body: { success: false, message: 'serviceId is required.' } };
  }
  try {
    const response = await abdmRequest({
      method: 'GET',
      path: `${BRIDGE_SERVICE_BY_ID_PATH}/${encodeURIComponent(id)}`,
      apiName: 'BRIDGE_SERVICE_BY_ID',
      hospitalId,
    });
    return { status: response.status, body: response.data };
  } catch (err) {
    return {
      status: err.status || 500,
      body: err.response?.data || { success: false, message: err.message },
    };
  }
}

async function getGatewayCerts({ hospitalId = null } = {}) {
  try {
    const response = await abdmRequest({
      method: 'GET',
      path: GATEWAY_CERTS_PATH,
      apiName: 'GATEWAY_CERTS',
      hospitalId,
      auth: true,
    });
    return { status: response.status, body: response.data };
  } catch (err) {
    return {
      status: err.status || 500,
      body: err.response?.data || { success: false, message: err.message },
    };
  }
}

async function getOpenIdConfiguration({ hospitalId = null } = {}) {
  try {
    const response = await abdmRequest({
      method: 'GET',
      path: OPENID_CONFIG_PATH,
      apiName: 'OPENID_CONFIGURATION',
      hospitalId,
      auth: true,
    });
    return { status: response.status, body: response.data };
  } catch (err) {
    return {
      status: err.status || 500,
      body: err.response?.data || { success: false, message: err.message },
    };
  }
}

module.exports = {
  updateBridgeUrl,
  updateFacilityBridgeUrl,
  registerHospitalHrp,
  getBridgeServices,
  getBridgeServiceById,
  getGatewayCerts,
  getOpenIdConfiguration,
  BRIDGE_URL_PATH,
  HRP_REGISTER_PATH,
};
