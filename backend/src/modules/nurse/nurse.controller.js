const { prisma } = require('../../config/prisma');
const { releaseNurseAssignment } = require('../../lib/allocationWorkflow');

let admissionSupportsAssignedNurseCache;
function admissionSupportsAssignedNurse() {
  if (typeof admissionSupportsAssignedNurseCache === 'boolean') return admissionSupportsAssignedNurseCache;
  try {
    const fields = prisma?._runtimeDataModel?.models?.Admission?.fields || [];
    admissionSupportsAssignedNurseCache = fields.some((f) => f?.name === 'nurseId');
  } catch {
    admissionSupportsAssignedNurseCache = false;
  }
  return admissionSupportsAssignedNurseCache;
}

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

function admissionWorkflowLabel(status) {
  const v = String(status || '').toUpperCase();
  if (v === 'UNDER_TREATMENT') return 'Under Treatment';
  if (v === 'READY_FOR_DISCHARGE') return 'Ready for Discharge';
  if (v === 'DISCHARGE_REQUESTED') return 'Discharge Requested';
  return 'Admitted';
}

function conditionLabel(c) {
  const v = String(c || '').toUpperCase();
  return v === 'CRITICAL' ? 'Critical' : 'Stable';
}

function wardCategoryLabel(wardType) {
  const v = String(wardType || '').toUpperCase();
  if (v === 'ICU') return 'ICU';
  if (v === 'PRIVATE') return 'Private';
  return 'General';
}

function wardDisplayName(ward) {
  if (!ward) return '';
  const cat = wardCategoryLabel(ward.type);
  const name = normalizeString(ward.name);
  return name ? `${name} (${cat})` : cat;
}

const ACTIVE_STATUSES = ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'];

