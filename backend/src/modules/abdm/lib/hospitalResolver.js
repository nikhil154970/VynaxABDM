const { prisma } = require('../../../config/prisma');
const { abdmConfig } = require('./abdmConfig');

/**
 * Resolve HIP / facility identifiers for ABDM gateway calls.
 * Priority: AbdmFacilityConfig (DB) → env ABDM_HIP_ID / ABDM_BRIDGE_ID.
 * Multi-hospital: one Bridge ID in env; each hospital has own facilityId + hipId.
 */
async function resolveHospitalAbdmConfig(hospitalId) {
  let facility = null;
  if (hospitalId) {
    facility = await prisma.abdmFacilityConfig.findUnique({
      where: { hospitalId },
      select: {
        facilityId: true,
        facilityName: true,
        hipId: true,
        hiuId: true,
        bridgeId: true,
        bridgeUrl: true,
        isHipActive: true,
      },
    });
  }

  if (!facility) {
    facility = await prisma.abdmFacilityConfig.findFirst({
      where: { isHipActive: true },
      orderBy: { registeredAt: 'desc' },
      select: {
        facilityId: true,
        facilityName: true,
        hipId: true,
        hiuId: true,
        bridgeId: true,
        bridgeUrl: true,
        isHipActive: true,
      },
    });
  }

  const hipId = facility?.hipId || abdmConfig.hipId || '';
  const bridgeId = facility?.bridgeId || abdmConfig.bridgeId || abdmConfig.clientId || '';
  // Do not invent HFR facilityId — only return configured value (may be empty).
  const facilityId = facility?.facilityId && facility.facilityId !== 'PENDING_HFR'
    ? facility.facilityId
    : '';
  const facilityName = facility?.facilityName || '';

  return {
    hipId,
    bridgeId,
    facilityId,
    facilityName,
    bridgeUrl: facility?.bridgeUrl || abdmConfig.bridgeCallbackUrl || '',
    isHipActive: facility ? Boolean(facility.isHipActive) : Boolean(hipId),
    source: facility?.hipId ? 'db' : hipId ? 'env' : 'missing',
  };
}

async function requireHipId(hospitalId) {
  const cfg = await resolveHospitalAbdmConfig(hospitalId);
  if (!cfg.hipId) {
    const err = new Error(
      'ABDM HIP ID is not configured. Register HRP for this hospital or set AbdmFacilityConfig.hipId / ABDM_HIP_ID.'
    );
    err.status = 400;
    throw err;
  }
  return cfg;
}

module.exports = {
  resolveHospitalAbdmConfig,
  requireHipId,
};
