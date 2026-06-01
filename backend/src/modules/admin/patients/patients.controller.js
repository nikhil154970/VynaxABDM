const { prisma } = require('../../../config/prisma');

const doctorUserSelect = {
  select: {
    user: { select: { name: true, email: true } },
  },
};

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
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

function isoDayKey(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sumByDay(rows, dateField) {
  const map = new Map();
  for (const r of rows || []) {
    const key = isoDayKey(r?.[dateField]);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const days = Array.from(map.keys()).sort();
  return days.map((day) => ({ day, count: map.get(day) || 0 }));
}

function ageBucket(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n < 0) return 'Unknown';
  if (n <= 12) return '0-12';
  if (n <= 18) return '13-18';
  if (n <= 40) return '19-40';
  if (n <= 60) return '41-60';
  return '60+';
}

function addressToCity(address) {
  const s = normalizeString(address);
  if (!s) return 'Unknown';
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return 'Unknown';
  const last = parts[parts.length - 1];
  return last.length > 30 ? last.slice(0, 30) : last;
}

async function listPatients(req, res) {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const rawSize = parseInt(String(req.query.pageSize || '10'), 10) || 10;
  const pageSize = Math.min(50, Math.max(1, rawSize));
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const where = qRaw
    ? {
        OR: [
          { name: { contains: qRaw, mode: 'insensitive' } },
          { uhid: { contains: qRaw, mode: 'insensitive' } },
          { mobile: { contains: qRaw, mode: 'insensitive' } },
          { registrationNumber: { contains: qRaw, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        uhid: true,
        registrationNumber: true,
        mobile: true,
        age: true,
        gender: true,
        createdAt: true,
        _count: {
          select: {
            visits: true,
            appointments: true,
            admissions: true,
            bills: true,
            labOrders: true,
          },
        },
        visits: {
          orderBy: { visitDate: 'desc' },
          take: 1,
          select: { visitDate: true, visitType: true, status: true },
        },
      },
    }),
  ]);

  const patients = rows.map((p) => {
    const last = p.visits[0];
    return {
      id: p.id,
      name: p.name,
      uhid: p.uhid,
      registrationNumber: p.registrationNumber,
      mobile: p.mobile,
      age: p.age,
      gender: p.gender,
      createdAt: p.createdAt,
      counts: p._count,
      lastVisit: last
        ? { visitDate: last.visitDate, visitType: last.visitType, status: last.status }
        : null,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return res.json({
    patients,
    pagination: { page, pageSize, total, totalPages },
  });
}

function prescriptionSummary(prescription) {
  if (prescription == null) return { lines: 0 };
  if (Array.isArray(prescription)) return { lines: prescription.length };
  if (typeof prescription === 'object') return { lines: Object.keys(prescription).length };
  return { lines: 0 };
}

async function getPatientHistory(req, res) {
  const { patientId } = req.params;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      uhid: true,
      registrationNumber: true,
      age: true,
      gender: true,
      mobile: true,
      dob: true,
      address: true,
      bloodGroup: true,
      allergies: true,
      basicHistory: true,
      emergencyName: true,
      emergencyPhone: true,
      emergencyRelation: true,
      createdAt: true,
    },
  });

  if (!patient) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  const [
    receptionVisits,
    appointments,
    consultations,
    admissions,
    bills,
    labOrders,
  ] = await Promise.all([
    prisma.receptionVisit.findMany({
      where: { patientId },
      orderBy: { visitDate: 'desc' },
      take: 80,
      select: {
        id: true,
        visitType: true,
        status: true,
        department: true,
        doctorName: true,
        visitDate: true,
        token: true,
        queueNumber: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      take: 50,
      select: {
        id: true,
        opdNumber: true,
        date: true,
        time: true,
        department: true,
        fee: true,
        status: true,
        paymentStatus: true,
        doctor: doctorUserSelect,
      },
    }),
    prisma.consultation.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        symptoms: true,
        diagnosis: true,
        prescription: true,
        labTests: true,
        followUpDate: true,
        disposition: true,
        suggestedWardType: true,
        createdAt: true,
        appointmentId: true,
        doctor: doctorUserSelect,
      },
    }),
    prisma.admission.findMany({
      where: { patientId },
      orderBy: { admissionDate: 'desc' },
      take: 30,
      select: {
        id: true,
        ipdNumber: true,
        admissionDate: true,
        dischargeDate: true,
        status: true,
        clinicalCondition: true,
        department: true,
        admissionType: true,
        ward: { select: { name: true, type: true } },
        bed: { select: { code: true } },
        doctor: doctorUserSelect,
      },
    }),
    prisma.bill.findMany({
      where: { patientId },
      orderBy: { billDate: 'desc' },
      take: 40,
      select: {
        id: true,
        billNumber: true,
        visitType: true,
        status: true,
        subtotalAmount: true,
        totalAmount: true,
        paidAmount: true,
        billDate: true,
        appointmentId: true,
        admissionId: true,
      },
    }),
    prisma.labOrder.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        reportStatus: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        doctor: doctorUserSelect,
      },
    }),
  ]);

  const consultationsOut = consultations.map((c) => ({
    id: c.id,
    symptoms: c.symptoms,
    diagnosis: c.diagnosis,
    labTests: c.labTests,
    followUpDate: c.followUpDate,
    disposition: c.disposition,
    suggestedWardType: c.suggestedWardType,
    createdAt: c.createdAt,
    appointmentId: c.appointmentId,
    doctor: c.doctor,
    prescriptionSummary: prescriptionSummary(c.prescription),
  }));

  return res.json({
    patient,
    receptionVisits,
    appointments,
    consultations: consultationsOut,
    admissions,
    bills,
    labOrders,
  });
}