function parseIntLoose(v) {
  const m = String(v ?? '').match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatLoose(v) {
  const m = String(v ?? '').match(/[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function cleanDiagnosisText(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  if (str.startsWith('Diagnosis:')) {
    str = str.substring('Diagnosis:'.length).trim();
  }
  return str;
}

async function assertNurseAdmissionAccess(req, admission) {
  const userId = req.user?.userId;
  if (!userId) return { ok: false, status: 401, message: 'Access token required' };
  if (!admission) return { ok: false, status: 404, message: 'Admission not found' };
  if (!admissionSupportsAssignedNurse()) return { ok: false, status: 404, message: 'Admission not found' };
  if (normalizeString(admission.nurseId) === normalizeString(userId)) {
    return { ok: true };
  }
  const count = await prisma.allocationRequest.count({
    where: {
      admissionId: admission.id,
      assignedToId: userId,
      status: 'APPROVED',
    },
  });
  if (count > 0) {
    return { ok: true };
  }
  return { ok: false, status: 403, message: 'Not assigned to this admission' };
}

const admissionListSelect = {
  id: true,
  admissionDate: true,
  status: true,
  clinicalCondition: true,
  dischargeRequestedAt: true,
  notesText: true,
  nurseId: true,
  patient: { select: { id: true, name: true, uhid: true, age: true, gender: true } },
  ward: { select: { name: true, type: true } },
  bed: { select: { code: true } },
  doctor: { select: { user: { select: { name: true } } } },
  nurse: { select: { name: true, email: true } },
};

function mapAdmissionRow(a, allocs = []) {
  const wardType = a.ward?.type || null;
  const wardCat = wardCategoryLabel(wardType);
  const cond = conditionLabel(a.clinicalCondition);
  const statusUpper = String(a.status || '').toUpperCase();

  let nurseName = a.nurse?.name || a.nurse?.email || '';
  if (allocs.length > 0) {
    const formatted = allocs.map(al => `${al.assignedToName} (${al.assignedShift || 'All'})`);
    nurseName = [...new Set(formatted)].join(', ');
  }

  return {
    id: a.id,
    admissionId: a.id,
    patientId: a.patient?.id || null,
    name: a.patient?.name || '',
    uhid: a.patient?.uhid || '',
    age: a.patient?.age ?? null,
    gender: a.patient?.gender ? String(a.patient.gender) : '',
    ward: wardDisplayName(a.ward),
    wardName: a.ward?.name || '',
    wardType: wardCat,
    wardTypeRaw: wardType,
    bed: a.bed?.code || '',
    doctor: a.doctor?.user?.name || '',
    nurseName,
    admissionDate: a.admissionDate,
    admissionStatus: admissionWorkflowLabel(a.status),
    admissionStatusRaw: a.status,
    condition: cond,
    diagnosis: cleanDiagnosisText(a.notesText) || '—',
    /** Table "Status" column: clinical stability */
    status: cond,
    dischargeRequestedAt: a.dischargeRequestedAt || null,
    dischargeApproved: statusUpper === 'DISCHARGE_REQUESTED',
  };
}

async function listMyPatients(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  if (!admissionSupportsAssignedNurse()) return res.json({ items: [] });

  const pendingOtRows = await prisma.otRequest.findMany({
    where: {
      nurseId: userId,
      preOperativeAssessment: null,
      status: { notIn: ['COMPLETED'] },
    },
    select: { ipdId: true },
  });
  const pendingOtAdmissionIds = new Set(pendingOtRows.map((r) => r.ipdId).filter(Boolean));

  const allOtRows = await prisma.otRequest.findMany({
    where: {
      nurseId: userId,
      status: { notIn: ['COMPLETED'] },
    },
    select: { ipdId: true },
  });
  const allOtAdmissionIds = new Set(allOtRows.map((r) => r.ipdId).filter(Boolean));

  const activeAllocations = await prisma.allocationRequest.findMany({
    where: {
      assignedToId: userId,
      status: 'APPROVED',
    },
    select: { admissionId: true },
  });
  const allocatedAdmissionIds = activeAllocations.map((a) => a.admissionId).filter(Boolean);

  const rows = await prisma.admission.findMany({
    where: {
      OR: [
        { nurseId: userId },
        { id: { in: allocatedAdmissionIds } }
      ],
      status: { in: ACTIVE_STATUSES },
      dischargeDate: null,
    },
    orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
    take: 300,
    select: admissionListSelect,
  });

  const seenIds = new Set(rows.map((a) => a.id));
  const recoveryLinks = await prisma.recoveryRecord.findMany({
    where: { assignedNurseId: userId, dischargedAt: null },
    select: {
      surgerySession: {
        select: { surgerySchedule: { select: { otRequest: { select: { ipdId: true } } } } },
      },
    },
  });
  const extraIds = [
    ...new Set(
      recoveryLinks
        .map((r) => r.surgerySession?.surgerySchedule?.otRequest?.ipdId)
        .filter((id) => id && !seenIds.has(id))
    ),
  ];
  if (extraIds.length) {
    const extra = await prisma.admission.findMany({
      where: { id: { in: extraIds }, status: { in: ACTIVE_STATUSES }, dischargeDate: null },
      select: admissionListSelect,
    });
    for (const a of extra) {
      seenIds.add(a.id);
      rows.push(a);
    }
  }

  const admissionIds = rows.map((r) => r.id);
  const allApprovedAllocations = await prisma.allocationRequest.findMany({
    where: {
      admissionId: { in: admissionIds },
      status: 'APPROVED',
      assignedToId: { not: null },
    },
    select: { admissionId: true, assignedToName: true, assignedShift: true },
  });

  const allocationsByAdmission = {};
  for (const alloc of allApprovedAllocations) {
    if (!allocationsByAdmission[alloc.admissionId]) {
      allocationsByAdmission[alloc.admissionId] = [];
    }
    allocationsByAdmission[alloc.admissionId].push(alloc);
  }

  // Find which admissions have been through OT recovery (already had surgery)
  const recoveryRecordAdmissionIds = new Set(
    (
      await prisma.recoveryRecord.findMany({
        where: {
          surgerySession: {
            surgerySchedule: {
              otRequest: { ipdId: { in: [...seenIds] } },
            },
          },
        },
        select: {
          surgerySession: {
            select: {
              surgerySchedule: {
                select: { otRequest: { select: { ipdId: true } } },
              },
            },
          },
        },
      })
    )
      .map((r) => r.surgerySession?.surgerySchedule?.otRequest?.ipdId)
      .filter(Boolean)
  );

  return res.json({
    items: rows.map((a) => {
      const allocs = allocationsByAdmission[a.id] || [];
      return {
        ...mapAdmissionRow(a, allocs),
        otPendingAssessment: pendingOtAdmissionIds.has(a.id),
        hasOtRequest: allOtAdmissionIds.has(a.id),
        hasRecoveryRecord: recoveryRecordAdmissionIds.has(a.id),
      };
    }),
  });
}

const admissionDetailInclude = {
  patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, mobile: true, bloodGroup: true } },
  doctor: { select: { user: { select: { name: true } } } },
  ward: { select: { id: true, name: true, type: true } },
  bed: { select: { id: true, code: true } },
  vitalsRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
  nursingNotes: {
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, notes: true, createdAt: true, nurseId: true, nurse: { select: { name: true } } },
  },
  treatmentPlan: {
    select: { id: true, description: true, medicines: true, instructions: true, updatedAt: true },
  },
};

/** When DB migration for `nurseCareData` is not applied yet, selecting it on the main query breaks the whole endpoint. */
async function trySelectNurseCareData(admissionId) {
  try {
    const row = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { nurseCareData: true },
    });
    if (row?.nurseCareData != null && typeof row.nurseCareData === 'object') return row.nurseCareData;
    return null;
  } catch {
    return null;
  }
}

