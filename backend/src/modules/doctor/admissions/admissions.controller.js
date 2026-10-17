const { prisma } = require('../../../config/prisma');

function cleanDiagnosisText(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  if (str.startsWith('Diagnosis:')) {
    str = str.substring('Diagnosis:'.length).trim();
  }
  return str;
}

function ymdFromDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function legacyIpdNumber(id, admissionDate, createdAt) {
  const when = admissionDate || createdAt || new Date();
  const ymd = ymdFromDate(when) || ymdFromDate(new Date());
  const hex = String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  return `IPD-${ymd}-${hex}`;
}

function resolvedIpdNumber(row) {
  const n = String(row?.ipdNumber || '').trim();
  if (n) return n;
  return legacyIpdNumber(row.id, row.admissionDate, row.createdAt);
}

async function getDoctorAdmissions(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  const admissions = await prisma.admission.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      ipdNumber: true,
      status: true,
      bedNumber: true,
      admissionDate: true,
      createdAt: true,
      patient: { select: { id: true, name: true, uhid: true } },
    },
  });

  return res.json({
    admissions: admissions.map((a) => ({
      id: a.id,
      ipd_number: resolvedIpdNumber(a),
      status: a.status,
      bed_number: a.bedNumber || null,
      admission_date: a.admissionDate || a.createdAt,
      createdAt: a.createdAt,
      patient_id: a.patient?.id,
      patient_name: a.patient?.name,
      uhid: a.patient?.uhid || null,
    })),
  });
}

async function getAdmissionById(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  const { id } = req.params;
  const admission = await prisma.admission.findUnique({
    where: { id },
    select: {
      id: true,
      ipdNumber: true,
      status: true,
      bedNumber: true,
      admissionDate: true,
      createdAt: true,
      doctorId: true,
      clinicalCondition: true,
      notesText: true,
      patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, basicHistory: true } },
    },
  });

  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doctor.id) return res.status(403).json({ message: 'Access denied' });

  return res.json({
    admission: {
      id: admission.id,
      ipd_number: resolvedIpdNumber(admission),
      status: admission.status,
      bed_number: admission.bedNumber || null,
      admission_date: admission.admissionDate || admission.createdAt,
      createdAt: admission.createdAt,
      patient_id: admission.patient?.id,
      patient_name: admission.patient?.name,
      uhid: admission.patient?.uhid || null,
      patient_age: typeof admission.patient?.age === 'number' ? admission.patient.age : null,
      patient_gender: admission.patient?.gender || null,
      basic_history: admission.patient?.basicHistory || null,
      clinical_condition: admission.clinicalCondition || null,
      clinicalCondition: admission.clinicalCondition || null,
      diagnosis: cleanDiagnosisText(admission.notesText) || null,
    },
  });
}

async function getAdmissionHistory(req, res) {
  try {
    const { id } = req.params;
    const admission = await prisma.admission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const [ipdNotes, nursingNotes, treatmentHistory, vitalsRecords] = await Promise.all([
      prisma.ipdNote.findMany({
        where: { admissionId: id },
        include: { doctor: { include: { user: { select: { name: true } } } } },
      }),
      prisma.nursingNote.findMany({
        where: { admissionId: id, showInHistory: true },
        include: { nurse: { select: { name: true } } },
      }),
      prisma.treatmentPlanHistory.findMany({
        where: { admissionId: id },
        include: { doctor: { include: { user: { select: { name: true } } } } },
      }),
      prisma.vitals.findMany({
        where: { admissionId: id },
      }),
    ]);

    const timeline = [];

    ipdNotes.forEach((n) => {
      timeline.push({
        id: n.id,
        type: 'DOCTOR_NOTE',
        title: 'Daily Note added by Doctor',
        authorName: n.doctor?.user?.name || 'Doctor',
        description: n.note,
        createdAt: n.createdAt,
      });
    });

    vitalsRecords.forEach((v) => {
      const parts = [];
      if (v.bp) parts.push(`BP: ${v.bp}`);
      if (v.temp != null) parts.push(`Temp: ${v.temp}°F`);
      if (v.pulse != null) parts.push(`Pulse: ${v.pulse}`);
      if (v.spo2 != null) parts.push(`SpO2: ${v.spo2}%`);
      if (v.oxygenTherapy) parts.push(`Oxygen Therapy: ${v.oxygenTherapy}`);

      timeline.push({
        id: v.id,
        type: 'VITALS',
        title: 'Vitals Recorded by Nurse',
        authorName: 'Nurse',
        description: parts.join(' | ') || 'Vitals checklist logged',
        createdAt: v.createdAt,
      });
    });

    nursingNotes.forEach((n) => {
      timeline.push({
        id: n.id,
        type: 'NURSE_NOTE',
        title: 'Nursing Note added by Nurse',
        authorName: n.nurse?.name || 'Nurse',
        description: n.notes,
        createdAt: n.createdAt,
      });
    });

    treatmentHistory.forEach((t) => {
      timeline.push({
        id: t.id,
        type: 'TREATMENT_PLAN',
        title: 'Treatment Plan updated by Doctor',
        authorName: t.doctor?.user?.name || 'Doctor',
        description: t.description,
        instructions: t.instructions,
        medicines: t.medicines,
        createdAt: t.createdAt,
      });
    });

    timeline.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ timeline });
  } catch (err) {
    console.error('getAdmissionHistory error:', err);
    return res.status(500).json({ message: 'Failed to load admission history' });
  }
}

module.exports = { getDoctorAdmissions, getAdmissionById, getAdmissionHistory };

