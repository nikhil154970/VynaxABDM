const { prisma } = require('../../config/prisma');

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

function assertNurseAdmissionAccess(req, admission) {
  const userId = req.user?.userId;
  if (!userId) return { ok: false, status: 401, message: 'Access token required' };
  if (!admission) return { ok: false, status: 404, message: 'Admission not found' };
  if (!admissionSupportsAssignedNurse()) return { ok: false, status: 404, message: 'Admission not found' };
  if (normalizeString(admission.nurseId) !== normalizeString(userId)) {
    return { ok: false, status: 403, message: 'Not assigned to this admission' };
  }
  return { ok: true };
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

function mapAdmissionRow(a) {
  const wardType = a.ward?.type || null;
  const wardCat = wardCategoryLabel(wardType);
  const cond = conditionLabel(a.clinicalCondition);
  const statusUpper = String(a.status || '').toUpperCase();
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
    nurseName: a.nurse?.name || a.nurse?.email || '',
    admissionDate: a.admissionDate,
    admissionStatus: admissionWorkflowLabel(a.status),
    admissionStatusRaw: a.status,
    condition: cond,
    diagnosis: a.notesText || '—',
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

  const rows = await prisma.admission.findMany({
    where: {
      nurseId: userId,
      status: { in: ACTIVE_STATUSES },
      dischargeDate: null,
    },
    orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
    take: 300,
    select: admissionListSelect,
  });

  return res.json({ items: rows.map(mapAdmissionRow) });
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

  const gate = assertNurseAdmissionAccess(req, admission);
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
      diagnosis: admission.notesText || '',
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
  const gate = assertNurseAdmissionAccess(req, admission);
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
  const gate = assertNurseAdmissionAccess(req, admission);
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
    const gate = assertNurseAdmissionAccess(req, admission);
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
  const gate = assertNurseAdmissionAccess(req, admission);
  if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is closed' });

  const row = await prisma.nursingNote.create({
    data: { admissionId, nurseId: userId, notes },
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
  const gate = assertNurseAdmissionAccess(req, admission);
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
      diagnosis: updated.notesText || '',
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
  const gate = assertNurseAdmissionAccess(req, existing.admission);
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
  const gate = assertNurseAdmissionAccess(req, existing.admission);
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

  const gate = assertNurseAdmissionAccess(req, admission);
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
  const gate = assertNurseAdmissionAccess(req, admission);
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

module.exports = {
  listMyPatients,
  /** Alias for legacy route GET /api/nurse/ipd/assigned */
  listAssignedPatients: listMyPatients,
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
};
