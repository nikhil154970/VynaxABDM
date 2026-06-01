const { prisma } = require('../../../config/prisma');

function pickPatientId(body) {
  return body?.patientId || body?.patient_id || body?.patient;
}

let labTestsSupportCache = null;
function consultationSupportsLabTests() {
  if (labTestsSupportCache != null) return labTestsSupportCache;
  try {
    const model = prisma?._runtimeDataModel?.models?.Consultation;
    if (!model) {
      labTestsSupportCache = false;
      return labTestsSupportCache;
    }
    const fields = Array.isArray(model.fields) ? model.fields : Object.values(model.fields || {});
    labTestsSupportCache = fields.some((f) => f && f.name === 'labTests');
    return labTestsSupportCache;
  } catch {
    labTestsSupportCache = false;
    return labTestsSupportCache;
  }
}

function normalizeLabTests(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    const testName = String(row?.testName || row?.name || '').trim();
    if (!testName) continue;
    const qtyN = Number(row?.quantity ?? 1);
    const quantity = Number.isFinite(qtyN) && qtyN > 0 ? Math.trunc(qtyN) : 1;
    const priceN = Number(row?.price ?? row?.unitPrice ?? 0);
    const price = Number.isFinite(priceN) && priceN >= 0 ? Math.trunc(priceN) : 0;
    const note = String(row?.note || row?.remarks || '').trim();
    out.push({ testName, quantity, price, note: note || null });
  }
  return out;
}

async function resolveManagedLabTestIds(rawIds) {
  const ids = Array.isArray(rawIds)
    ? rawIds.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const rows = await prisma.labTest.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true, name: true, price: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique
    .filter((id) => byId.has(id))
    .map((id) => {
      const r = byId.get(id);
      return {
        testId: r.id,
        testName: r.name,
        quantity: 1,
        price: Math.max(0, Math.round(Number(r.price) || 0)),
        note: null,
      };
    });
}

function normalizeWardType(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'ICU') return 'ICU';
  if (s === 'PRIVATE') return 'PRIVATE';
  if (s === 'GENERAL') return 'GENERAL';
  return null;
}

/** Names from Consultation.labTests JSON (array of { testName, … }). */
function labelsFromLabTestsJson(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    if (x && typeof x === 'object') {
      const n = x.testName || x.name || x.labTest || x.label;
      if (n) out.push(String(n).trim());
    }
  }
  return out.filter(Boolean);
}

