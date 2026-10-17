const crypto = require('crypto');

function toIsoDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toIsoDate(value) {
  const iso = toIsoDateTime(value);
  return iso ? iso.slice(0, 10) : null;
}

function stableUuid(seed) {
  const hex = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function urnUuid(id) {
  return `urn:uuid:${id}`;
}

function bundleEntry(resource) {
  return {
    fullUrl: urnUuid(resource.id),
    resource,
  };
}

function mapFhirGender(gender) {
  const value = String(gender || '').trim().toUpperCase();
  if (value === 'M' || value === 'MALE') return 'male';
  if (value === 'F' || value === 'FEMALE') return 'female';
  if (value === 'O' || value === 'OTHER' || value === 'TRANSGENDER') return 'other';
  return null;
}

function createDocumentBundle({ bundleId, timestamp, identifier, entries }) {
  const bundle = {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'document',
    timestamp,
    entry: entries,
  };
  if (identifier?.value) {
    bundle.identifier = identifier;
  }
  return bundle;
}

function textOrNull(value) {
  const text = String(value || '').trim();
  return text || null;
}

function buildSharedPatientResource({ patient, patientId }) {
  const resource = {
    resourceType: 'Patient',
    id: patientId,
  };
  const uhid = textOrNull(patient?.uhid);
  if (uhid) {
    resource.identifier = [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical record number',
            },
          ],
        },
        value: uhid,
      },
    ];
  }
  const name = textOrNull(patient?.name);
  if (name) resource.name = [{ text: name }];
  const gender = mapFhirGender(patient?.gender);
  if (gender) resource.gender = gender;
  const birthDate = toIsoDate(patient?.dob);
  if (birthDate) resource.birthDate = birthDate;
  return resource;
}

module.exports = {
  toIsoDateTime,
  toIsoDate,
  stableUuid,
  urnUuid,
  bundleEntry,
  mapFhirGender,
  createDocumentBundle,
  textOrNull,
  buildSharedPatientResource,
};
