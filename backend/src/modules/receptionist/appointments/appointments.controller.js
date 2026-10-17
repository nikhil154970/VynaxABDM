const { prisma } = require('../../../config/prisma');
const {
  applyAyushmanAppointmentBilling,
  getLatestPatientSponsor,
  isAyushmanSponsor,
  sponsorDisplayLabel,
} = require('../../../utils/ayushmanBilling');

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

function parseOptionalInt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePaymentStatus(v) {
  const s = normalizeString(v).toUpperCase();
  if (!s) return null;
  if (s === 'PAID') return 'PAID';
  if (s === 'PENDING') return 'PENDING';
  return s;
}

function normalizeAppointmentStatus(v) {
  const s = normalizeString(v).toUpperCase().replace(/\s+/g, '_');
  if (!s) return null;
  if (s === 'WAITING') return 'WAITING';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s === 'COMPLETED') return 'COMPLETED';
  return null;
}

function parseTimeToHHMM(value) {
  const s = normalizeString(value);
  if (!s) return null;

  // already HH:MM
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m24) {
    const hh = Number(m24[1]);
    const mm = Number(m24[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // e.g. 10:15 AM
  const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.replace(/\./g, '').toUpperCase());
  if (m12) {
    let hh = Number(m12[1]);
    const mm = Number(m12[2]);
    const ap = m12[3];
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
    if (ap === 'PM' && hh !== 12) hh += 12;
    if (ap === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  return null;
}

function mapAppointmentStatusToVisitStatus(apptStatus) {
  const s = normalizeString(apptStatus).toUpperCase().replace(/\s+/g, '_');
  if (s === 'IN_PROGRESS') return 'IN_CONSULTATION';
  if (s === 'COMPLETED') return 'COMPLETED';
  return 'WAITING';
}

async function generateDailyToken({ doctorId, date }) {
  const dayStart = toStartOfDay(date);
  const dayEnd = toEndOfDay(date);
  const last = await prisma.appointment.findFirst({
    where: { doctorId, date: { gte: dayStart, lte: dayEnd } },
    orderBy: [{ createdAt: 'desc' }],
    select: { token: true },
  });

  // Daily token should start from 1 each day (T-001, T-002, ...)
  const lastNum = last?.token ? Number(String(last.token).replace(/\D+/g, '')) : 0;
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return `T-${String(nextNum).padStart(3, '0')}`;
}

function formatSeq(prefix, n) {
  const num = Number(n);
  const safe = Number.isFinite(num) && num >= 0 ? Math.trunc(num) : 0;
  return `${prefix}-${String(safe).padStart(3, '0')}`;
}

function isUniqueOpdNumberError(e) {
  // Prisma unique constraint error
  if (String(e?.code || '') !== 'P2002') return false;
  const target = e?.meta?.target;
  if (Array.isArray(target)) return target.includes('opdNumber');
  if (String(target || '').includes('opdNumber')) return true;
  return String(e?.message || '').toLowerCase().includes('opdnumber');
}

async function generateNextOpdNumber(tx, offset = 0) {
  const last = await tx.appointment.findFirst({
    // Use opdNumber ordering (not createdAt) so old edits/seeds can't break sequencing.
    orderBy: [{ opdNumber: 'desc' }],
    select: { opdNumber: true },
  });
  const lastNum = last?.opdNumber ? Number(String(last.opdNumber).replace(/\D+/g, '')) : 0;
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  const bump = Number.isFinite(Number(offset)) ? Math.max(0, Math.trunc(Number(offset))) : 0;
  return formatSeq('OPD', nextNum + bump);
}

async function getNextTokenPreview(req, res) {
  const doctorId = normalizeString(req.query.doctorId);
  const dateOnly = parseDateOnly(req.query.date);
  if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });
  if (!dateOnly) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });

  const dayStart = toStartOfDay(dateOnly);
  const dayEnd = toEndOfDay(dateOnly);
  const last = await prisma.appointment.findFirst({
    where: { doctorId, date: { gte: dayStart, lte: dayEnd } },
    orderBy: [{ createdAt: 'desc' }],
    select: { token: true },
  });

  // Daily token should start from 1 each day (T-001, T-002, ...)
  const lastNum = last?.token ? Number(String(last.token).replace(/\D+/g, '')) : 0;
  const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  const nextToken = `T-${String(nextNum).padStart(3, '0')}`;
  return res.json({ nextToken, queuePosition: nextNum });
}