async function getPatientAnalytics(req, res) {
  const to = parseDateOnly(req.query.to) || new Date();
  const fromRaw = parseDateOnly(req.query.from);
  const from = fromRaw || (() => {
    const d = new Date(to);
    d.setDate(d.getDate() - 30);
    return d;
  })();

  const start = toStartOfDay(from);
  const end = toEndOfDay(to);

  const totalPatientsPromise = prisma.patient.count();
  const newPatientsPromise = prisma.patient.count({ where: { createdAt: { gte: start, lte: end } } });

  const activeByApptPromise = prisma.appointment.findMany({
    where: { date: { gte: start, lte: end } },
    distinct: ['patientId'],
    select: { patientId: true },
    take: 200000,
  });
  const activeByVisitPromise = prisma.receptionVisit.findMany({
    where: { visitDate: { gte: start, lte: end } },
    distinct: ['patientId'],
    select: { patientId: true },
    take: 200000,
  });
  const activeByBillPromise = prisma.bill.findMany({
    where: { billDate: { gte: start, lte: end } },
    distinct: ['patientId'],
    select: { patientId: true },
    take: 200000,
  });

  const regRowsPromise = prisma.patient.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { createdAt: true },
    take: 200000,
  });
  const opdRowsPromise = prisma.appointment.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
    take: 200000,
  });

  const genderGroupPromise = prisma.patient.groupBy({
    by: ['gender'],
    _count: { _all: true },
  });
  const ageRowsPromise = prisma.patient.findMany({
    select: { age: true, address: true },
    take: 200000,
  });

  const opdCountPromise = prisma.appointment.count({ where: { date: { gte: start, lte: end } } });
  const perPatientVisitsPromise = prisma.appointment.groupBy({
    by: ['patientId'],
    where: { date: { gte: start, lte: end } },
    _count: { patientId: true },
    orderBy: { _count: { patientId: 'desc' } },
    take: 5000,
  });

  const deptGroupPromise = prisma.appointment.groupBy({
    by: ['department'],
    where: { date: { gte: start, lte: end } },
    _count: { department: true },
    orderBy: { _count: { department: 'desc' } },
    take: 20,
  });
  const doctorGroupPromise = prisma.appointment.groupBy({
    by: ['doctorId'],
    where: { date: { gte: start, lte: end } },
    _count: { doctorId: true },
    orderBy: { _count: { doctorId: 'desc' } },
    take: 20,
  });

  const diagnosisRowsPromise = prisma.consultation.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { diagnosis: true },
    take: 50000,
  });

  const labTopPromise = prisma.labOrderItem.groupBy({
    by: ['testName'],
    where: { createdAt: { gte: start, lte: end } },
    _count: { testName: true },
    orderBy: { _count: { testName: 'desc' } },
    take: 10,
  });

  const admissionCountPromise = prisma.admission.count({ where: { admissionDate: { gte: start, lte: end } } });

  const [
    totalPatients,
    newPatients,
    activeByAppt,
    activeByVisit,
    activeByBill,
    regRows,
    opdRows,
    genderGrouped,
    ageRows,
    opdCount,
    perPatientVisits,
    deptGrouped,
    doctorGrouped,
    diagnosisRows,
    labTop,
    ipdAdmissions,
  ] = await Promise.all([
    totalPatientsPromise,
    newPatientsPromise,
    activeByApptPromise,
    activeByVisitPromise,
    activeByBillPromise,
    regRowsPromise,
    opdRowsPromise,
    genderGroupPromise,
    ageRowsPromise,
    opdCountPromise,
    perPatientVisitsPromise,
    deptGroupPromise,
    doctorGroupPromise,
    diagnosisRowsPromise,
    labTopPromise,
    admissionCountPromise,
  ]);

  const activeSet = new Set(
    [
      ...(activeByAppt || []).map((x) => x.patientId),
      ...(activeByVisit || []).map((x) => x.patientId),
      ...(activeByBill || []).map((x) => x.patientId),
    ].filter(Boolean),
  );
  const activePatients = activeSet.size;

  const registrationSeries = sumByDay(regRows, 'createdAt');
  const opdSeries = sumByDay(opdRows, 'date');

  const ageBuckets = new Map();
  const cityBuckets = new Map();
  for (const r of ageRows || []) {
    const b = ageBucket(r.age);
    ageBuckets.set(b, (ageBuckets.get(b) || 0) + 1);
    const city = addressToCity(r.address);
    cityBuckets.set(city, (cityBuckets.get(city) || 0) + 1);
  }

  const ageDistribution = Array.from(ageBuckets.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => {
      const order = ['0-12', '13-18', '19-40', '41-60', '60+', 'Unknown'];
      return order.indexOf(a.bucket) - order.indexOf(b.bucket);
    });

  const topCities = Array.from(cityBuckets.entries())
    .map(([city, count]) => ({ city, count }))
    .filter((x) => x.city !== 'Unknown')
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const genderDistribution = (genderGrouped || [])
    .map((g) => ({ gender: g.gender || 'UNKNOWN', count: g._count?._all || 0 }))
    .sort((a, b) => b.count - a.count);

  const patientIdsInRange = (perPatientVisits || []).map((x) => x.patientId).filter(Boolean);
  let firstTimePatients = 0;
  let returningPatients = 0;
  if (patientIdsInRange.length) {
    const minDates = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { patientId: { in: patientIdsInRange } },
      _min: { date: true },
    });
    const startMs = start.getTime();
    for (const r of minDates || []) {
      const md = r?._min?.date ? new Date(r._min.date) : null;
      if (!md || Number.isNaN(md.getTime())) continue;
      if (md.getTime() < startMs) returningPatients += 1;
      else firstTimePatients += 1;
    }
  }

  const topRepeatRaw = (perPatientVisits || []).slice(0, 10);
  const topRepeatIds = topRepeatRaw.map((x) => x.patientId).filter(Boolean);
  const topRepeatPatients = topRepeatIds.length
    ? await prisma.patient.findMany({
        where: { id: { in: topRepeatIds } },
        select: { id: true, name: true, uhid: true, mobile: true },
      })
    : [];
  const byPid = new Map(topRepeatPatients.map((p) => [p.id, p]));
  const topRepeat = topRepeatRaw.map((x) => ({
    patientId: x.patientId,
    patientName: byPid.get(x.patientId)?.name || '—',
    uhid: byPid.get(x.patientId)?.uhid || null,
    mobile: byPid.get(x.patientId)?.mobile || null,
    visits: x._count?.patientId || 0,
  }));

  const doctorIds = (doctorGrouped || []).map((d) => d.doctorId).filter(Boolean);
  const doctorRows = doctorIds.length
    ? await prisma.doctor.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, specialization: true, user: { select: { name: true } } },
      })
    : [];
  const byDoctorId = new Map(doctorRows.map((d) => [d.id, d]));
  const byDoctor = (doctorGrouped || []).map((d) => ({
    doctorId: d.doctorId,
    doctorName: byDoctorId.get(d.doctorId)?.user?.name || '—',
    specialization: byDoctorId.get(d.doctorId)?.specialization || '',
    visits: d._count?.doctorId || 0,
  }));

  const byDepartment = (deptGrouped || []).map((d) => ({
    department: normalizeString(d.department) || 'Unknown',
    visits: d._count?.department || 0,
  }));

  const diagMap = new Map();
  for (const r of diagnosisRows || []) {
    const s = normalizeString(r.diagnosis);
    if (!s) continue;
    const k = s.toLowerCase();
    diagMap.set(k, { label: s, count: (diagMap.get(k)?.count || 0) + 1 });
  }
  const topDiagnoses = Array.from(diagMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);

  const topLabTests = (labTop || []).map((t) => ({ testName: t.testName || '—', count: t._count?.testName || 0 }));

  const opdPatientsDistinct = patientIdsInRange.length;
  const conversionRatePct = opdPatientsDistinct > 0 ? Math.round((ipdAdmissions / opdPatientsDistinct) * 1000) / 10 : 0;

  return res.json({
    range: { from: isoDayKey(start), to: isoDayKey(end) },
    overview: {
      totalPatients,
      newPatients,
      activePatients,
      opdVisits: opdCount,
      ipdAdmissions,
      conversionRatePct,
      firstTimePatients,
      returningPatients,
    },
    series: {
      registrationsByDay: registrationSeries,
      opdVisitsByDay: opdSeries,
    },
    demographics: {
      byGender: genderDistribution,
      byAgeBucket: ageDistribution,
      topCities,
    },
    behavior: {
      topRepeatVisitors: topRepeat,
    },
    mix: {
      byDepartment,
      byDoctor,
    },
    clinical: {
      topDiagnoses,
      topLabTests,
    },
  });
}

module.exports = { listPatients, getPatientHistory, getPatientAnalytics };