/** Union of advised tests: labTests JSON, linked TestAdvice items, legacy prescription rows. */
function collectAdvisedLabTestNames(c) {
  if (!c) return [];
  const seen = new Set();
  const out = [];
  const add = (n) => {
    const s = String(n || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  for (const n of labelsFromLabTestsJson(c.labTests)) add(n);
  const items = c.testAdvice?.items;
  if (Array.isArray(items)) {
    for (const it of items) {
      const n = it?.test?.name;
      if (n) add(n);
    }
  }
  const rx = Array.isArray(c.prescription) ? c.prescription : [];
  for (const row of rx) {
    const lab = row?.labTest || row?.lab_test;
    if (lab) add(lab);
  }
  return out;
}

function consultationDetailSelect() {
  return {
    id: true,
    createdAt: true,
    symptoms: true,
    diagnosis: true,
    prescription: true,
    labTests: true,
    followUpDate: true,
    disposition: true,
    testAdvice: {
      select: {
        items: {
          select: {
            test: { select: { name: true } },
          },
        },
      },
    },
  };
}

function shapeConsultationForView(c) {
  if (!c) return null;
  const advisedLabTests = collectAdvisedLabTestNames(c);
  const { testAdvice, ...rest } = c;
  return { ...rest, advisedLabTests };
}

async function assertDoctorAssignment({ doctorId, patientId }) {
  const [hasAppointment, hasAdmission] = await Promise.all([
    prisma.appointment.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
    prisma.admission.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
  ]);
  return Boolean(hasAppointment || hasAdmission);
}

async function createConsultation(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  const patientId = pickPatientId(req.body);
  const symptoms = String(req.body?.symptoms || '').trim();
  const diagnosis = String(req.body?.diagnosis || '').trim();
  const prescription = req.body?.prescription;
  const testsRaw = req.body?.selected_tests ?? req.body?.tests ?? req.body?.test_ids;
  const labTests = Array.isArray(testsRaw)
    ? await resolveManagedLabTestIds(testsRaw)
    : normalizeLabTests(req.body?.labTests ?? req.body?.lab_tests);
  const canPersistLabTests = consultationSupportsLabTests();
  const followUpDateRaw = req.body?.follow_up_date ?? req.body?.followUpDate ?? null;
  const appointmentId = req.body?.appointment_id ?? req.body?.appointmentId ?? null;
  const dispositionRaw = String(req.body?.disposition || '').trim().toUpperCase();
  const disposition = dispositionRaw === 'REFER_ADMIT' ? 'REFER_ADMIT' : 'NORMAL';
  const suggestedWardTypeRaw =
    req.body?.suggestedWardType ?? req.body?.suggested_ward_type ?? req.body?.suggestedWard ?? req.body?.suggested_ward;
  const suggestedWardType = normalizeWardType(suggestedWardTypeRaw);

  if (!patientId) return res.status(400).json({ message: 'patient_id is required' });
  if (!symptoms) return res.status(400).json({ message: 'symptoms is required' });
  if (!diagnosis) return res.status(400).json({ message: 'diagnosis is required' });
  if (!Array.isArray(prescription)) return res.status(400).json({ message: 'prescription must be an array' });

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const assigned = await assertDoctorAssignment({ doctorId: doctor.id, patientId });
  if (!assigned) return res.status(403).json({ message: 'Patient is not assigned to this doctor' });

  const followUpDate = followUpDateRaw ? new Date(followUpDateRaw) : null;
  if (followUpDateRaw && Number.isNaN(followUpDate.getTime())) {
    return res.status(400).json({ message: 'follow_up_date must be a valid date' });
  }

  let verifiedAppointmentId = null;
  if (appointmentId) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, doctorId: true, patientId: true },
    });
    if (appt && appt.doctorId === doctor.id && appt.patientId === patientId) {
      verifiedAppointmentId = appt.id;
    }
  }

  const safePrescription = Array.isArray(prescription) ? prescription : [];
  const normalizedPrescription = safePrescription.map((row) => {
    if (!row || typeof row !== 'object') return row;
    if (!Object.prototype.hasOwnProperty.call(row, 'mode')) return row;
    const mode = String(row.mode || '').trim();
    return { ...row, mode: mode || null };
  });
  const prescriptionWithFallbackLabTests =
    !canPersistLabTests && labTests.length
      ? [
          ...normalizedPrescription,
          ...labTests.map((t) => ({ labTest: t.testName, quantity: 1, price: 0 })),
        ]
      : normalizedPrescription;

  const consultation = await prisma.$transaction(async (tx) => {
    const c = await tx.consultation.create({
      data: {
        doctorId: doctor.id,
        patientId,
        appointmentId: verifiedAppointmentId,
        symptoms,
        diagnosis,
        prescription: prescriptionWithFallbackLabTests,
        ...(canPersistLabTests ? { labTests: labTests.length ? labTests : null } : {}),
        followUpDate,
        disposition,
        ...(disposition === 'REFER_ADMIT' && suggestedWardType ? { suggestedWardType } : {}),
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        appointmentId: true,
        symptoms: true,
        diagnosis: true,
        prescription: true,
        ...(canPersistLabTests ? { labTests: true } : {}),
        followUpDate: true,
        disposition: true,
        suggestedWardType: true,
        createdAt: true,
      },
    });

    if (labTests.length) {
      await tx.testAdvice.create({
        data: {
          patientId,
          doctorId: doctor.id,
          consultationId: c.id,
          items: {
            create: labTests.map((t) => ({ testId: t.testId })),
          },
        },
      });
    }

    return c;
  });

  if (appointmentId) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, doctorId: true, patientId: true, date: true, token: true, department: true, paymentMode: true, paymentStatus: true },
    });
    if (appt && appt.doctorId === doctor.id) {
      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'IN_PROGRESS' } });

        // Keep receptionist Patient List in sync.
        const dayStart = new Date(appt.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(appt.date);
        dayEnd.setHours(23, 59, 59, 999);
        const latestVisitSameDay = await tx.receptionVisit.findFirst({
          where: { patientId: appt.patientId, visitDate: { gte: dayStart, lte: dayEnd } },
          orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
          select: { id: true },
        });

        const doctorRow = await tx.doctor.findUnique({
          where: { id: doctor.id },
          select: { user: { select: { name: true } } },
        });
        const doctorName = doctorRow?.user?.name || null;

        if (latestVisitSameDay?.id) {
          await tx.receptionVisit.update({
            where: { id: latestVisitSameDay.id },
            data: {
              visitType: 'OPD',
              status: 'IN_CONSULTATION',
              department: appt.department,
              doctorName,
              visitDate: appt.date,
              token: appt.token,
              paymentMode: appt.paymentMode,
              paymentStatus: appt.paymentStatus,
            },
          });
        } else {
          await tx.receptionVisit.create({
            data: {
              patientId: appt.patientId,
              visitType: 'OPD',
              status: 'IN_CONSULTATION',
              department: appt.department,
              doctorName,
              visitDate: appt.date,
              token: appt.token,
              paymentMode: appt.paymentMode,
              paymentStatus: appt.paymentStatus,
            },
          });
        }
      });
    }
  }

  return res.status(201).json({ consultation });
}

