const { prisma } = require('../../../config/prisma');

function logConsentStore(label, payload) {
  console.log(`[abdm-consent] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function maskAbhaAddress(value) {
  const address = String(value || '').trim();
  if (!address) return null;
  const at = address.indexOf('@');
  if (at <= 2) return '****';
  return `${address.slice(0, 2)}****${address.slice(at)}`;
}

async function findPatientsByAbhaAddress(abhaAddress) {
  const address = String(abhaAddress || '').trim();
  if (!address) return [];
  return prisma.patient.findMany({
    where: { abhaAddress: address },
    select: { id: true, abhaAddress: true },
  });
}

function normalizeCareContextReferences(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

async function persistHipConsent({ consentId, abhaAddress, status, careContextReferences } = {}) {
  const id = String(consentId || '').trim();
  const address = String(abhaAddress || '').trim();
  if (!id || !address) {
    logConsentStore('Consent mapping not persisted', {
      consentId: id || null,
      hasAbhaAddress: Boolean(address),
      reason: 'consentId and patient ABHA are required.',
    });
    return null;
  }

  const patients = await findPatientsByAbhaAddress(address);
  const patientId = patients.length === 1 ? patients[0].id : null;
  const refs = normalizeCareContextReferences(careContextReferences);
  const row = await prisma.abdmHipConsent.upsert({
    where: { consentId: id },
    create: {
      consentId: id,
      abhaAddress: address,
      patientId,
      status: status || null,
      careContextReferences: refs,
    },
    update: {
      abhaAddress: address,
      patientId,
      status: status || null,
      careContextReferences: refs,
    },
  });

  logConsentStore('Consent mapping persisted', {
    consentId: row.consentId,
    patientAbha: maskAbhaAddress(row.abhaAddress),
    patientId: row.patientId || null,
    careContextCount: refs.length,
  });
  return row;
}

async function resolvePatientIdsByConsentId(consentId) {
  const id = String(consentId || '').trim();
  if (!id) return [];

  const mapping = await prisma.abdmHipConsent.findUnique({
    where: { consentId: id },
  });
  if (!mapping?.abhaAddress) return [];

  const patients = await findPatientsByAbhaAddress(mapping.abhaAddress);
  return [...new Set(patients.map((row) => row.id).filter(Boolean))];
}

async function resolveConsentCareContextReferences(consentId) {
  const id = String(consentId || '').trim();
  if (!id) return [];

  const mapping = await prisma.abdmHipConsent.findUnique({
    where: { consentId: id },
    select: { careContextReferences: true },
  });
  return normalizeCareContextReferences(mapping?.careContextReferences);
}

module.exports = {
  persistHipConsent,
  resolvePatientIdsByConsentId,
  resolveConsentCareContextReferences,
};
