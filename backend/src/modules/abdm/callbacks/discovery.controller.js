const { prisma } = require('../../../config/prisma');
const { client } = require('../lib/abdmClient');
const { buildAbdmHeaders } = require('../lib/abdmHeaders');
const { ensureAccessToken } = require('../lib/abdmSession');
const { requireHipId } = require('../lib/hospitalResolver');

/** Gateway base already includes /api/hiecm. */
const ON_DISCOVER_PATH = '/user-initiated-linking/v3/patient/care-context/on-discover';

const PATIENT_SELECT = {
  id: true,
  uhid: true,
  name: true,
  gender: true,
  dob: true,
  age: true,
  mobile: true,
  abhaAddress: true,
  abhaNumber: true,
  healthIdNumber: true,
  careContextId: true,
  hospitalId: true,
  createdAt: true,
};

function headerValue(headers, name) {
  if (!headers) return '';
  const value = headers[name] || headers[String(name).toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function last10Mobile(value) {
  const digits = digitsOnly(value);
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toAbdmGender(gender) {
  const g = String(gender || '').trim().toUpperCase();
  if (g === 'M' || g === 'MALE') return 'M';
  if (g === 'F' || g === 'FEMALE') return 'F';
  if (g === 'O' || g === 'OTHER' || g === 'TRANSGENDER') return 'O';
  return '';
}

function yearOfBirthFromPatient(patient) {
  if (patient?.dob) {
    const d = new Date(patient.dob);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  if (patient?.age != null && Number.isFinite(Number(patient.age))) {
    return new Date().getFullYear() - Number(patient.age);
  }
  return null;
}

/** ABDM display allows letters, digits, spaces, and hyphen only. */
function toAbdmDisplay(value, fallback) {
  const cleaned = String(value || fallback || '')
    .replace(/[—–]/g, '-')
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'OPD Visit').slice(0, 50);
}

function identifierValue(list, type) {
  const wanted = String(type || '').toUpperCase();
  const row = (Array.isArray(list) ? list : []).find(
    (item) => String(item?.type || '').trim().toUpperCase() === wanted
  );
  return String(row?.value || '').trim();
}

function maskMobile(value) {
  const digits = last10Mobile(value);
  if (!digits) return '';
  return `******${digits.slice(-4)}`;
}

function maskAbhaNumber(value) {
  const digits = digitsOnly(value);
  if (digits.length < 8) return digits ? '****' : '';
  return `${digits.slice(0, 2)}****${digits.slice(-4)}`;
}

function logUil(label, payload) {
  console.log(`[abdm-uil] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function demographicsDoNotContradict(patient, incoming) {
  if (incoming.name && patient.name && normalizeName(incoming.name) !== normalizeName(patient.name)) {
    return false;
  }
  const incomingGender = toAbdmGender(incoming.gender);
  const patientGender = toAbdmGender(patient.gender);
  if (incomingGender && patientGender && incomingGender !== patientGender) {
    return false;
  }
  const incomingYear = Number(incoming.yearOfBirth);
  const patientYear = yearOfBirthFromPatient(patient);
  if (incoming.yearOfBirth && patientYear && incomingYear !== patientYear) {
    return false;
  }
  return true;
}

function demographicsFullyMatch(patient, incoming) {
  const incomingYear = Number(incoming.yearOfBirth);
  const patientYear = yearOfBirthFromPatient(patient);
  if (!incoming.name || !toAbdmGender(incoming.gender) || !incomingYear || !patientYear) return false;
  if (!patient.name || !toAbdmGender(patient.gender)) return false;
  return (
    normalizeName(incoming.name) === normalizeName(patient.name) &&
    toAbdmGender(incoming.gender) === toAbdmGender(patient.gender) &&
    incomingYear === patientYear
  );
}

function withCareContext(rows) {
  return (rows || []).filter((row) => String(row.careContextId || '').trim());
}

function abhaNumberVariants(abhaDigits) {
  const variants = new Set();
  if (!abhaDigits) return [];
  variants.add(abhaDigits);
  if (abhaDigits.length === 14) {
    variants.add(
      `${abhaDigits.slice(0, 2)}-${abhaDigits.slice(2, 6)}-${abhaDigits.slice(6, 10)}-${abhaDigits.slice(10)}`
    );
  }
  return [...variants];
}

function sameAbhaNumber(patient, abhaDigits) {
  if (!abhaDigits) return false;
  return digitsOnly(patient.abhaNumber) === abhaDigits || digitsOnly(patient.healthIdNumber) === abhaDigits;
}

function sameMobile(patient, mobileDigits) {
  if (!mobileDigits) return false;
  return last10Mobile(patient.mobile) === mobileDigits;
}

function matchedByFor(patient, incoming) {
  const used = [];
  if (
    incoming.abhaAddress &&
    patient.abhaAddress &&
    incoming.abhaAddress.toLowerCase() === String(patient.abhaAddress).trim().toLowerCase()
  ) {
    used.push('ABHA_ADDRESS');
  }
  if (sameAbhaNumber(patient, incoming.abhaNumber)) used.push('ABHA_NUMBER');
  if (incoming.mr && patient.uhid && incoming.mr === String(patient.uhid).trim()) used.push('MR');
  if (sameMobile(patient, incoming.mobile)) used.push('MOBILE');
  return used;
}

async function findByAbhaAddress(abhaAddress) {
  if (!abhaAddress) return [];
  return prisma.patient.findMany({
    where: { abhaAddress: { equals: abhaAddress, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    select: PATIENT_SELECT,
  });
}

async function findByAbhaNumber(abhaDigits) {
  if (!abhaDigits) return [];
  const variants = abhaNumberVariants(abhaDigits);
  const tail = abhaDigits.slice(-4);
  const rows = await prisma.patient.findMany({
    where: {
      OR: [
        { abhaNumber: { in: variants } },
        { healthIdNumber: { in: variants } },
        { abhaNumber: { contains: tail } },
        { healthIdNumber: { contains: tail } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: PATIENT_SELECT,
    take: 50,
  });
  return rows.filter((row) => sameAbhaNumber(row, abhaDigits));
}

async function findByMr(mr) {
  if (!mr) return null;
  return prisma.patient.findFirst({
    where: { uhid: mr },
    select: PATIENT_SELECT,
  });
}

async function findByMobile(mobileDigits) {
  if (!mobileDigits) return [];
  const tail = mobileDigits.slice(-4);
  const rows = await prisma.patient.findMany({
    where: { mobile: { contains: tail } },
    orderBy: { createdAt: 'desc' },
    select: PATIENT_SELECT,
    take: 50,
  });
  return rows.filter((row) => sameMobile(row, mobileDigits));
}

/**
 * Strongest existing identifier first.
 * Verified ABHA address / ABHA number use the same exact lookup as HIP callbacks.
 * Unverified MR must not contradict name, gender, or year of birth.
 * Mobile is used only together with name, gender, and year of birth.
 */
async function matchDiscoverPatient(incoming) {
  if (incoming.abhaAddress) {
    const rows = withCareContext(await findByAbhaAddress(incoming.abhaAddress));
    if (rows[0]) return { patient: rows[0], matchedBy: matchedByFor(rows[0], incoming) };
  }

  if (incoming.abhaNumber) {
    const rows = withCareContext(await findByAbhaNumber(incoming.abhaNumber));
    if (rows[0]) return { patient: rows[0], matchedBy: matchedByFor(rows[0], incoming) };
  }

  if (incoming.mr) {
    const row = await findByMr(incoming.mr);
    if (row && String(row.careContextId || '').trim() && demographicsDoNotContradict(row, incoming)) {
      return { patient: row, matchedBy: matchedByFor(row, incoming) };
    }
  }

  if (incoming.mobile) {
    const rows = withCareContext(await findByMobile(incoming.mobile)).filter((row) =>
      demographicsFullyMatch(row, incoming)
    );
    if (rows.length === 1) return { patient: rows[0], matchedBy: matchedByFor(rows[0], incoming) };
  }

  return null;
}

function buildSuccessBody({ transactionId, requestId, patient, matchedBy }) {
  const referenceNumber = String(patient.uhid || patient.id);
  const careContextId = String(patient.careContextId).trim();
  return {
    transactionId,
    patient: [
      {
        referenceNumber,
        display: toAbdmDisplay(patient.name, referenceNumber),
        careContexts: [
          {
            referenceNumber: careContextId,
            display: toAbdmDisplay(`OPD Visit ${careContextId}`),
          },
        ],
        hiType: 'OPConsultation',
        count: 1,
      },
    ],
    matchedBy,
    response: {
      requestId,
    },
  };
}

function buildNotFoundBody({ transactionId, requestId }) {
  return {
    transactionId,
    error: {
      code: 'ABDM-1010',
      message: 'Patient not found',
    },
    response: {
      requestId,
    },
  };
}

async function callOnDiscover(payload, hospitalId) {
  await requireHipId(hospitalId || null);
  const accessToken = await ensureAccessToken();
  const headers = buildAbdmHeaders({ accessToken });
  const outboundRequestId = headers['REQUEST-ID'];

  try {
    const response = await client.post(ON_DISCOVER_PATH, payload, { headers });
    logUil('on-discover response', {
      status: response.status,
      outboundRequestId,
      responseRequestId: payload?.response?.requestId || null,
      transactionId: payload?.transactionId || null,
      matchedBy: payload?.matchedBy || null,
      error: payload?.error || null,
      body: response.data ?? null,
    });
    return { status: response.status, data: response.data, error: false };
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };
    logUil('on-discover response', {
      status,
      outboundRequestId,
      responseRequestId: payload?.response?.requestId || null,
      transactionId: payload?.transactionId || null,
      error: true,
      body: data,
    });
    return { status, data, error: true };
  }
}

/**
 * ABDM M2 user-initiated discovery callback.
 * POST {bridge}/api/v3/hip/patient/care-context/discover
 */
async function handleDiscoverCallback(body = {}, headers = {}) {
  const requestId = headerValue(headers, 'REQUEST-ID');
  const transactionId = String(body?.transactionId || '').trim();
  const patient = body?.patient || {};
  const verified = patient.verifiedIdentifiers;
  const unverified = patient.unverifiedIdentifiers;
  const incoming = {
    abhaAddress: String(patient.id || '').trim(),
    abhaNumber: digitsOnly(identifierValue(verified, 'ABHA_NUMBER')),
    mobile: last10Mobile(identifierValue(verified, 'MOBILE')),
    mr: identifierValue(unverified, 'MR'),
    name: String(patient.name || '').trim(),
    gender: String(patient.gender || '').trim(),
    yearOfBirth: patient.yearOfBirth,
  };

  logUil('DISCOVER CALLBACK received', {
    transactionId: transactionId || null,
    requestId: requestId || null,
    hipId: headerValue(headers, 'X-HIP-ID') || null,
    abhaAddress: incoming.abhaAddress || null,
    abhaNumber: maskAbhaNumber(incoming.abhaNumber) || null,
    mobile: maskMobile(incoming.mobile) || null,
    mr: incoming.mr || null,
    name: incoming.name || null,
    gender: incoming.gender || null,
    yearOfBirth: incoming.yearOfBirth ?? null,
  });

  if (!transactionId || !requestId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'transactionId and REQUEST-ID are required.',
      },
    };
  }

  try {
    const match = await matchDiscoverPatient(incoming);
    if (!match) {
      logUil('Patient not found', {
        transactionId,
        requestId,
      });
      await callOnDiscover(buildNotFoundBody({ transactionId, requestId }));
    } else {
      const matchedBy = match.matchedBy;
      logUil('Patient matched', {
        transactionId,
        requestId,
        patientId: match.patient.id,
        uhid: match.patient.uhid || null,
        careContextId: match.patient.careContextId,
        matchedBy,
      });
      await callOnDiscover(
        buildSuccessBody({
          transactionId,
          requestId,
          patient: match.patient,
          matchedBy,
        }),
        match.patient.hospitalId
      );
    }
  } catch (err) {
    logUil('on-discover response', {
      status: err.status || 500,
      error: true,
      message: err.message,
      transactionId,
      requestId,
    });
  }

  return {
    status: 200,
    body: { acknowledgement: 'ACCEPTED' },
  };
}

module.exports = {
  handleDiscoverCallback,
  ON_DISCOVER_PATH,
};