async function getConsultationsByPatient(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  const patientId = req.params.patient_id;
  if (!patientId) return res.status(400).json({ message: 'patient_id is required' });

  const assigned = await assertDoctorAssignment({ doctorId: doctor.id, patientId });
  if (!assigned) return res.status(403).json({ message: 'Patient is not assigned to this doctor' });

  const consultations = await prisma.consultation.findMany({
    where: { doctorId: doctor.id, patientId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      symptoms: true,
      diagnosis: true,
      prescription: true,
      ...(consultationSupportsLabTests() ? { labTests: true } : {}),
      followUpDate: true,
      createdAt: true,
    },
  });

  return res.json({ consultations });
}

async function getLatestConsultationByAppointment(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  const appointmentId = req.params.appointment_id;
  if (!appointmentId) return res.status(400).json({ message: 'appointment_id is required' });

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      doctorId: true,
      patientId: true,
      date: true,
      time: true,
      opdNumber: true,
      token: true,
      status: true,
      department: true,
      patient: { select: { uhid: true, name: true } },
    },
  });
  if (!appt) return res.status(404).json({ message: 'Appointment not found' });
  if (appt.doctorId !== doctor.id) return res.status(403).json({ message: 'Access denied' });

  let consultation = await prisma.consultation.findFirst({
    where: { doctorId: doctor.id, appointmentId: appt.id },
    orderBy: [{ createdAt: 'desc' }],
    select: consultationDetailSelect(),
  });

  // Fallback for legacy rows where appointmentId wasn't stored
  if (!consultation && appt.patientId && appt.date) {
    const dayStart = new Date(appt.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(appt.date);
    dayEnd.setHours(23, 59, 59, 999);
    consultation = await prisma.consultation.findFirst({
      where: {
        doctorId: doctor.id,
        patientId: appt.patientId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: consultationDetailSelect(),
    });
  }

  return res.json({
    appointment: {
      id: appt.id,
      patientId: appt.patientId || null,
      opdNumber: appt.opdNumber || '',
      token: appt.token || '',
      date: appt.date,
      time: appt.time || '',
      status: appt.status,
      department: appt.department || '',
      patientName: appt.patient?.name || '',
      uhid: appt.patient?.uhid || '',
    },
    consultation: shapeConsultationForView(consultation),
  });
}

module.exports = { createConsultation, getConsultationsByPatient, getLatestConsultationByAppointment };

