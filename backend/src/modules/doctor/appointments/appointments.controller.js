const { prisma } = require('../../../config/prisma');

async function getOrCreateDoctorProfile(userId, tx = prisma) {
  let doctor = await tx.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) {
    try {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { phone: true } });
      doctor = await tx.doctor.create({
        data: {
          userId,
          specialization: 'General Medicine',
          qualification: 'MBBS',
          experienceYears: 5,
          phone: user?.phone || '0000000000',
          gender: 'MALE',
        },
        select: { id: true }
      });
      console.log(`[self-healing] Created missing Doctor profile for userId: ${userId}`);
    } catch (err) {
      doctor = await tx.doctor.findUnique({ where: { userId }, select: { id: true } });
      if (!doctor) throw err;
    }
  }
  return doctor;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseDateParam(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s === 'today') return new Date();
  // Expect YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeStatus(value) {
  if (!value) return null;
  const s = String(value).trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'WAITING' || s === 'IN_PROGRESS' || s === 'COMPLETED') return s;
  return null;
}

function mapAppointmentStatusToVisitStatus(apptStatus) {
  const s = String(apptStatus || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'IN_PROGRESS') return 'IN_CONSULTATION';
  if (s === 'COMPLETED') return 'COMPLETED';
  return 'WAITING';
}

function safeInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function timeToMinutes(t) {
  if (!t) return null;
  const s = String(t).trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

async function getDoctorAppointments(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await getOrCreateDoctorProfile(userId);

  // OPD assigned patients: default to TODAY unless date is explicitly provided
  const day = parseDateParam(req.query.date) || new Date();
  const where = { doctorId: doctor.id };
  if (day) where.date = { gte: startOfDay(day), lte: endOfDay(day) };

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    select: {
      id: true,
      date: true,
      time: true,
      status: true,
      opdNumber: true,
      patient: { select: { id: true, name: true, uhid: true, age: true, basicHistory: true } },
    },
  });

  return res.json({
    appointments: appointments.map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      status: a.status,
      opd_number: a.opdNumber || null,
      patient_id: a.patient?.id,
      patient_name: a.patient?.name,
      uhid: a.patient?.uhid || null,
      patient_age: typeof a.patient?.age === 'number' ? a.patient.age : null,
      basic_history: a.patient?.basicHistory || null,
    })),
  });
}

async function patchAppointmentStatus(req, res) {
 try {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  let doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!doctor) {
    await getOrCreateDoctorProfile(userId);
    doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true, user: { select: { name: true } } },
    });
  }

  const { id } = req.params;
  const status = normalizeStatus(req.body?.status);
  if (!status) return res.status(400).json({ message: 'status must be WAITING, IN_PROGRESS, or COMPLETED' });

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      doctorId: true,
      patientId: true,
      date: true,
      token: true,
      department: true,
      paymentMode: true,
      paymentStatus: true,
      status: true,
      opdNumber: true,
      patient: { select: { name: true, uhid: true } },
    },
  });
  if (!appt) return res.status(404).json({ message: 'Appointment not found' });
  if (appt.doctorId !== doctor.id) return res.status(403).json({ message: 'Access denied' });

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.appointment.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
        patientId: true,
        date: true,
        token: true,
        department: true,
        paymentMode: true,
        paymentStatus: true,
      },
    });

    // Sync receptionist Patient List (ReceptionVisit) with the appointment state.
    const dayStart = startOfDay(row.date);
    const dayEnd = endOfDay(row.date);
    const latestVisitSameDay = await tx.receptionVisit.findFirst({
      where: { patientId: row.patientId, visitDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    const visitStatus = mapAppointmentStatusToVisitStatus(row.status);
    const doctorName = doctor.user?.name || null;

    if (latestVisitSameDay?.id) {
      await tx.receptionVisit.update({
        where: { id: latestVisitSameDay.id },
        data: {
          visitType: 'OPD',
          status: visitStatus,
          department: row.department,
          doctorName,
          visitDate: row.date,
          token: row.token,
          paymentMode: row.paymentMode,
          paymentStatus: row.paymentStatus,
        },
      });
    } else {
      await tx.receptionVisit.create({
        data: {
          patientId: row.patientId,
          visitType: 'OPD',
          status: visitStatus,
          department: row.department,
          doctorName,
          visitDate: row.date,
          token: row.token,
          paymentMode: row.paymentMode,
          paymentStatus: row.paymentStatus,
        },
      });
    }

    // Create receptionist notifications only on transition to COMPLETED.
    if (appt.status !== 'COMPLETED' && status === 'COMPLETED') {
      const receptionUsers = await tx.user.findMany({
        where: { role: 'RECEPTIONIST', isActive: true },
        select: { id: true },
      });
      if (receptionUsers.length) {
        const patientName = appt.patient?.name || 'Patient';
        const uhid = appt.patient?.uhid ? ` (${appt.patient.uhid})` : '';
        const opdNo = appt.opdNumber ? ` · ${appt.opdNumber}` : '';
        const message = `Consultation completed for ${patientName}${uhid}${opdNo}. Proceed with billing/lab flow if required.`;
        await tx.notification.createMany({
          data: receptionUsers.map((u) => ({
            userId: u.id,
            type: 'UPDATE',
            severity: 'INFO',
            title: `Consultation Completed - ${patientName}`,
            message,
          })),
        });
      }
    }

    return row;
  });

  return res.json({ appointment: updated });
 } catch (err) {
    // eslint-disable-next-line no-console
    console.error('patchAppointmentStatus error:', err?.message, err?.code, err?.meta ? JSON.stringify(err.meta) : '');
    return res.status(500).json({ message: err?.message || 'Failed to update appointment status' });
 }
}

async function getTodayAppointments(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await getOrCreateDoctorProfile(userId);

  const now = new Date();
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      date: { gte: startOfDay(now), lte: endOfDay(now) },
    },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      date: true,
      time: true,
      status: true,
      opdNumber: true,
      patient: { select: { id: true, name: true, uhid: true } },
    },
  });

  return res.json({
    appointments: appointments.map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      status: a.status,
      opd_number: a.opdNumber || null,
      patient_id: a.patient?.id,
      patient_name: a.patient?.name,
      uhid: a.patient?.uhid || null,
    })),
  });
}

async function listAppointments(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await getOrCreateDoctorProfile(userId);

  const day = parseDateParam(req.query.date);
  const status = normalizeStatus(req.query.status);
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, safeInt(req.query.page, 1));
  const pageSize = Math.min(50, Math.max(5, safeInt(req.query.pageSize, 10)));
  const skip = (page - 1) * pageSize;

  const where = { doctorId: doctor.id };
  if (day) where.date = { gte: startOfDay(day), lte: endOfDay(day) };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { opdNumber: { contains: q, mode: 'insensitive' } },
      {
        patient: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { uhid: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ date: 'desc' }, { time: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        date: true,
        time: true,
        status: true,
        opdNumber: true,
        patient: { select: { id: true, name: true, uhid: true } },
      },
    }),
  ]);

  const normalized = rows
    .map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      status: a.status,
      patient_name: a.patient?.name,
      opd_number: a.opdNumber || null,
      uhid: a.patient?.uhid || null,
      _timeSort: timeToMinutes(a.time) ?? 9999,
    }))
    .sort((a, b) => {
      if (a.date?.getTime?.() !== b.date?.getTime?.()) return 0;
      return a._timeSort - b._timeSort;
    })
    .map(({ _timeSort, ...rest }) => rest);

  return res.json({
    appointments: normalized,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

module.exports = {
  getDoctorAppointments,
  getTodayAppointments,
  listAppointments,
  patchAppointmentStatus,
};

