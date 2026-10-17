const { prisma } = require('../../../config/prisma');

const EPISODE = {
  OPD_CONSULTATION: 'OPD_CONSULTATION',
  PRESCRIPTION: 'PRESCRIPTION',
  IPD_PRESCRIPTION: 'IPD_PRESCRIPTION',
  LAB_REPORT: 'LAB_REPORT',
  IPD_ADMISSION: 'IPD_ADMISSION',
  DISCHARGE: 'DISCHARGE',
};

const SOURCE = {
  CONSULTATION: 'CONSULTATION',
  PRESCRIPTION: 'PRESCRIPTION',
  TREATMENT_PLAN: 'TREATMENT_PLAN',
  LAB_ORDER: 'LAB_ORDER',
  ADMISSION: 'ADMISSION',
  DISCHARGE: 'DISCHARGE',
};

function toAbdmDisplay(value, fallback) {
  const cleaned = String(value || fallback || '')
    .replace(/[—–]/g, '-')
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'OPD Visit').slice(0, 50);
}

function sourceKey(sourceId) {
  return String(sourceId || '').replace(/-/g, '');
}

function buildOpdCareContextId(patient, sourceId) {
  const uhid = String(patient?.uhid || 'UNK').replace(/\s+/g, '');
  return `CC-OPD-${uhid}-${sourceKey(sourceId)}`;
}

function buildEpisodeCareContextId(episodeType, patient, sourceId) {
  const uhid = String(patient?.uhid || 'UNK').replace(/\s+/g, '');
  const source = sourceKey(sourceId);
  if (episodeType === EPISODE.OPD_CONSULTATION) return buildOpdCareContextId(patient, sourceId);
  if (episodeType === EPISODE.PRESCRIPTION) return `CC-RX-${uhid}-${source}`;
  if (episodeType === EPISODE.IPD_PRESCRIPTION) return `CC-RXIPD-${uhid}-${source}`;
  if (episodeType === EPISODE.LAB_REPORT) return `CC-LAB-${uhid}-${source}`;
  if (episodeType === EPISODE.IPD_ADMISSION) return `CC-IPD-${uhid}-${source}`;
  if (episodeType === EPISODE.DISCHARGE) return `CC-DS-${uhid}-${source}`;
  return `CC-${episodeType}-${source}`;
}