async function createAppointment(req, res) {
  const body = req.body || {};
  const uhid = normalizeString(body.uhid);
  const doctorId = normalizeString(body.doctorId);
  const department = normalizeString(body.department) || null;
  if (department === 'Emergency & Trauma Care' || department === 'Critical Care (ICU)') {
    return res.status(400).json({
      message: `${department} patients must be admitted via the IPD Admission module, not booked as OPD appointments.`
    });
  }
  let fee = parseOptionalInt(body.fee);
  let paymentMode = normalizeString(body.paymentMode) || null;
  let paymentStatus = normalizePaymentStatus(body.paymentStatus) || null;
  const status = normalizeAppointmentStatus(body.status) || 'WAITING';

  const dateOnly = parseDateOnly(body.date);
  if (!dateOnly) return res.status(400).json({ message: 'Invalid date' });

  const timeRaw = body.time ?? body.timeSlot ?? null;
  const time = parseTimeToHHMM(timeRaw) || normalizeString(timeRaw) || null;

  const patient = await prisma.patient.findUnique({ where: { uhid }, select: { id: true, uhid: true, name: true, mobile: true } });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const sponsor =
    normalizeString(body.sponsor) || (await getLatestPatientSponsor(prisma, patient.id));
  const ayushmanAppt = applyAyushmanAppointmentBilling({ sponsor, fee, paymentStatus, paymentMode });
  fee = ayushmanAppt.fee;
  paymentMode = ayushmanAppt.paymentMode;
  paymentStatus = ayushmanAppt.paymentStatus;

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, specialization: true, user: { select: { name: true, isActive: true } } },
  });
  if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
  if (!doctor.user?.isActive) return res.status(403).json({ message: 'Doctor is inactive' });

  const token = normalizeString(body.token) || (await generateDailyToken({ doctorId: doctor.id, date: dateOnly }));

  const appt = await prisma.$transaction(async (tx) => {
    // Use opdSeq (autoincrement, unique) to derive opdNumber reliably.
    // Creating with opdNumber null avoids uniqueness races entirely.
    const createdBase = await tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        opdNumber: null,
        date: dateOnly,
        time,
        token,
        department,
        fee,
        paymentMode,
        paymentStatus,
        status,
      },
      select: { id: true, opdSeq: true },
    });

    const opdNumber = formatSeq('OPD', createdBase.opdSeq);
    const created = await tx.appointment.update({
      where: { id: createdBase.id },
      data: { opdNumber },
      select: {
        id: true,
        opdNumber: true,
        token: true,
        date: true,
        time: true,
        status: true,
        department: true,
        fee: true,
        paymentMode: true,
        paymentStatus: true,
        createdAt: true,
        patient: { select: { uhid: true, name: true, mobile: true } },
        doctor: { select: { id: true, specialization: true, user: { select: { name: true } } } },
      },
    });

    // Keep receptionist "Patient List" (ReceptionVisit) in sync with booking.
    // Patient list reads from ReceptionVisit, not Appointment.
    const dayStart = toStartOfDay(dateOnly);
    const dayEnd = toEndOfDay(dateOnly);
    const latestVisitSameDay = await tx.receptionVisit.findFirst({
      where: { patientId: patient.id, visitDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    const doctorName = created.doctor?.user?.name || doctor.user?.name || null;
    const visitStatus = mapAppointmentStatusToVisitStatus(created.status);

    if (latestVisitSameDay?.id) {
      await tx.receptionVisit.update({
        where: { id: latestVisitSameDay.id },
        data: {
          visitType: 'OPD',
          status: visitStatus,
          department: created.department,
          doctorName,
          visitDate: dateOnly,
          token: created.token,
          paymentMode: created.paymentMode,
          paymentStatus: created.paymentStatus,
        },
      });
    } else {
      await tx.receptionVisit.create({
        data: {
          patientId: patient.id,
          visitType: 'OPD',
          status: visitStatus,
          department: created.department,
          doctorName,
          visitDate: dateOnly,
          token: created.token,
          paymentMode: created.paymentMode,
          paymentStatus: created.paymentStatus,
        },
      });
    }

    return created;
  }, { timeout: 20000 });

  return res.status(201).json({
    appointment: {
      id: appt.id,
      opdNumber: appt.opdNumber,
      token: appt.token,
      date: appt.date,
      time: appt.time,
      status: appt.status,
      department: appt.department,
      fee: appt.fee,
      paymentMode: appt.paymentMode,
      paymentStatus: appt.paymentStatus,
      patientName: appt.patient?.name || '',
      uhid: appt.patient?.uhid || null,
      mobile: appt.patient?.mobile || null,
      doctorId: appt.doctor?.id || null,
      doctorName: appt.doctor?.user?.name || '',
      specialization: appt.doctor?.specialization || '',
      createdAt: appt.createdAt,
    },
  });
}

