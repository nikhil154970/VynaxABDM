const bcrypt = require('bcrypt');
const { prisma } = require('../../config/prisma');
const { createActivityLog } = require('../../utils/activityLog');

function normalizeEmail(email) {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}

const doctorSelect = {
  id: true,
  specialization: true,
  qualification: true,
  experienceYears: true,
  phone: true,
  gender: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLogin: true,
    },
  },
  availability: {
    where: { isAvailable: true },
    select: { id: true },
    take: 1,
  },
};

function toDoctorRow(d) {
  return {
    id: d.id,
    name: d.user?.name || '—',
    email: d.user?.email || '—',
    specialization: d.specialization,
    qualification: d.qualification,
    experienceYears: d.experienceYears,
    phone: d.phone,
    gender: d.gender,
    isActive: Boolean(d.user?.isActive),
    hasAvailability: Array.isArray(d.availability) && d.availability.length > 0,
  };
}

async function listDoctors(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 10));
  const skip = (page - 1) * pageSize;

  const [total, doctors] = await Promise.all([
    prisma.doctor.count(),
    prisma.doctor.findMany({
      orderBy: [{ user: { name: 'asc' } }],
      skip,
      take: pageSize,
      select: doctorSelect,
    }),
  ]);

  return res.json({
    doctors: doctors.map(toDoctorRow),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function listDoctorLookup(req, res) {
  const q = String(req.query.q || '').trim();
  const where = {};
  if (q) {
    where.OR = [
      { specialization: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const doctors = await prisma.doctor.findMany({
    where,
    orderBy: [{ user: { name: 'asc' } }],
    take: 200,
    select: {
      id: true,
      specialization: true,
      phone: true,
      user: { select: { name: true, isActive: true } },
      availability: {
        where: { isAvailable: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  return res.json({
    items: doctors.map((d) => ({
      id: d.id,
      name: d.user?.name || '—',
      specialization: d.specialization || '',
      phone: d.phone || '',
      isActive: Boolean(d.user?.isActive),
      hasAvailability: Array.isArray(d.availability) && d.availability.length > 0,
    })),
  });
}

async function getDoctor(req, res) {
  const { id } = req.params;
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    select: {
      id: true,
      specialization: true,
      qualification: true,
      experienceYears: true,
      phone: true,
      gender: true,
      user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
    },
  });
  if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
  return res.json({
    doctor: {
      id: doctor.id,
      name: doctor.user?.name || '',
      email: doctor.user?.email || '',
      isActive: Boolean(doctor.user?.isActive),
      specialization: doctor.specialization,
      qualification: doctor.qualification,
      experienceYears: doctor.experienceYears,
      phone: doctor.phone,
      gender: doctor.gender,
      userId: doctor.user?.id,
    },
  });
}

async function getMyDoctorProfile(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: {
      id: true,
      specialization: true,
      qualification: true,
      experienceYears: true,
      phone: true,
      gender: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
        },
      },
    },
  });

  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  return res.json({
    doctor: {
      id: doctor.id,
      userId: doctor.user?.id,
      name: doctor.user?.name || '',
      email: doctor.user?.email || '',
      role: doctor.user?.role,
      isActive: Boolean(doctor.user?.isActive),
      specialization: doctor.specialization,
      qualification: doctor.qualification,
      experienceYears: doctor.experienceYears,
      phone: doctor.phone,
      gender: doctor.gender,
      lastLogin: doctor.user?.lastLogin,
      createdAt: doctor.user?.createdAt,
    },
  });
}

async function createDoctor(req, res) {
  const {
    name,
    email,
    password,
    isActive,
    status,
    specialization,
    qualification,
    experienceYears,
    phone,
    gender,
  } = req.body;

  const resolvedEmail = normalizeEmail(email);

  const resolvedIsActive =
    typeof isActive === 'boolean'
      ? isActive
      : status === 'active'
        ? true
        : status === 'inactive'
          ? false
          : true;

  try {
    const hashed = await bcrypt.hash(String(password), 12);

    const doctor = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: resolvedEmail } });
      if (existing) {
        throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
      }

      const user = await tx.user.create({
        data: {
          name,
          email: resolvedEmail,
          password: hashed,
          role: 'DOCTOR',
          isActive: resolvedIsActive,
        },
      });

      const d = await tx.doctor.create({
        data: {
          userId: user.id,
          specialization,
          qualification,
          experienceYears: Number(experienceYears),
          phone,
          gender,
        },
        select: {
          id: true,
          specialization: true,
          qualification: true,
          experienceYears: true,
          phone: true,
          gender: true,
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      });

      return {
        id: d.id,
        name: d.user.name,
        email: d.user.email,
        specialization: d.specialization,
        qualification: d.qualification,
        experienceYears: d.experienceYears,
        phone: d.phone,
        gender: d.gender,
        isActive: Boolean(d.user.isActive),
      };
    });

    await createActivityLog({ userId: req.user?.userId, action: 'CREATE_USER', module: 'USER' });
    return res.status(201).json({ doctor });
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ message: err.message });
    if (err && err.code === 'P2002') return res.status(409).json({ message: 'Email already exists' });
    throw err;
  }
}