function logStore(label, payload) {
  console.log(`[abdm-hr] ${label}`);
  if (payload !== undefined) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

/**
 * Find the episode care context for a clinical source, or create one.
 * Never reads or writes Patient.careContextId.
 */
async function resolveEpisodeCareContext({
  patient,
  episodeType,
  sourceType,
  sourceId,
  hiType,
  display,
}) {
  if (!patient?.id || !sourceType || !sourceId) {
    throw new Error('patient, sourceType, and sourceId are required.');
  }

  const existing = await prisma.abdmCareContext.findUnique({
    where: { sourceType_sourceId: { sourceType, sourceId } },
  });
  if (existing) {
    logStore('Care context reused', {
      careContextId: existing.careContextId,
      sourceType,
      sourceId,
      episodeType: existing.episodeType,
    });
    return { careContext: existing, created: false };
  }

  const careContextId = buildEpisodeCareContextId(episodeType, patient, sourceId);
  const resolvedDisplay = toAbdmDisplay(display, `OPD Visit ${careContextId}`);

  try {
    const created = await prisma.abdmCareContext.create({
      data: {
        patientId: patient.id,
        careContextId,
        episodeType,
        sourceType,
        sourceId,
        hiType,
        display: resolvedDisplay,
        linkStatus: 'PENDING',
      },
    });
    logStore('Care context created', {
      careContextId: created.careContextId,
      sourceType,
      sourceId,
      episodeType,
    });
    return { careContext: created, created: true };
  } catch (err) {
    if (err?.code === 'P2002') {
      const raced = await prisma.abdmCareContext.findUnique({
        where: { sourceType_sourceId: { sourceType, sourceId } },
      });
      if (raced) {
        logStore('Care context reused', {
          careContextId: raced.careContextId,
          sourceType,
          sourceId,
          episodeType: raced.episodeType,
          raced: true,
        });
        return { careContext: raced, created: false };
      }
    }
    throw err;
  }
}

async function findEpisodeCareContext({ sourceType, sourceId }) {
  if (!sourceType || !sourceId) return null;
  return prisma.abdmCareContext.findUnique({
    where: { sourceType_sourceId: { sourceType, sourceId } },
  });
}

function parseRangeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Existing CONSULTATION episode care contexts for a patient in HI dateRange.
 * Does not create care contexts. Does not read Patient.careContextId.
 */
async function resolveConsultationCareContextsByDateRange({
  patientId,
  patientIds,
  dateFrom,
  dateTo,
} = {}) {
  const ids = [...new Set(
    (Array.isArray(patientIds) ? patientIds : [patientId])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];
  const from = parseRangeDate(dateFrom);
  const to = parseRangeDate(dateTo);
  if (!ids.length || !from || !to) return [];

  const consultations = await prisma.consultation.findMany({
    where: {
      patientId: { in: ids },
      createdAt: { gte: from, lte: to },
    },
    select: { id: true, patientId: true },
  });
  const sourceIds = consultations.map((row) => row.id);
  if (!sourceIds.length) return [];

  const careContexts = await prisma.abdmCareContext.findMany({
    where: {
      patientId: { in: ids },
      sourceType: SOURCE.CONSULTATION,
      sourceId: { in: sourceIds },
    },
    select: {
      careContextId: true,
      sourceType: true,
      sourceId: true,
    },
  });

  return careContexts.map((row) => ({
    careContextId: row.careContextId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
  }));
}

async function sourceRecordDate(row) {
  const sourceType = String(row.sourceType || '').toUpperCase();
  if (sourceType === SOURCE.CONSULTATION || sourceType === SOURCE.PRESCRIPTION) {
    const consult = await prisma.consultation.findUnique({
      where: { id: row.sourceId },
      select: { createdAt: true },
    });
    return consult?.createdAt || row.createdAt;
  }
  if (sourceType === SOURCE.TREATMENT_PLAN) {
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id: row.sourceId },
      select: { updatedAt: true, createdAt: true },
    });
    return plan?.updatedAt || plan?.createdAt || row.createdAt;
  }
  if (sourceType === SOURCE.LAB_ORDER) {
    const lab = await prisma.labOrder.findUnique({
      where: { id: row.sourceId },
      select: { updatedAt: true, createdAt: true },
    });
    return lab?.updatedAt || lab?.createdAt || row.createdAt;
  }
  if (sourceType === SOURCE.ADMISSION) {
    const admission = await prisma.admission.findUnique({
      where: { id: row.sourceId },
      select: { admissionDate: true },
    });
    return admission?.admissionDate || row.createdAt;
  }
  if (sourceType === SOURCE.DISCHARGE) {
    const admission = await prisma.admission.findUnique({
      where: { id: row.sourceId },
      select: { dischargeDate: true },
    });
    return admission?.dischargeDate || row.createdAt;
  }
  return row.createdAt;
}

/**
 * Existing episode CCs in the consent allow-list whose source date is in HI dateRange.
 * Does not create care contexts. Does not read Patient.careContextId.
 */
async function filterConsentApprovedCareContexts({
  careContextIds,
  patientIds,
  dateFrom,
  dateTo,
} = {}) {
  const approved = [...new Set(
    (Array.isArray(careContextIds) ? careContextIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];
  const ids = [...new Set((Array.isArray(patientIds) ? patientIds : []).map((value) => String(value || '').trim()).filter(Boolean))];
  const from = parseRangeDate(dateFrom);
  const to = parseRangeDate(dateTo);
  if (!approved.length || !ids.length || !from || !to) return [];

  const rows = await prisma.abdmCareContext.findMany({
    where: {
      careContextId: { in: approved },
      patientId: { in: ids },
    },
    select: {
      careContextId: true,
      sourceType: true,
      sourceId: true,
      createdAt: true,
    },
  });

  const matched = [];
  for (const row of rows) {
    const recordDate = await sourceRecordDate(row);
    if (!recordDate) continue;
    const when = new Date(recordDate);
    if (when >= from && when <= to) {
      matched.push({
        careContextId: row.careContextId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
      });
    }
  }
  return matched;
}

async function filterConsentConsultationCareContexts(args) {
  return filterConsentApprovedCareContexts(args);
}

module.exports = {
  EPISODE,
  SOURCE,
  toAbdmDisplay,
  buildOpdCareContextId,
  buildEpisodeCareContextId,
  resolveEpisodeCareContext,
  findEpisodeCareContext,
  resolveConsultationCareContextsByDateRange,
  filterConsentConsultationCareContexts,
  filterConsentApprovedCareContexts,
};
