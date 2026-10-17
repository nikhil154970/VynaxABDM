const { prisma } = require('../../../config/prisma');
const {
  toIsoDateTime,
  toIsoDate,
  stableUuid,
  urnUuid,
  bundleEntry,
  mapFhirGender,
  createDocumentBundle,
} = require('./bundle');

function textOrNull(value) {
  const text = String(value || '').trim();
  return text || null;
}

function buildPatientResource({ patient, patientId }) {
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
  if (name) {
    resource.name = [{ text: name }];
  }

  const gender = mapFhirGender(patient?.gender);
  if (gender) {
    resource.gender = gender;
  }

  const birthDate = toIsoDate(patient?.dob);
  if (birthDate) {
    resource.birthDate = birthDate;
  }

  return resource;
}

function buildEncounterResource({ encounterId, patientId, authoredOn, careContextReference }) {
  const resource = {
    resourceType: 'Encounter',
    id: encounterId,
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: { reference: urnUuid(patientId) },
  };

  if (authoredOn) {
    resource.period = { start: authoredOn };
  }

  if (careContextReference) {
    resource.identifier = [
      {
        system: 'https://abdm.gov.in/care-context',
        value: careContextReference,
      },
    ];
  }

  return resource;
}

function buildConditionResource({ conditionId, patientId, encounterId, text, categoryCode, categoryDisplay }) {
  return {
    resourceType: 'Condition',
    id: conditionId,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: categoryCode,
            display: categoryDisplay,
          },
        ],
      },
    ],
    code: {
      text,
    },
    subject: { reference: urnUuid(patientId) },
    encounter: { reference: urnUuid(encounterId) },
  };
}

function buildComposition({
  compositionId,
  patientId,
  encounterId,
  authoredOn,
  careContextReference,
  sectionEntries,
}) {
  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '371530004',
          display: 'Clinical consultation report',
        },
      ],
      text: 'OPConsultation',
    },
    subject: { reference: urnUuid(patientId) },
    encounter: { reference: urnUuid(encounterId) },
    date: authoredOn,
    title: 'OPD Consultation',
    section: [
      {
        title: 'OPD Consultation',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '371530004',
              display: 'Clinical consultation report',
            },
          ],
        },
        entry: sectionEntries,
      },
    ],
  };

  if (careContextReference) {
    composition.identifier = {
      system: 'https://abdm.gov.in/care-context',
      value: careContextReference,
    };
  }

  return composition;
}

function buildOpdConsultationBundle({ patient, consultation, careContext } = {}) {
  if (!consultation?.id) {
    throw new Error('consultation.id is required.');
  }
  if (!patient?.id) {
    throw new Error('patient.id is required.');
  }

  const careContextReference = textOrNull(careContext?.careContextId);
  if (!careContextReference) {
    throw new Error('careContext.careContextId is required.');
  }

  const symptoms = textOrNull(consultation.symptoms);
  const diagnosis = textOrNull(consultation.diagnosis);
  const authoredOn = toIsoDateTime(consultation.createdAt) || new Date().toISOString();
  const seed = `OPD:${consultation.id}:${careContextReference}`;

  const bundleId = stableUuid(`${seed}:bundle`);
  const compositionId = stableUuid(`${seed}:composition`);
  const patientId = stableUuid(`${seed}:patient`);
  const encounterId = stableUuid(`${seed}:encounter`);
  const symptomId = stableUuid(`${seed}:symptom`);
  const diagnosisId = stableUuid(`${seed}:diagnosis`);

  const patientResource = buildPatientResource({ patient, patientId });
  const encounterResource = buildEncounterResource({
    encounterId,
    patientId,
    authoredOn,
    careContextReference,
  });

  const sectionEntries = [{ reference: urnUuid(encounterId) }];
  const resources = [patientResource, encounterResource];

  if (symptoms) {
    resources.push(
      buildConditionResource({
        conditionId: symptomId,
        patientId,
        encounterId,
        text: symptoms,
        categoryCode: 'complaint',
        categoryDisplay: 'Complaint',
      })
    );
    sectionEntries.push({ reference: urnUuid(symptomId) });
  }

  if (diagnosis) {
    resources.push(
      buildConditionResource({
        conditionId: diagnosisId,
        patientId,
        encounterId,
        text: diagnosis,
        categoryCode: 'encounter-diagnosis',
        categoryDisplay: 'Encounter Diagnosis',
      })
    );
    sectionEntries.push({ reference: urnUuid(diagnosisId) });
  }

  const composition = buildComposition({
    compositionId,
    patientId,
    encounterId,
    authoredOn,
    careContextReference,
    sectionEntries,
  });

  return createDocumentBundle({
    bundleId,
    timestamp: authoredOn,
    identifier: {
      system: 'https://abdm.gov.in/care-context',
      value: careContextReference,
    },
    entries: [bundleEntry(composition), ...resources.map(bundleEntry)],
  });
}

async function buildOpdConsultationBundleFromConsultationId(consultationId) {
  const id = String(consultationId || '').trim();
  if (!id) {
    throw new Error('consultationId is required.');
  }

  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: { patient: true },
  });
  if (!consultation) {
    throw new Error(`Consultation not found: ${id}`);
  }

  const careContext = await prisma.abdmCareContext.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'CONSULTATION',
        sourceId: consultation.id,
      },
    },
  });

  return buildOpdConsultationBundle({
    patient: consultation.patient,
    consultation,
    careContext,
  });
}

module.exports = {
  buildOpdConsultationBundle,
  buildOpdConsultationBundleFromConsultationId,
};