async function updateDoctor(req, res) {
  const { id } = req.params;
  const {
    name,
    email,
    isActive,
    status,
    specialization,
    qualification,
    experienceYears,
    phone,
    gender,
  } = req.body;

  try {
    const resolvedEmail = normalizeEmail(email);
    const resolvedIsActive =
      typeof isActive === 'boolean'
        ? isActive
        : status === 'active'
          ? true
          : status === 'inactive'
            ? false
            : undefined;

    const doctor = await prisma.$transaction(async (tx) => {
      const existing = await tx.doctor.findUnique({ where: { id }, select: { id: true, userId: true } });
      if (!existing) return null;

      if (resolvedEmail || name || typeof resolvedIsActive === 'boolean') {
        const userUpdate = {};
        if (resolvedEmail) userUpdate.email = resolvedEmail;
        if (name) userUpdate.name = name;
        if (typeof resolvedIsActive === 'boolean') userUpdate.isActive = resolvedIsActive;
        if (Object.keys(userUpdate).length) {
          await tx.user.update({ where: { id: existing.userId }, data: userUpdate });
        }
      }

      const doctorUpdate = {};
      if (specialization) doctorUpdate.specialization = specialization;
      if (qualification) doctorUpdate.qualification = qualification;
      if (typeof experienceYears !== 'undefined') doctorUpdate.experienceYears = Number(experienceYears);
      if (phone) doctorUpdate.phone = phone;
      if (gender) doctorUpdate.gender = gender;

      if (Object.keys(doctorUpdate).length) {
        await tx.doctor.update({ where: { id }, data: doctorUpdate });
      }

      const d = await tx.doctor.findUnique({
        where: { id },
        select: {
          id: true,
          specialization: true,
          qualification: true,
          experienceYears: true,
          phone: true,
          gender: true,
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      });
      return {
        id: d.id,
        name: d.user.name,
        email: d.user.email,
        specialization: d.specialization,
        qualification: d.qualification,
        experienceYears: d.experienceYears,
        phone: d.phone,
        gender: d.gender,
        isActive: Boolean(d.user.isActive),
      };
    });

    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    return res.json({ doctor });
  } catch (err) {
    if (err && err.code === 'P2002') return res.status(409).json({ message: 'Email already exists' });
    throw err;
  }
}

async function deleteDoctor(req, res) {
  const { id } = req.params;
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const doctor = await tx.doctor.findUnique({ where: { id }, select: { id: true, userId: true } });
      if (!doctor) return null;
      
      try {
        await tx.doctorAvailability.deleteMany({ where: { doctorId: id } });
        await tx.doctor.delete({ where: { id } });
        try {
          await tx.user.delete({ where: { id: doctor.userId } });
        } catch (errUser) {
          await tx.user.update({ where: { id: doctor.userId }, data: { isActive: false } });
        }
      } catch (errDoc) {
        await tx.user.update({ where: { id: doctor.userId }, data: { isActive: false } });
      }
      return doctor;
    });

    if (!deleted) return res.status(404).json({ message: 'Doctor not found' });
    await createActivityLog({ userId: req.user?.userId, action: 'UPDATE_STATUS', module: 'USER' });
    return res.json({ success: true, message: 'Doctor deactivated or deleted successfully' });
  } catch (err) {
    if (err && err.code === 'P2025') return res.status(404).json({ message: 'Doctor not found' });
    throw err;
  }
}

async function patchDoctorStatus(req, res) {
  const { id } = req.params;
  const resolvedIsActive =
    typeof req.body.isActive === 'boolean'
      ? req.body.isActive
      : (req.body.status === 'active' ? true : req.body.status === 'inactive' ? false : undefined);

  if (typeof resolvedIsActive !== 'boolean') {
    return res.status(400).json({ message: 'Provide either boolean isActive or status "active"/"inactive"' });
  }

  try {
    const doctor = await prisma.$transaction(async (tx) => {
      const d = await tx.doctor.findUnique({ where: { id }, select: { id: true, userId: true } });
      if (!d) return null;
      const user = await tx.user.update({ where: { id: d.userId }, data: { isActive: resolvedIsActive } });
      return { id: d.id, isActive: Boolean(user.isActive) };
    });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    await createActivityLog({ userId: req.user?.userId, action: 'UPDATE_STATUS', module: 'USER' });
    return res.json({ doctor });
  } catch (err) {
    if (err && err.code === 'P2025') return res.status(404).json({ message: 'Doctor not found' });
    throw err;
  }
}