async function getPatientByAdmission(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.params.admissionId);
  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: {
      ...admissionDetailInclude,
      id: true,
      admissionDate: true,
      status: true,
      clinicalCondition: true,
      notesText: true,
      nurseId: true,
      dischargeDate: true,
    },
  });

  const gate = await assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  const latest = admission.vitalsRecords?.[0] || null;
  const vitals = latest
    ? {
        bp: latest.bp || '',
        temperature:
          latest.temp != null && Number.isFinite(latest.temp) ? `${latest.temp}°F` : '',
        pulse: latest.pulse != null ? String(latest.pulse) : '',
        oxygen:
          latest.oxygenTherapy ||
          (latest.spo2 != null && Number.isFinite(latest.spo2) ? `${latest.spo2}%` : ''),
        spo2: latest.spo2,
      }
    : { bp: '', temperature: '', pulse: '', oxygen: '', spo2: null };

  const notes = (admission.nursingNotes || []).map((n) => ({
    id: n.id,
    nurseId: n.nurseId,
    nurseName: n.nurse?.name || '',
    text: n.notes,
    date: new Date(n.createdAt).toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    createdAt: n.createdAt,
  }));

  const wardType = admission.ward?.type || null;

  const tp = admission.treatmentPlan;
  const treatmentPlan = tp
    ? {
        id: tp.id,
        description: tp.description || '',
        instructions: tp.instructions || '',
        medicines: Array.isArray(tp.medicines) ? tp.medicines : [],
        updatedAt: tp.updatedAt,
      }
    : null;

  const nurseCarePayload = await trySelectNurseCareData(admissionId);

  return res.json({
    admission: {
      id: admission.id,
      admissionDate: admission.admissionDate,
      admissionStatus: admissionWorkflowLabel(admission.status),
      admissionStatusRaw: admission.status,
      clinicalCondition: conditionLabel(admission.clinicalCondition),
      clinicalConditionRaw: admission.clinicalCondition,
      diagnosis: cleanDiagnosisText(admission.notesText),
    },
    patient: {
      id: admission.patient?.id,
      name: admission.patient?.name || '',
      uhid: admission.patient?.uhid || '',
      age: admission.patient?.age ?? null,
      gender: admission.patient?.gender ? String(admission.patient.gender) : '',
      mobile: admission.patient?.mobile || '',
      bloodGroup: admission.patient?.bloodGroup ? String(admission.patient.bloodGroup) : '',
    },
    doctor: admission.doctor?.user?.name || '',
    bed: admission.bed?.code || '',
    ward: wardDisplayName(admission.ward),
    wardName: admission.ward?.name || '',
    wardType: wardCategoryLabel(wardType),
    wardTypeRaw: wardType,
    vitals,
    notes,
    nurseCare: nurseCarePayload,
    treatmentPlan,
  });
}

async function putNurseCareData(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.body?.admissionId);
  const nurseCare = req.body?.nurseCare;
  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });
  if (nurseCare != null && typeof nurseCare !== 'object') {
    return res.status(400).json({ message: 'nurseCare must be an object' });
  }

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, nurseId: true, dischargeDate: true },
  });
  const gate = await assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  try {
    const updated = await prisma.admission.update({
      where: { id: admissionId },
      data: { nurseCareData: nurseCare },
      select: { id: true, nurseCareData: true },
    });

    return res.json({
      nurseCare: updated.nurseCareData && typeof updated.nurseCareData === 'object' ? updated.nurseCareData : null,
    });
  } catch (err) {
    console.error('putNurseCareData', err);
    return res.status(503).json({
      message:
        'Saving nursing clinical data failed. If this is a fresh deploy, run database migrations (adds Admission.nurseCareData): npx prisma migrate deploy',
    });
  }
}

async function postVitals(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.body?.admissionId);
  const bp = normalizeString(req.body?.bp);
  const tempRaw = req.body?.temp;
  const pulseRaw = req.body?.pulse;
  let spo2Raw = req.body?.spo2;
  let oxygenTherapy = normalizeString(req.body?.oxygenTherapy) || null;
  const oxygenUi = normalizeString(req.body?.oxygen);
  if (spo2Raw === '' || spo2Raw == null) {
    const m = oxygenUi.match(/^\s*(\d{2,3})\s*%/);
    if (m) spo2Raw = parseInt(m[1], 10);
  }
  if (!oxygenTherapy && oxygenUi) oxygenTherapy = oxygenUi;

  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });
  if (!bp) return res.status(400).json({ message: 'bp is required' });

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, nurseId: true, dischargeDate: true },
  });
  const gate = await assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  const temp = tempRaw === '' || tempRaw == null ? null : parseFloatLoose(tempRaw);
  const pulse = pulseRaw === '' || pulseRaw == null ? null : parseIntLoose(pulseRaw);
  const spo2 = spo2Raw === '' || spo2Raw == null ? null : parseIntLoose(spo2Raw);

  const row = await prisma.vitals.create({
    data: {
      admissionId,
      bp,
      temp: temp != null && Number.isFinite(temp) ? temp : null,
      pulse: pulse != null && Number.isFinite(pulse) ? pulse : null,
      spo2: spo2 != null && Number.isFinite(spo2) ? spo2 : null,
      oxygenTherapy,
    },
    select: { id: true, createdAt: true },
  });

  return res.status(201).json({ vitals: row });
}

function mapVitalsRow(v) {
  if (!v) return null;
  return {
    id: v.id,
    admissionId: v.admissionId,
    bp: v.bp || '',
    temp: v.temp,
    pulse: v.pulse,
    spo2: v.spo2,
    oxygenTherapy: v.oxygenTherapy || null,
    createdAt: v.createdAt,
  };
}

async function assertDoctorAdmissionAccess(req, admission) {
  const userId = req.user?.userId;
  if (!userId) return { ok: false, status: 401, message: 'Access token required' };
  if (!admission) return { ok: false, status: 404, message: 'Admission not found' };

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return { ok: false, status: 404, message: 'Doctor profile not found' };
  if (normalizeString(admission.doctorId) !== normalizeString(doctor.id)) {
    return { ok: false, status: 403, message: 'Access denied' };
  }
  return { ok: true };
}

async function getVitalsHistoryByAdmission(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.params?.admissionId);
  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, nurseId: true, doctorId: true, dischargeDate: true },
  });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });

  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'NURSE') {
    const gate = await assertNurseAdmissionAccess(req, admission);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  } else if (role === 'DOCTOR') {
    const gate = await assertDoctorAdmissionAccess(req, admission);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  } else {
    return res.status(403).json({ message: 'Access denied' });
  }

  const rows = await prisma.vitals.findMany({
    where: { admissionId },
    orderBy: [{ createdAt: 'desc' }],
    take: 500,
    select: {
      id: true,
      admissionId: true,
      bp: true,
      temp: true,
      pulse: true,
      spo2: true,
      oxygenTherapy: true,
      createdAt: true,
    },
  });

  const history = rows.map(mapVitalsRow).filter(Boolean);
  const latest = history.length ? history[0] : null;

  return res.json({ latest, history });
}