async function listAppointments(req, res) {
  const q = normalizeString(req.query.q);
  const date = parseDateOnly(req.query.date);
  const dateFrom = parseDateOnly(req.query.from);
  const dateTo = parseDateOnly(req.query.to);
  const department = normalizeString(req.query.department);
  const doctorId = normalizeString(req.query.doctorId);
  const paymentStatus = normalizePaymentStatus(req.query.paymentStatus);
  const status = normalizeAppointmentStatus(req.query.status);
  const page = Math.max(1, parseOptionalInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(5, parseOptionalInt(req.query.pageSize) || 10));
  const skip = (page - 1) * pageSize;

  const where = {};
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = toStartOfDay(dateFrom);
    if (dateTo) where.date.lte = toEndOfDay(dateTo);
    if (dateFrom && !dateTo) where.date.lte = toEndOfDay(dateFrom);
  } else if (date) {
    where.date = { gte: toStartOfDay(date), lte: toEndOfDay(date) };
  }
  if (department && department.toLowerCase() !== 'all') where.department = department;
  if (doctorId && doctorId.toLowerCase() !== 'all') where.doctorId = doctorId;
  if (paymentStatus && paymentStatus.toLowerCase() !== 'all') where.paymentStatus = paymentStatus;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { token: { contains: q, mode: 'insensitive' } },
      { patient: { name: { contains: q, mode: 'insensitive' } } },
      { patient: { uhid: { contains: q, mode: 'insensitive' } } },
      { patient: { mobile: { contains: q } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        opdNumber: true,
        token: true,
        date: true,
        time: true,
        status: true,
        department: true,
        fee: true,
        paymentMode: true,
        paymentStatus: true,
        createdAt: true,
        patient: { select: { uhid: true, registrationNumber: true, name: true, mobile: true } },
        doctor: { select: { id: true, specialization: true, user: { select: { name: true } } } },
      },
    }),
  ]);

  return res.json({
    items: rows.map((a) => ({
      id: a.id,
      opdNumber: a.opdNumber || '',
      token: a.token,
      date: a.date,
      time: a.time,
      status: a.status,
      department: a.department,
      fee: a.fee,
      paymentMode: a.paymentMode,
      paymentStatus: a.paymentStatus,
      patientName: a.patient?.name || '',
      uhid: a.patient?.uhid || null,
      registrationNumber: a.patient?.registrationNumber || '',
      mobile: a.patient?.mobile || null,
      doctorId: a.doctor?.id || null,
      doctorName: a.doctor?.user?.name || '',
      specialization: a.doctor?.specialization || '',
      createdAt: a.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

async function deleteAppointment(req, res) {
  const id = normalizeString(req.params.id);
  if (!id) return res.status(400).json({ message: 'Appointment id is required' });

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!appt) return res.status(404).json({ message: 'Appointment not found' });

  await prisma.appointment.delete({ where: { id } });
  return res.json({ message: 'Appointment deleted', id });
}

async function updateAppointment(req, res) {
  const id = normalizeString(req.params.id);
  if (!id) return res.status(400).json({ message: 'Appointment id is required' });

  const body = req.body || {};
  const nextDoctorId = normalizeString(body.doctorId) || null;
  const nextDepartment = body.department != null ? normalizeString(body.department) || null : undefined;
  let fee = body.fee != null ? parseOptionalInt(body.fee) : undefined;
  let paymentMode = body.paymentMode != null ? normalizeString(body.paymentMode) || null : undefined;
  let paymentStatus = body.paymentStatus != null ? normalizePaymentStatus(body.paymentStatus) || null : undefined;

  const dateOnly = body.date != null ? parseDateOnly(body.date) : undefined;
  if (body.date != null && !dateOnly) return res.status(400).json({ message: 'Invalid date' });

  const timeRaw = body.time ?? body.timeSlot ?? undefined;
  const time = timeRaw === undefined ? undefined : parseTimeToHHMM(timeRaw) || normalizeString(timeRaw) || null;

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, patientId: true, doctorId: true, date: true, status: true, token: true },
  });
  if (!existing) return res.status(404).json({ message: 'Appointment not found' });

  const sponsor =
    normalizeString(body.sponsor) || (await getLatestPatientSponsor(prisma, existing.patientId));
  if (fee !== undefined || paymentStatus !== undefined || paymentMode !== undefined) {
    const ayushmanAppt = applyAyushmanAppointmentBilling({
      sponsor,
      fee: fee ?? 0,
      paymentStatus: paymentStatus ?? null,
      paymentMode: paymentMode ?? null,
    });
    if (fee !== undefined) fee = ayushmanAppt.fee;
    if (paymentStatus !== undefined) paymentStatus = ayushmanAppt.paymentStatus;
    if (paymentMode !== undefined) paymentMode = ayushmanAppt.paymentMode;
  }

  let doctor = null;
  if (nextDoctorId) {
    doctor = await prisma.doctor.findUnique({
      where: { id: nextDoctorId },
      select: { id: true, user: { select: { name: true, isActive: true } } },
    });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    if (!doctor.user?.isActive) return res.status(403).json({ message: 'Doctor is inactive' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.appointment.update({
      where: { id },
      data: {
        doctorId: nextDoctorId || undefined,
        department: nextDepartment,
        date: dateOnly,
        time,
        fee,
        paymentMode,
        paymentStatus,
      },
      select: {
        id: true,
        token: true,
        date: true,
        time: true,
        status: true,
        department: true,
        fee: true,
        paymentMode: true,
        paymentStatus: true,
        createdAt: true,
        patient: { select: { uhid: true, name: true, mobile: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    // Best-effort sync to ReceptionVisit (same day as appointment date)
    const d = row.date || existing.date;
    const dayStart = toStartOfDay(d);
    const dayEnd = toEndOfDay(d);
    const latestVisitSameDay = await tx.receptionVisit.findFirst({
      where: { patientId: existing.patientId, visitDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    const doctorName = row.doctor?.user?.name || doctor?.user?.name || null;
    const visitStatus = mapAppointmentStatusToVisitStatus(row.status);
    if (latestVisitSameDay?.id) {
      await tx.receptionVisit.update({
        where: { id: latestVisitSameDay.id },
        data: {
          department: row.department,
          doctorName,
          visitDate: d,
          token: row.token,
          paymentMode: row.paymentMode,
          paymentStatus: row.paymentStatus,
          visitType: 'OPD',
          status: visitStatus,
        },
      });
    }

    return row;
  });

  return res.json({
    appointment: {
      id: updated.id,
      token: updated.token,
      date: updated.date,
      time: updated.time,
      status: updated.status,
      department: updated.department,
      fee: updated.fee,
      paymentMode: updated.paymentMode,
      paymentStatus: updated.paymentStatus,
      patientName: updated.patient?.name || '',
      uhid: updated.patient?.uhid || null,
      mobile: updated.patient?.mobile || null,
      doctorId: updated.doctor?.id || null,
      doctorName: updated.doctor?.user?.name || '',
      createdAt: updated.createdAt,
    },
  });
}

async function getAppointmentById(req, res) {
  const id = normalizeString(req.params.id);
  if (!id) return res.status(400).json({ message: 'Appointment id is required' });

  const row = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      opdNumber: true,
      token: true,
      date: true,
      time: true,
      status: true,
      department: true,
      fee: true,
      paymentMode: true,
      paymentStatus: true,
      createdAt: true,
      patientId: true,
      patient: {
        select: {
          id: true,
          uhid: true,
          registrationNumber: true,
          name: true,
          mobile: true,
          age: true,
          gender: true,
          address: true,
          weightKg: true,
        },
      },
      doctor: { select: { id: true, specialization: true, user: { select: { name: true } } } },
    },
  });
  if (!row) return res.status(404).json({ message: 'Appointment not found' });

  const sponsorResolved = (await getLatestPatientSponsor(prisma, row.patientId)) || '';
  const ayushman = isAyushmanSponsor(sponsorResolved);
  const apptBilling = ayushman
    ? applyAyushmanAppointmentBilling({
        sponsor: sponsorResolved,
        fee: row.fee,
        paymentStatus: row.paymentStatus,
        paymentMode: row.paymentMode,
      })
    : { fee: row.fee, paymentStatus: row.paymentStatus, paymentMode: row.paymentMode };

  return res.json({
    appointment: {
      id: row.id,
      opdNumber: row.opdNumber || '',
      token: row.token || '',
      date: row.date,
      time: row.time,
      status: row.status,
      department: row.department,
      fee: apptBilling.fee,
      paymentMode: apptBilling.paymentMode,
      paymentStatus: apptBilling.paymentStatus,
      sponsor: sponsorResolved,
      sponsorLabel: sponsorDisplayLabel(sponsorResolved),
      isAyushman: ayushman,
      patientName: row.patient?.name || '',
      uhid: row.patient?.uhid || null,
      registrationNumber: row.patient?.registrationNumber || '',
      mobile: row.patient?.mobile || null,
      age: row.patient?.age ?? null,
      gender: row.patient?.gender || null,
      address: row.patient?.address || null,
      weight: row.patient?.weightKg ?? null,
      doctorId: row.doctor?.id || null,
      doctorName: row.doctor?.user?.name || '',
      specialization: row.doctor?.specialization || '',
      createdAt: row.createdAt,
    },
  });
}

module.exports = { createAppointment, listAppointments, deleteAppointment, updateAppointment, getNextTokenPreview, getAppointmentById };