async function listAvailability(req, res) {
  const { id } = req.params;
  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

  const slots = await prisma.doctorAvailability.findMany({
    where: { doctorId: id },
    orderBy: [{ dayOfWeek: 'asc' }],
  });

  return res.json({ slots });
}

async function listTimeSlots(req, res) {
  const { id } = req.params;
  const dateStr = String(req.query.date || '').trim();
  if (!dateStr) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });

  if (Number.isNaN(new Date(dateStr + 'T00:00:00').getTime())) return res.status(400).json({ message: 'Invalid date' });

  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dayOfWeek = dayNames[new Date(y, mo - 1, d).getDay()];

  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59`);

  // Check if doctor has a specific shift assignment for this date from HR
  const shiftAss = await prisma.shiftAssignment.findFirst({
    where: {
      employeeId: doctor.userId,
      assignedDate: { gte: dayStart, lte: dayEnd },
    },
    include: { shift: true },
  });

  const avail = await prisma.doctorAvailability.findUnique({
    where: { doctorId_dayOfWeek: { doctorId: id, dayOfWeek } },
  });

  const anyAvail = await prisma.doctorAvailability.findFirst({
    where: { doctorId: id, isAvailable: true },
    select: { startTime: true, endTime: true },
    orderBy: [{ dayOfWeek: 'asc' }],
  });

  // If this day is explicitly set as unavailable, and NO shift assignment overrides it, return empty
  if (!shiftAss && avail && !avail.isAvailable) {
    return res.json({ slots: [], message: 'Doctor not available on this day' });
  }

  // Determine active start/end time. Priority: ShiftAssignment > doctorAvailability > Default 9AM-5PM
  let startTime = '09:00';
  let endTime = '17:00';

  if (shiftAss?.shift) {
    startTime = shiftAss.shift.startTime;
    endTime = shiftAss.shift.endTime;
  } else if (avail) {
    startTime = avail.startTime;
    endTime = avail.endTime;
  } else if (anyAvail) {
    startTime = anyAvail.startTime;
    endTime = anyAvail.endTime;
  }

  const toMins = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const startMins = toMins(startTime);
  let endMins = toMins(endTime);

  // If shift spans across midnight or is exactly 24 hours (e.g. end <= start)
  if (endMins <= startMins) {
    endMins += 1440;
  }

  const slots = [];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = dateStr === todayStr;
  const currentMins = now.getHours() * 60 + now.getMinutes();

  for (let m = startMins; m < endMins; m += 30) {
    const minOfDay = m % 1440;
    const hh = String(Math.floor(minOfDay / 60)).padStart(2, '0');
    const mm = String(minOfDay % 60).padStart(2, '0');
    const label = `${hh}:${mm}`;

    const isPast = isToday && (m < 1440 ? m < currentMins : false);
    slots.push({ label, available: !isPast, past: isPast });
  }

  // Mark already booked slots
  const booked = await prisma.appointment.findMany({
    where: {
      doctorId: id,
      date: { gte: dayStart, lte: dayEnd },
      time: { not: null },
    },
    select: { time: true },
  });

  const bookedSet = new Set(booked.map((b) => String(b.time).trim()));

  for (const s of slots) {
    if (bookedSet.has(s.label)) {
      s.available = false;
      s.booked = true;
    }
  }

  const hasUpcoming = slots.some((s) => !s.past);
  const message = isToday && !hasUpcoming
    ? "Today's slots are over. Please choose another date."
    : null;

  return res.json({ date: dateStr, dayOfWeek, slots, message });
}

async function upsertAvailability(req, res) {
  const { id } = req.params;
  const { slots } = req.body;

  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

  const result = await prisma.$transaction(async (tx) => {
    const updated = [];
    for (const s of slots) {
      const dayOfWeek = s.dayOfWeek;
      const startTime = typeof s.startTime === 'string' ? s.startTime : '09:00';
      const endTime = typeof s.endTime === 'string' ? s.endTime : '17:00';
      const isAvailable = typeof s.isAvailable === 'boolean' ? s.isAvailable : true;

      const row = await tx.doctorAvailability.upsert({
        where: { doctorId_dayOfWeek: { doctorId: id, dayOfWeek } },
        create: { doctorId: id, dayOfWeek, startTime, endTime, isAvailable },
        update: { startTime, endTime, isAvailable },
      });
      updated.push(row);
    }
    return updated;
  });

  return res.json({ slots: result });
}

module.exports = {
  listDoctors,
  listDoctorLookup,
  getMyDoctorProfile,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  patchDoctorStatus,
  listAvailability,
  upsertAvailability,
  listTimeSlots,
};