async function postNursingNote(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.body?.admissionId);
  const notes = normalizeString(req.body?.notes);
  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });
  if (!notes) return res.status(400).json({ message: 'notes is required' });

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, nurseId: true, dischargeDate: true },
  });
  const gate = await assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  const showInHistory = req.body?.showInHistory !== false;

  const row = await prisma.nursingNote.create({
    data: { admissionId, nurseId: userId, notes, showInHistory },
    select: { id: true, createdAt: true },
  });

  return res.status(201).json({ note: row });
}

async function putClinicalCondition(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.body?.admissionId);
  const conditionRaw = normalizeString(req.body?.condition).toUpperCase();
  const diagnosis = normalizeString(req.body?.diagnosis);

  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });
  if (!['CRITICAL', 'STABLE'].includes(conditionRaw)) {
    return res.status(400).json({ message: 'condition must be critical or stable' });
  }

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, nurseId: true, dischargeDate: true, notesText: true },
  });
  const gate = await assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  const data = {
    clinicalCondition: conditionRaw,
    ...(diagnosis !== undefined ? { notesText: diagnosis || null } : {}),
  };

  const updated = await prisma.admission.update({
    where: { id: admissionId },
    data,
    select: { id: true, clinicalCondition: true, notesText: true },
  });

  return res.json({
    admission: {
      id: updated.id,
      clinicalCondition: conditionLabel(updated.clinicalCondition),
      clinicalConditionRaw: updated.clinicalCondition,
      diagnosis: cleanDiagnosisText(updated.notesText),
    },
  });
}

async function listRecentNursingNotes(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  if (!admissionSupportsAssignedNurse()) return res.json({ items: [] });

  const rows = await prisma.nursingNote.findMany({
    where: {
      admission: {
        nurseId: userId,
        status: { in: ACTIVE_STATUSES },
        dischargeDate: null,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      notes: true,
      createdAt: true,
      nurseId: true,
      nurse: { select: { name: true } },
      admission: {
        select: {
          id: true,
          patient: { select: { id: true, name: true } },
        },
      },
    },
  });

  return res.json({
    items: rows.map((r) => ({
      id: r.id,
      text: r.notes,
      createdAt: r.createdAt,
      nurseId: r.nurseId,
      nurseName: r.nurse?.name || '',
      admissionId: r.admission?.id || null,
      patientId: r.admission?.patient?.id || null,
      patientName: r.admission?.patient?.name || '',
    })),
  });
}

async function putNursingNote(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const noteId = normalizeString(req.params?.noteId);
  const notes = normalizeString(req.body?.notes);
  if (!noteId) return res.status(400).json({ message: 'noteId is required' });
  if (!notes) return res.status(400).json({ message: 'notes is required' });

  const existing = await prisma.nursingNote.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      nurseId: true,
      admission: { select: { id: true, nurseId: true, dischargeDate: true } },
    },
  });
  if (!existing) return res.status(404).json({ message: 'Note not found' });
  if (normalizeString(existing.nurseId) !== normalizeString(userId)) {
    return res.status(403).json({ message: 'You can only edit your own notes' });
  }
  const gate = await assertNurseAdmissionAccess(req, existing.admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (existing.admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  const updated = await prisma.nursingNote.update({
    where: { id: noteId },
    data: { notes },
    select: { id: true, notes: true, createdAt: true },
  });

  return res.json({
    note: {
      id: updated.id,
      text: updated.notes,
      createdAt: updated.createdAt,
      date: new Date(updated.createdAt).toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  });
}

async function deleteNursingNote(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const noteId = normalizeString(req.params?.noteId);
  if (!noteId) return res.status(400).json({ message: 'noteId is required' });

  const existing = await prisma.nursingNote.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      nurseId: true,
      admission: { select: { id: true, nurseId: true, dischargeDate: true } },
    },
  });
  if (!existing) return res.status(404).json({ message: 'Note not found' });
  if (normalizeString(existing.nurseId) !== normalizeString(userId)) {
    return res.status(403).json({ message: 'You can only delete your own notes' });
  }
  const gate = await assertNurseAdmissionAccess(req, existing.admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (existing.admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  await prisma.nursingNote.delete({ where: { id: noteId } });
  return res.status(204).send();
}

async function getDoctorUpdatesForAdmission(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.params.admissionId);
  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: {
      id: true,
      nurseId: true,
      dischargeDate: true,
      doctor: { select: { user: { select: { name: true } } } },
    },
  });

  const gate = await assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  const treatingDoctorName = admission.doctor?.user?.name || '';

  const [notes, treatmentRow] = await Promise.all([
    prisma.ipdNote.findMany({
      where: { admissionId },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        note: true,
        createdAt: true,
        doctor: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.treatmentPlan.findUnique({
      where: { admissionId },
      select: {
        id: true,
        description: true,
        instructions: true,
        medicines: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const dailyNotes = notes.map((n) => ({
    id: n.id,
    note: n.note,
    createdAt: n.createdAt,
    doctorName: n.doctor?.user?.name || treatingDoctorName || 'Doctor',
  }));

  const treatmentPlan = treatmentRow
    ? {
        id: treatmentRow.id,
        description: treatmentRow.description || '',
        instructions: treatmentRow.instructions || '',
        medicines: Array.isArray(treatmentRow.medicines) ? treatmentRow.medicines : [],
        createdAt: treatmentRow.createdAt,
        updatedAt: treatmentRow.updatedAt,
        doctorName: treatingDoctorName || 'Doctor',
      }
    : null;

  return res.json({
    treatingDoctorName,
    dailyNotes,
    treatmentPlan,
  });
}

async function putDischargeApprove(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });
  const admissionId = normalizeString(req.body?.admissionId);
  if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, nurseId: true, dischargeDate: true, clinicalCondition: true, status: true, dischargeRequestedAt: true },
  });
  const gate = await assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  if (String(admission.clinicalCondition || '').toUpperCase() !== 'STABLE') {
    return res.status(400).json({ message: 'Discharge approval allowed only when patient is stable' });
  }

  if (String(admission.status || '').toUpperCase() === 'DISCHARGE_REQUESTED') {
    return res.json({
      admission: {
        id: admission.id,
        status: 'DISCHARGE_REQUESTED',
        dischargeRequestedAt: admission.dischargeRequestedAt,
      },
    });
  }

  const now = new Date();
  const updated = await prisma.admission.update({
    where: { id: admissionId },
    data: { status: 'DISCHARGE_REQUESTED', dischargeRequestedAt: now },
    select: { id: true, status: true, dischargeRequestedAt: true },
  });

  return res.json({
    admission: { id: updated.id, status: updated.status, dischargeRequestedAt: updated.dischargeRequestedAt },
  });
}

// ─── OT Request ───────────────────────────────────────────────────────────────

async function generateOtRequestNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `OT-${y}${m}${d}-`;
  const last = await prisma.otRequest.findFirst({
    where: { requestNumber: { startsWith: prefix } },
    orderBy: { requestNumber: 'desc' },
    select: { requestNumber: true },
  });
  let seq = 1;
  if (last) {
    const parts = last.requestNumber.split('-');
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function createOtRequest(req, res) {
  try {
    const nurseId = req.user.userId;
    const { admissionId, diagnosis, surgeryRecommendation, priority, expectedSurgeryDate, notes } = req.body;

    if (!admissionId) {
      return res.status(400).json({ message: 'admissionId is required' });
    }

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: { patient: { select: { id: true, uhid: true, name: true } } },
    });
    if (!admission) return res.status(404).json({ message: 'Admission not found' });
    if (!['ADMITTED', 'UNDER_TREATMENT'].includes(admission.status)) {
      return res.status(400).json({ message: 'Patient must be currently admitted' });
    }

    const existing = await prisma.otRequest.findFirst({
      where: { ipdId: admissionId, status: { notIn: ['COMPLETED'] } },
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
      },
    });
    if (existing) {
      return res.status(200).json({ otRequest: existing, alreadyExists: true });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const resolvedDiagnosis = (diagnosis || admission.notesText || 'Not specified').trim();
    const resolvedSurgery = (surgeryRecommendation || 'Pending pre-assessment').trim();
    const resolvedDate = expectedSurgeryDate ? new Date(expectedSurgeryDate) : tomorrow;

    const requestNumber = await generateOtRequestNumber();

    const otRequest = await prisma.otRequest.create({
      data: {
        requestNumber,
        patientId: admission.patient.id,
        uhid: admission.patient.uhid || '',
        ipdId: admissionId,
        doctorId: admission.doctorId,
        nurseId,
        diagnosis: resolvedDiagnosis,
        surgeryRecommendation: resolvedSurgery,
        priority: priority || 'Normal',
        expectedSurgeryDate: resolvedDate,
        notes: notes || null,
        status: 'OT_REQUEST_CREATED',
        statusHistory: {
          create: { status: 'OT_REQUEST_CREATED', changedBy: nurseId },
        },
      },
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
      },
    });

    // Reception is notified after pre-operative assessment is submitted (see assessment.controller.js)

    // Activity log
    try {
      const { createActivityLog } = require('../../utils/activityLog');
      await createActivityLog({ userId: nurseId, action: 'CREATE_OT_REQUEST', module: 'OT' });
    } catch { /* best-effort */ }

    return res.status(201).json({ otRequest });
  } catch (err) {
    console.error('createOtRequest error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function listMyOtRequests(req, res) {
  try {
    const nurseId = req.user.userId;
    const { status, page = 1, limit = 20, pendingAssessment } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const where = { nurseId };
    if (status) where.status = status;
    if (String(pendingAssessment).toLowerCase() === 'true') {
      where.preOperativeAssessment = null;
      where.status = { notIn: ['COMPLETED'] };
    }

    const [items, total] = await Promise.all([
      prisma.otRequest.findMany({
        where,
        skip,
        take: Math.min(100, Math.max(1, Number(limit))),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, uhid: true, age: true, gender: true } },
          doctor: { select: { id: true, user: { select: { name: true } } } },
          admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
          statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
          preOperativeAssessment: { select: { id: true, createdAt: true } },
        },
      }),
      prisma.otRequest.count({ where }),
    ]);

    return res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('listMyOtRequests error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getOtRequestByAdmission(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { admissionId } = req.params;

    const otRequest = await prisma.otRequest.findFirst({
      where: { ipdId: admissionId },
      include: {
        preOperativeAssessment: {
          include: { assessedBy: { select: { name: true } } },
        },
        surgerySchedule: {
          select: {
            id: true, surgeryDate: true, startTime: true, estimatedDuration: true, status: true, rescheduledAt: true, rescheduleReason: true,
            otRoom: { select: { roomName: true } },
            surgerySession: {
              select: {
                id: true, startTime: true, endTime: true, status: true,
                postSurgeryNote: true,
                recoveryRecord: {
                  select: {
                    id: true, status: true, bpSystolic: true, bpDiastolic: true, pulse: true, temperature: true, spo2: true, respiratoryRate: true, painScore: true, consciousnessLevel: true, surgicalSiteAssessment: true, postAnaesthesiaMonitoring: true, recoveryNotes: true, admittedAt: true, dischargedAt: true, transferredTo: true, transferredAt: true,
                    assessments: { orderBy: { createdAt: 'desc' }, take: 1, include: { assessedBy: { select: { name: true } } } },
                    transfers: { orderBy: { createdAt: 'desc' }, take: 5 },
                    timeline: { orderBy: { createdAt: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return res.json({ otRequest: otRequest || null });
  } catch (err) {
    console.error('getOtRequestByAdmission error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function completePatientCare(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { admissionId } = req.params;

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, nurseId: true },
    });
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const allocations = await prisma.allocationRequest.findMany({
      where: { admissionId, assignedToId: userId, status: { notIn: ['COMPLETED', 'REJECTED'] } },
    });

    if (admission.nurseId !== userId && allocations.length === 0) {
      return res.status(403).json({ message: 'Not your patient' });
    }

    for (const allocation of allocations) {
      await prisma.allocationRequest.update({
        where: { id: allocation.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await prisma.allocationRequestHistory.create({
        data: {
          requestId: allocation.id,
          action: 'ALLOCATION_COMPLETED',
          userId,
          userName: req.user?.name || 'Nurse',
          details: JSON.stringify({ initiatedBy: 'NURSE', admissionId }),
        },
      });
      await releaseNurseAssignment(prisma, allocation);
    }

    if (!allocations.length) {
      await prisma.admission.update({
        where: { id: admissionId },
        data: { nurseId: null },
      });
    }

    return res.json({ message: 'Patient care marked as complete.' });
  } catch (err) {
    console.error('completePatientCare error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── OT Patients (post-surgery, assigned to this nurse) ───

async function listOtPatients(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const items = await prisma.recoveryRecord.findMany({
      where: { assignedNurseId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        surgerySession: {
          include: {
            surgerySchedule: {
              include: {
                otRequest: {
                  include: { patient: { select: { name: true, uhid: true, age: true, gender: true } } },
                },
                otRoom: { select: { roomName: true, roomNumber: true } },
                surgeon: { select: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });

    return res.json({ items });
  } catch (err) {
    console.error('listOtPatients error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getOtPatientDetail(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    console.log('[DEBUG] getOtPatientDetail id:', id, 'userId:', userId);

    const record = await prisma.recoveryRecord.findUnique({
      where: { id },
      include: {
        surgerySession: {
          include: {
            surgerySchedule: {
              include: {
                otRequest: {
                  include: {
                    patient: { select: { name: true, uhid: true, age: true, gender: true, bloodGroup: true, mobile: true, address: true } },
                    preOperativeAssessment: true,
                    admission: { select: { id: true, ipdNumber: true, status: true, clinicalCondition: true, dischargeRequestedAt: true, dischargeDate: true } },
                  },
                },
                otRoom: { select: { roomName: true } },
                surgeon: { select: { user: { select: { name: true } } } },
              },
            },
            equipmentAllocations: { include: { equipment: { select: { equipmentName: true } } } },
            postSurgeryNote: true,
          },
        },
        assessments: { orderBy: { createdAt: 'desc' }, take: 50, include: { assessedBy: { select: { name: true } } } },
        transfers: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!record) return res.status(404).json({ message: 'Record not found' });

    // Fetch nursing notes for the admission
    const admissionId = record.surgerySession?.surgerySchedule?.otRequest?.admission?.id;
    let nursingNotes = [];
    if (admissionId) {
      nursingNotes = await prisma.nursingNote.findMany({
        where: { admissionId },
        orderBy: { createdAt: 'desc' },
        include: { nurse: { select: { name: true } } },
      });
    }

    return res.json({ record, nursingNotes });
  } catch (err) {
    console.error('getOtPatientDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getMyDuty(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const duty = await prisma.nurseDuty.findFirst({
      where: { nurseId: userId, dutyDate: today },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ duty });
  } catch (err) {
    console.error('getMyDuty error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Nurse Tasks ────────────────────────────────────────────────────────

async function listMyTasks(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { admissionId } = req.query;
    const where = { nurseId: userId };
    if (admissionId) where.admissionId = admissionId;
    const items = await prisma.nurseTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ items });
  } catch (err) {
    console.error('listMyTasks error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createTask(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { admissionId, patientId, patientName, task } = req.body;
    if (!admissionId || !patientId || !task) {
      return res.status(400).json({ message: 'admissionId, patientId, and task are required' });
    }
    const item = await prisma.nurseTask.create({
      data: { admissionId, patientId, patientName, task, nurseId: userId },
    });
    return res.status(201).json({ item });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function completeTask(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { id } = req.params;
    const item = await prisma.nurseTask.findFirst({ where: { id, nurseId: userId } });
    if (!item) return res.status(404).json({ message: 'Task not found' });
    const updated = await prisma.nurseTask.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return res.json({ item: updated });
  } catch (err) {
    console.error('completeTask error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteTask(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { id } = req.params;
    const item = await prisma.nurseTask.findFirst({ where: { id, nurseId: userId } });
    if (!item) return res.status(404).json({ message: 'Task not found' });
    await prisma.nurseTask.delete({ where: { id } });
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('deleteTask error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Doctor Orders ──────────────────────────────────────────────────────

async function listMyDoctorOrders(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { admissionId } = req.query;
    const where = { nurseId: userId };
    if (admissionId) where.admissionId = admissionId;
    const items = await prisma.doctorOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ items });
  } catch (err) {
    console.error('listMyDoctorOrders error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createDoctorOrder(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { admissionId, patientId, patientName, orderText } = req.body;
    if (!admissionId || !patientId || !orderText) {
      return res.status(400).json({ message: 'admissionId, patientId, and orderText are required' });
    }
    const item = await prisma.doctorOrder.create({
      data: { admissionId, patientId, patientName, orderText, nurseId: userId },
    });
    return res.status(201).json({ item });
  } catch (err) {
    console.error('createDoctorOrder error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function completeDoctorOrder(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { id } = req.params;
    const item = await prisma.doctorOrder.findFirst({ where: { id, nurseId: userId } });
    if (!item) return res.status(404).json({ message: 'Doctor order not found' });
    const updated = await prisma.doctorOrder.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return res.json({ item: updated });
  } catch (err) {
    console.error('completeDoctorOrder error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteDoctorOrder(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const { id } = req.params;
    const item = await prisma.doctorOrder.findFirst({ where: { id, nurseId: userId } });
    if (!item) return res.status(404).json({ message: 'Doctor order not found' });
    await prisma.doctorOrder.delete({ where: { id } });
    return res.json({ message: 'Doctor order deleted' });
  } catch (err) {
    console.error('deleteDoctorOrder error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── OT Assessments (pre + post for OT Done patients) ───────────────────

async function getOtAssessmentsByAdmission(req, res) {
  try {
    const { admissionId } = req.params;
    const otRequest = await prisma.otRequest.findFirst({
      where: { ipdId: admissionId },
      include: {
        preOperativeAssessment: {
          include: { assessedBy: { select: { name: true } } },
        },
        surgerySchedule: {
          include: {
            surgerySession: {
              include: {
                postSurgeryNote: true,
                recoveryRecord: {
                  include: {
                    assessments: {
                      include: { assessedBy: { select: { name: true } } },
                      orderBy: { createdAt: 'desc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!otRequest) return res.json({ preAssessment: null, postSurgery: null, recoveryAssessments: [] });
    return res.json({
      preAssessment: otRequest.preOperativeAssessment || null,
      postSurgery: otRequest.surgerySchedule?.surgerySession?.postSurgeryNote || null,
      recoveryAssessments: otRequest.surgerySchedule?.surgerySession?.recoveryRecord?.assessments || [],
    });
  } catch (err) {
    console.error('getOtAssessments error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── IPD Medicine Requests (nurse → pharmacy queue) ───────────────────
// Nurse-created IPD medicine requests reuse the existing PharmacyQueue so they
// appear automatically in the pharmacy's queue, but are linked to the admission.
const MED_REQ_STATUS_LABEL = {
  WAITING: 'Pending',
  IN_PROGRESS: 'Accepted',
  BILLED: 'Dispensed',
  CANCELLED: 'Cancelled',
};

function mapMedicineRequestRow(q) {
  return {
    id: q.id,
    tokenNumber: q.tokenNumber,
    status: q.status,
    statusLabel: MED_REQ_STATUS_LABEL[q.status] || q.status,
    sentAt: q.sentAt,
    createdAt: q.createdAt,
    billedBillId: q.billedBillId || null,
    items: (q.items || []).map((it) => ({
      id: it.id,
      medicineId: it.medicineId || null,
      medicineName: it.medicineName,
      dosage: it.dosage || '',
      frequency: it.frequency || '',
      duration: it.duration || '',
      quantity: it.quantity,
    })),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseMedicineRequestItems(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const it of raw) {
    if (!it) continue;
    const medicineName = normalizeString(it.medicineName || it.name);
    if (!medicineName) continue;
    const medicineIdRaw = normalizeString(it.medicineId);
    const qtyNum = parseInt(String(it.quantity ?? 1), 10);
    out.push({
      medicineId: UUID_RE.test(medicineIdRaw) ? medicineIdRaw : null,
      medicineName,
      dosage: normalizeString(it.dosage) || null,
      frequency: normalizeString(it.frequency) || null,
      duration: normalizeString(it.duration) || null,
      quantity: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1,
    });
  }
  return out;
}

async function createMedicineRequest(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const admissionId = normalizeString(req.body?.admissionId);
    if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });
    const items = parseMedicineRequestItems(req.body?.items);
    if (!items.length) return res.status(400).json({ message: 'At least one medicine is required' });

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, nurseId: true, dischargeDate: true, patientId: true, doctorId: true, ipdNumber: true },
    });
    const gate = await assertNurseAdmissionAccess(req, admission);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
    if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

    const ipd = normalizeString(admission.ipdNumber) || admissionId.slice(0, 8);
    const base = ipd.toUpperCase().startsWith('IPD') ? ipd : `IPD-${ipd}`;
    // Unique token per request so a single admission can raise multiple requests.
    const tokenNumber = `${base}-${Date.now().toString(36).toUpperCase()}`;

    const entry = await prisma.pharmacyQueue.create({
      data: {
        patientId: admission.patientId,
        doctorId: admission.doctorId || null,
        sentByReceptionistId: userId,
        admissionId: admission.id,
        tokenNumber,
        sentAt: new Date(),
        status: 'WAITING',
        items: {
          create: items.map((i) => ({
            medicineId: i.medicineId,
            medicineName: i.medicineName,
            dosage: i.dosage,
            frequency: i.frequency,
            duration: i.duration,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    });

    return res.status(201).json({ request: mapMedicineRequestRow(entry) });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'Duplicate request token — please retry' });
    }
    console.error('createMedicineRequest error:', err);
    return res.status(500).json({ message: 'Could not create medicine request' });
  }
}

async function listMedicineRequests(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const admissionId = normalizeString(req.params?.admissionId);
    if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, nurseId: true },
    });
    const gate = await assertNurseAdmissionAccess(req, admission);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const rows = await prisma.pharmacyQueue.findMany({
      where: { admissionId },
      orderBy: [{ sentAt: 'desc' }],
      include: { items: true },
    });
    return res.json({ items: rows.map(mapMedicineRequestRow) });
  } catch (err) {
    console.error('listMedicineRequests error:', err);
    return res.status(500).json({ message: 'Could not load medicine requests' });
  }
}

async function cancelMedicineRequest(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const id = normalizeString(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id is required' });

    const q = await prisma.pharmacyQueue.findUnique({
      where: { id },
      select: { id: true, status: true, admissionId: true, admission: { select: { nurseId: true } } },
    });
    if (!q || !q.admissionId) return res.status(404).json({ message: 'Medicine request not found' });
    const gate = await assertNurseAdmissionAccess(req, { id: q.admissionId, nurseId: q.admission?.nurseId });
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
    if (q.status !== 'WAITING') {
      return res.status(400).json({ message: 'Only pending requests can be cancelled' });
    }
    const updated = await prisma.pharmacyQueue.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });
    return res.json({ request: mapMedicineRequestRow(updated) });
  } catch (err) {
    console.error('cancelMedicineRequest error:', err);
    return res.status(500).json({ message: 'Could not cancel medicine request' });
  }
}

// ─── IPD Daily Expenses (nurse-entered, rolled into reception final bill) ───
async function createDailyExpense(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const admissionId = normalizeString(req.body?.admissionId);
    const description = normalizeString(req.body?.description);
    if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });
    if (!description) return res.status(400).json({ message: 'description is required' });

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, nurseId: true, dischargeDate: true },
    });
    const gate = await assertNurseAdmissionAccess(req, admission);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
    if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

    const category = normalizeString(req.body?.category) || null;
    const qtyNum = parseInt(String(req.body?.quantity ?? 1), 10);
    const quantity = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1;
    const priceNum = parseInt(String(req.body?.unitPrice ?? 0), 10);
    const unitPrice = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0;
    const amount = quantity * unitPrice;

    const row = await prisma.dailyExpense.create({
      data: { admissionId, nurseId: userId, description, category, quantity, unitPrice, amount },
    });
    return res.status(201).json({ expense: row });
  } catch (err) {
    console.error('createDailyExpense error:', err);
    return res.status(500).json({ message: 'Could not add daily expense' });
  }
}

async function listDailyExpenses(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const admissionId = normalizeString(req.params?.admissionId);
    if (!admissionId) return res.status(400).json({ message: 'admissionId is required' });

    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, nurseId: true },
    });
    const gate = await assertNurseAdmissionAccess(req, admission);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const rows = await prisma.dailyExpense.findMany({
      where: { admissionId },
      orderBy: [{ createdAt: 'desc' }],
    });
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    return res.json({ items: rows, total });
  } catch (err) {
    console.error('listDailyExpenses error:', err);
    return res.status(500).json({ message: 'Could not load daily expenses' });
  }
}

async function deleteDailyExpense(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
    const id = normalizeString(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id is required' });

    const row = await prisma.dailyExpense.findUnique({
      where: { id },
      select: { id: true, admissionId: true, admission: { select: { nurseId: true } } },
    });
    if (!row) return res.status(404).json({ message: 'Expense not found' });
    const gate = await assertNurseAdmissionAccess(req, { id: row.admissionId, nurseId: row.admission?.nurseId });
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    await prisma.dailyExpense.delete({ where: { id } });
    return res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('deleteDailyExpense error:', err);
    return res.status(500).json({ message: 'Could not delete expense' });
  }
}

module.exports = {
  listMyPatients,
  /** Alias for legacy route GET /api/nurse/ipd/assigned */
  listAssignedPatients: listMyPatients,
  createMedicineRequest,
  listMedicineRequests,
  cancelMedicineRequest,
  createDailyExpense,
  listDailyExpenses,
  deleteDailyExpense,
  getPatientByAdmission,
  getDoctorUpdatesForAdmission,
  getVitalsHistoryByAdmission,
  postVitals,
  postNursingNote,
  putNursingNote,
  deleteNursingNote,
  listRecentNursingNotes,
  putNurseCareData,
  putClinicalCondition,
  putDischargeApprove,
  createOtRequest,
  listMyOtRequests,
  getOtRequestByAdmission,
  listOtPatients,
  getOtPatientDetail,
  getMyDuty,
  completePatientCare,
  listMyTasks,
  createTask,
  completeTask,
  deleteTask,
  listMyDoctorOrders,
  createDoctorOrder,
  completeDoctorOrder,
  deleteDoctorOrder,
  getOtAssessmentsByAdmission,
};
