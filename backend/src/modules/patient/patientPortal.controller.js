const bcrypt = require('bcrypt');
const { prisma, withDbRetry } = require('../../config/prisma');

const patientSel = {
  id: true, name: true, uhid: true, registrationNumber: true,
  age: true, gender: true, mobile: true, dob: true,
  aadhaarId: true, address: true, bloodGroup: true, allergies: true,
  heightCm: true, weightKg: true, emergencyName: true, emergencyPhone: true,
  emergencyRelation: true, registrationSource: true, createdAt: true,
};

const genderLabel = (g) =>
  g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : g === 'OTHER' ? 'Other' : null;

function isPaidStatus(v) {
  const s = String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return s === 'PAID';
}

function computeBillStatus(paid, total) {
  const p = Math.max(0, paid);
  const t = Math.max(0, total);
  if (t <= 0) return 'PAID';
  if (p <= 0) return 'PENDING';
  if (p >= t) return 'PAID';
  return 'PARTIAL';
}

function calendarYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function inclusiveAdmissionDays(admissionDate) {
  const start = new Date(admissionDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}

function mapStoredBill(b) {
  return {
    id: b.id,
    billNumber: b.billNumber,
    visitType: b.visitType,
    status: b.status,
    subtotalAmount: b.subtotalAmount,
    discountAmount: b.discountAmount,
    taxAmount: b.taxAmount,
    totalAmount: b.totalAmount,
    paidAmount: b.paidAmount,
    lastPaymentMode: b.lastPaymentMode,
    billDate: b.billDate,
    createdAt: b.createdAt,
    notes: b.notes,
    source: 'BILL',
    items: b.lineItems,
    payments: b.payments,
  };
}

function visitCoveredByStoredBill(visit, storedBills) {
  const fee = visit.registrationFee || 0;
  if (fee <= 0) return true;
  const vDay = calendarYmd(visit.visitDate);
  return storedBills.some((b) => {
    if (b.visitType !== visit.visitType) return false;
    if (calendarYmd(b.billDate) !== vDay) return false;
    return (b.lineItems || []).some((li) => {
      const desc = String(li.description || '').toLowerCase();
      return desc.includes('registration') || desc.includes('opd fee') || desc.includes('consultation');
    });
  });
}

function buildVisitBill(visit) {
  const fee = visit.registrationFee || 0;
  if (fee <= 0) return null;
  const paid = isPaidStatus(visit.paymentStatus) ? fee : 0;
  const dept = visit.department ? ` — ${visit.department}` : '';
  const label = visit.visitType === 'IPD' ? 'IPD registration / admission fee' : 'OPD registration fee';
  return {
    id: `visit-${visit.id}`,
    billNumber: `VISIT-${calendarYmd(visit.visitDate).replace(/-/g, '')}-${visit.visitType}`,
    visitType: visit.visitType,
    status: computeBillStatus(paid, fee),
    subtotalAmount: fee,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: fee,
    paidAmount: paid,
    lastPaymentMode: visit.paymentMode || null,
    billDate: visit.visitDate,
    createdAt: visit.createdAt,
    notes: 'Recorded at reception during registration',
    source: 'VISIT',
    items: [{ description: `${label}${dept}`, quantity: 1, unitPrice: fee, lineTotal: fee }],
    payments: paid > 0
      ? [{ amount: paid, mode: visit.paymentMode || 'Cash', createdAt: visit.createdAt }]
      : [],
  };
}

function buildAppointmentBill(appt) {
  const fee = appt.fee || 0;
  if (fee <= 0) return null;
  const paid = isPaidStatus(appt.paymentStatus) ? fee : 0;
  const doctor = appt.doctor?.user?.name ? ` — Dr. ${appt.doctor.user.name}` : '';
  return {
    id: `appointment-${appt.id}`,
    billNumber: appt.opdNumber || appt.token || `APPT-${calendarYmd(appt.date).replace(/-/g, '')}`,
    visitType: 'OPD',
    status: computeBillStatus(paid, fee),
    subtotalAmount: fee,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: fee,
    paidAmount: paid,
    lastPaymentMode: appt.paymentMode || null,
    billDate: appt.date,
    createdAt: appt.createdAt,
    notes: 'Appointment / consultation fee',
    source: 'APPOINTMENT',
    items: [{ description: `Consultation fee${doctor}`, quantity: 1, unitPrice: fee, lineTotal: fee }],
    payments: paid > 0
      ? [{ amount: paid, mode: appt.paymentMode || 'Cash', createdAt: appt.createdAt }]
      : [],
  };
}

function buildAdmissionBill(admission) {
  const billing = admission.billing;
  if (!billing) return null;
  const days = inclusiveAdmissionDays(admission.admissionDate);
  const admissionCharge = Math.max(0, billing.admissionCharge || 0);
  const roomCharge = Math.max(0, (billing.roomChargePerDay || 0) * days);
  const totalAmount = admissionCharge + roomCharge;
  if (totalAmount <= 0 && (billing.advance || 0) <= 0) return null;

  const paidAmount = Math.min(Math.max(0, billing.advance || 0), totalAmount || billing.advance || 0);
  const items = [];
  if (admissionCharge > 0) {
    items.push({ description: 'Admission charge', quantity: 1, unitPrice: admissionCharge, lineTotal: admissionCharge });
  }
  if (roomCharge > 0) {
    items.push({
      description: `Room charge (${days} day${days === 1 ? '' : 's'})`,
      quantity: days,
      unitPrice: billing.roomChargePerDay || 0,
      lineTotal: roomCharge,
    });
  }
  if (!items.length && billing.advance > 0) {
    items.push({ description: 'Advance payment at admission', quantity: 1, unitPrice: billing.advance, lineTotal: billing.advance });
  }

  const effectiveTotal = totalAmount > 0 ? totalAmount : paidAmount;
  const payments = paidAmount > 0
    ? [{ amount: paidAmount, mode: billing.paymentMode || 'Cash', createdAt: billing.createdAt }]
    : [];

  return {
    id: `admission-${admission.id}`,
    billNumber: admission.ipdNumber || `IPD-${calendarYmd(admission.admissionDate).replace(/-/g, '')}`,
    visitType: 'IPD',
    status: computeBillStatus(paidAmount, effectiveTotal),
    subtotalAmount: effectiveTotal,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: effectiveTotal,
    paidAmount,
    lastPaymentMode: billing.paymentMode || null,
    billDate: admission.admissionDate,
    createdAt: admission.admissionDate,
    notes: admission.dischargeDate
      ? 'IPD stay charges (estimate from admission billing)'
      : 'IPD stay charges to date (estimate — final bill at discharge)',
    source: 'ADMISSION',
    items,
    payments,
  };
}

exports.getDashboard = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const patient = await prisma.patient.findUnique({ where: { id: pid }, select: patientSel });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const [upcomingAppts, pendingBills, lastConsultation, recentLabOrders, activeOt, hasAnyAppt, currentAdmission, anyOtRequest, recoveryRecord] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: pid, date: { gte: new Date() }, status: { not: 'COMPLETED' } },
        orderBy: { date: 'asc' }, take: 3,
        include: { doctor: { select: { id: true, specialization: true, user: { select: { name: true } } } } },
      }),
      prisma.bill.findMany({
        where: { patientId: pid, status: { in: ['PENDING', 'PARTIAL'] } },
        orderBy: { createdAt: 'desc' }, take: 3,
      }),
      prisma.consultation.findFirst({
        where: { patientId: pid },
        orderBy: { createdAt: 'desc' },
        include: { doctor: { select: { id: true, specialization: true, user: { select: { name: true } } } } },
      }),
      prisma.labOrder.findMany({
        where: { patientId: pid },
        orderBy: { createdAt: 'desc' }, take: 3,
        include: { items: { select: { testName: true } } },
      }),
      prisma.otRequest.findFirst({
        where: { patientId: pid, status: { notIn: ['COMPLETED', 'PAYMENT_PENDING'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          surgerySchedule: { include: { otRoom: { select: { roomName: true } }, surgeon: { select: { user: { select: { name: true } } } } } },
        },
      }),
      prisma.appointment.count({ where: { patientId: pid } }),
      prisma.admission.findFirst({
        where: { patientId: pid },
        orderBy: { admissionDate: 'desc' },
        select: { id: true, ipdNumber: true, status: true, admissionDate: true, dischargeDate: true, dischargeSummaryData: true },
      }),
      prisma.otRequest.findFirst({
        where: { patientId: pid },
        orderBy: { createdAt: 'desc' },
        select: { id: true, requestNumber: true, status: true },
      }),
      prisma.otRequest.findFirst({
        where: { patientId: pid, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }).then((ot) => ot ? prisma.surgerySchedule.findFirst({
        where: { otRequestId: ot.id },
        select: { id: true },
      }).then((ss) => ss ? prisma.surgerySession.findFirst({
        where: { surgeryScheduleId: ss.id },
        select: { id: true },
      }).then((ses) => ses ? prisma.recoveryRecord.findFirst({
        where: { surgerySessionId: ses.id },
        select: { id: true, status: true, transferredTo: true, transferredAt: true, transferRequestStatus: true },
      }) : null) : null) : null),
    ]);

    let otSurgeryStatus = 'NONE';
    let recoveryStatus = null;
    if (anyOtRequest) {
      const s = anyOtRequest.status;
      if (s === 'SCHEDULED' || s === 'IN_PROGRESS') otSurgeryStatus = 'SCHEDULED';
      if (s === 'COMPLETED') otSurgeryStatus = 'COMPLETED';
      if (s === 'OT_REQUEST_CREATED' || s === 'PAYMENT_PENDING' || s === 'PAYMENT_COMPLETED' || s === 'APPROVED_FOR_OT' || s === 'RECEIVED_BY_OT') otSurgeryStatus = 'PENDING';
    }
    if (recoveryRecord) {
      recoveryStatus = recoveryRecord.status || null;
    }
    const apptHasAny = hasAnyAppt > 0;
    const admitted = !!currentAdmission;
    const discharged = admitted && !!currentAdmission.dischargeDate;
    const otApplied = !!anyOtRequest;

    const journeyStages = ['REGISTERED', 'OPD', 'IPD_ADMISSION'];
    if (otApplied) journeyStages.push('OT_SCHEDULED', 'SURGERY_COMPLETED', 'RECOVERY', 'READY_FOR_TRANSFER', 'WARD_TRANSFER');
    journeyStages.push('DISCHARGED');

    let currentStage = 0;
    if (discharged) currentStage = journeyStages.length - 1;
    else if (currentAdmission && recoveryStatus === 'TRANSFERRED') currentStage = Math.max(currentStage, journeyStages.indexOf('WARD_TRANSFER'));
    else if (currentAdmission && recoveryStatus === 'READY_FOR_TRANSFER') currentStage = Math.max(currentStage, journeyStages.indexOf('READY_FOR_TRANSFER'));
    else if (currentAdmission && recoveryStatus && ['UNDER_OBSERVATION', 'STABLE'].includes(recoveryStatus)) currentStage = Math.max(currentStage, journeyStages.indexOf('RECOVERY'));
    else if (otApplied && otSurgeryStatus === 'COMPLETED') currentStage = Math.max(currentStage, journeyStages.indexOf('SURGERY_COMPLETED'));
    else if (otApplied && otSurgeryStatus === 'SCHEDULED' || otSurgeryStatus === 'PENDING') currentStage = Math.max(currentStage, journeyStages.indexOf('OT_SCHEDULED'));
    else if (admitted) currentStage = Math.max(currentStage, journeyStages.indexOf('IPD_ADMISSION'));
    else if (apptHasAny) currentStage = Math.max(currentStage, journeyStages.indexOf('OPD'));
    else currentStage = Math.max(currentStage, journeyStages.indexOf('REGISTERED'));

    const careJourney = { stages: journeyStages, currentStage, otApplied, discharged };

    return res.json({
      patient: { ...patient, gender: genderLabel(patient.gender) },
      upcomingAppointments: upcomingAppts.map((a) => ({
        id: a.id, date: a.date, time: a.time, token: a.token,
        doctor: a.doctor?.user?.name, specialization: a.doctor?.specialization,
        status: a.status, department: a.department,
      })),
      pendingBills: pendingBills.map((b) => ({
        id: b.id, billNumber: b.billNumber, totalAmount: b.totalAmount,
        paidAmount: b.paidAmount, status: b.status, billDate: b.billDate,
      })),
      latestPrescription: lastConsultation ? {
        id: lastConsultation.id, date: lastConsultation.createdAt,
        doctor: lastConsultation.doctor?.user?.name,
        diagnosis: lastConsultation.diagnosis,
        medicines: lastConsultation.prescription,
      } : null,
      recentLabReports: recentLabOrders.map((l) => ({
        id: l.id, orderNumber: l.orderNumber, status: l.status,
        reportStatus: l.reportStatus, tests: l.items.map((i) => i.testName),
        createdAt: l.createdAt,
      })),
      activeOtRequest: activeOt ? {
        id: activeOt.id, requestNumber: activeOt.requestNumber,
        status: activeOt.status, surgeryDate: activeOt.expectedSurgeryDate,
        room: activeOt.surgerySchedule?.otRoom?.roomName,
        surgeon: activeOt.surgerySchedule?.surgeon?.user?.name,
      } : null,
      careJourney,
    });
  } catch (err) {
    console.error('Patient dashboard error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { filter = 'all', search } = req.query;
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const where = { patientId: pid };

    if (filter === 'today') {
      where.date = { gte: todayStart, lt: todayEnd };
    } else if (filter === 'upcoming') {
      where.date = { gte: now };
      where.status = { not: 'COMPLETED' };
    } else if (filter === 'completed') {
      where.status = 'COMPLETED';
    }

    if (search) {
      where.OR = [
        { doctor: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { department: { contains: search, mode: 'insensitive' } },
        { opdNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        doctor: { select: { specialization: true, user: { select: { name: true } } } },
        consultations: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    const [upcomingCount, completedCount, todayCount, waitingCount, inProgressCount, totalCount] = await Promise.all([
      prisma.appointment.count({ where: { patientId: pid, date: { gte: now }, status: { not: 'COMPLETED' } } }),
      prisma.appointment.count({ where: { patientId: pid, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { patientId: pid, date: { gte: todayStart, lt: todayEnd } } }),
      prisma.appointment.count({ where: { patientId: pid, status: 'WAITING' } }),
      prisma.appointment.count({ where: { patientId: pid, status: 'IN_PROGRESS' } }),
      prisma.appointment.count({ where: { patientId: pid } }),
    ]);

    const map = (a) => ({
      id: a.id,
      opdNumber: a.opdNumber,
      date: a.date,
      time: a.time,
      token: a.token,
      department: a.department,
      doctor: a.doctor?.user?.name,
      specialization: a.doctor?.specialization,
      fee: a.fee,
      paymentStatus: a.paymentStatus,
      status: a.status,
      createdAt: a.createdAt,
      hasConsultation: a.consultations.length > 0,
    });

    return res.json({
      appointments: appointments.map(map),
      stats: {
        upcoming: upcomingCount,
        completed: completedCount,
        today: todayCount,
        waiting: waitingCount,
        inProgress: inProgressCount,
        totalCount,
        total: totalCount,
      },
    });
  } catch (err) {
    console.error('Patient appointments error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAppointmentById = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { id } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, patientId: pid },
      include: {
        patient: {
          select: { name: true, mobile: true, age: true, gender: true, address: true, weightKg: true, registrationNumber: true, uhid: true },
        },
        doctor: {
          select: {
            specialization: true,
            qualification: true,
            experienceYears: true,
            user: { select: { name: true, phone: true } },
          },
        },
        consultations: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { labOrders: { take: 3, orderBy: { createdAt: 'desc' }, select: { orderNumber: true, status: true } } },
        },
        bills: { take: 1, orderBy: { createdAt: 'desc' }, select: { billNumber: true, totalAmount: true, status: true } },
      },
    });

    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const consultation = appointment.consultations[0] || null;
    const p = appointment.patient;

    return res.json({
      appointment: {
        id: appointment.id,
        opdNumber: appointment.opdNumber,
        token: appointment.token,
        date: appointment.date,
        time: appointment.time,
        department: appointment.department,
        fee: appointment.fee,
        paymentMode: appointment.paymentMode,
        paymentStatus: appointment.paymentStatus,
        status: appointment.status,
        createdAt: appointment.createdAt,
        patientName: p?.name || '',
        uhid: p?.uhid || '',
        registrationNumber: p?.registrationNumber || '',
        mobile: p?.mobile || '',
        age: p?.age ?? null,
        gender: p?.gender || null,
        address: p?.address || '',
        weight: p?.weightKg ?? null,
        doctorName: appointment.doctor?.user?.name || '',
        doctor: {
          name: appointment.doctor?.user?.name,
          specialization: appointment.doctor?.specialization,
          qualification: appointment.doctor?.qualification,
          experienceYears: appointment.doctor?.experienceYears,
          phone: appointment.doctor?.user?.phone,
        },
        consultation: consultation
          ? {
              id: consultation.id,
              symptoms: consultation.symptoms,
              diagnosis: consultation.diagnosis,
              prescription: consultation.prescription,
              followUpDate: consultation.followUpDate,
              createdAt: consultation.createdAt,
              labOrders: consultation.labOrders,
            }
          : null,
        bill: appointment.bills[0] || null,
      },
    });
  } catch (err) {
    console.error('Patient appointment detail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getTimeline = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const patient = await prisma.patient.findUnique({ where: { id: pid }, select: { id: true, name: true, uhid: true, createdAt: true } });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const [visits, consultations, admissions, otRequests] = await Promise.all([
      prisma.receptionVisit.findMany({ where: { patientId: pid }, orderBy: { visitDate: 'asc' } }),
      prisma.consultation.findMany({ where: { patientId: pid }, orderBy: { createdAt: 'asc' }, include: { doctor: { select: { user: { select: { name: true } } } } } }),
      prisma.admission.findMany({ where: { patientId: pid }, orderBy: { createdAt: 'asc' }, include: { nurse: { select: { name: true } }, ward: { select: { name: true } } } }),
      prisma.otRequest.findMany({ where: { patientId: pid }, orderBy: { createdAt: 'asc' }, include: { statusHistory: { orderBy: { createdAt: 'asc' } } } }),
    ]);

    const timeline = [];
    timeline.push({ date: patient.createdAt, type: 'REGISTRATION', title: 'Patient Registered', description: `UHID: ${patient.uhid}`, icon: 'person_add' });
    for (const v of visits) {
      timeline.push({ date: v.visitDate, type: 'VISIT', title: `${v.visitType} Visit`, description: v.department ? `Department: ${v.department}` : null, icon: 'calendar_today' });
    }
    for (const c of consultations) {
      timeline.push({ date: c.createdAt, type: 'CONSULTATION', title: 'Consultation', description: `Dr. ${c.doctor?.user?.name || ''} — ${c.diagnosis?.slice(0, 80) || ''}`, icon: 'medical_services' });
    }
    for (const a of admissions) {
      timeline.push({ date: a.admissionDate, type: 'ADMISSION', title: 'Admitted', description: a.ward?.name ? `Ward: ${a.ward.name}` : null, icon: 'bed' });
      if (a.nurse) timeline.push({ date: a.admissionDate, type: 'NURSE_ASSIGNED', title: 'Nurse Assigned', description: a.nurse.name, icon: 'assignment_ind' });
      if (a.dischargeDate) timeline.push({ date: a.dischargeDate, type: 'DISCHARGE', title: 'Discharged', description: null, icon: 'exit_to_app' });
    }
    for (const o of otRequests) {
      timeline.push({ date: o.createdAt, type: 'OT_REQUEST', title: 'OT Request Created', description: o.surgeryRecommendation, icon: 'local_hospital' });
      for (const h of o.statusHistory) {
        const labels = { APPROVED_FOR_OT: 'OT Approved', SCHEDULED: 'Surgery Scheduled', IN_PROGRESS: 'Surgery In Progress', COMPLETED: 'Surgery Completed' };
        timeline.push({ date: h.createdAt, type: `OT_${h.status}`, title: labels[h.status] || h.status, description: null, icon: 'check_circle' });
      }
    }

    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    return res.json({ timeline });
  } catch (err) {
    console.error('Patient timeline error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAdmissions = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { filter = 'all' } = req.query;

    const where = { patientId: pid };
    if (filter === 'current') where.status = { in: ['ADMITTED', 'UNDER_TREATMENT', 'DISCHARGE_REQUESTED'] };
    else if (filter === 'past') where.status = 'READY_FOR_DISCHARGE';
    else if (filter === 'discharged') where.dischargeDate = { not: null };

    const admissions = await prisma.admission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { uhid: true, name: true, mobile: true, age: true, gender: true } },
        doctor: { select: { specialization: true, user: { select: { name: true } } } },
        nurse: { select: { name: true } },
        ward: { select: { id: true, name: true, type: true } },
        bed: { select: { code: true, status: true } },
        billing: { select: { admissionCharge: true, roomChargePerDay: true, advance: true, paymentMode: true, paymentStatus: true } },
        transfers: { orderBy: { createdAt: 'asc' }, include: { fromBed: { select: { code: true, ward: { select: { name: true } } } }, toBed: { select: { code: true, ward: { select: { name: true } } } } } },
        treatmentPlan: { select: { id: true, description: true } },
        vitalsRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const currentAdmission = admissions.find((a) => !a.dischargeDate && a.status !== 'READY_FOR_DISCHARGE') || null;
    const pastAdmissions = admissions.filter((a) => a.dischargeDate || a.status === 'READY_FOR_DISCHARGE');

    return res.json({
      admissions: admissions.map((a) => ({
        id: a.id, ipdNumber: a.ipdNumber,
        uhid: a.patient?.uhid,
        admissionDate: a.admissionDate, status: a.status,
        clinicalCondition: a.clinicalCondition,
        department: a.department, admissionType: a.admissionType,
        doctor: a.doctor?.user?.name, doctorSpecialization: a.doctor?.specialization,
        nurse: a.nurse?.name,
        ward: a.ward?.name, wardType: a.ward?.type,
        bed: a.bed?.code,
        dischargeDate: a.dischargeDate,
        dischargeSummaryData: a.dischargeSummaryData,
        billing: a.billing ? {
          admissionCharge: a.billing.admissionCharge,
          roomChargePerDay: a.billing.roomChargePerDay,
          advance: a.billing.advance,
          paymentMode: a.billing.paymentMode,
          paymentStatus: a.billing.paymentStatus,
        } : null,
        latestVitals: a.vitalsRecords[0] || null,
        hasTreatmentPlan: !!a.treatmentPlan,
        transfers: a.transfers.map((t) => ({
          from: t.fromBed?.code,
          fromWard: t.fromBed?.ward?.name,
          to: t.toBed?.code,
          toWard: t.toBed?.ward?.name,
          reason: t.reason,
          date: t.createdAt,
        })),
      })),
      currentAdmission: currentAdmission ? {
        id: currentAdmission.id, ipdNumber: currentAdmission.ipdNumber,
        uhid: currentAdmission.patient?.uhid,
        admissionDate: currentAdmission.admissionDate, status: currentAdmission.status,
        clinicalCondition: currentAdmission.clinicalCondition,
        department: currentAdmission.department, admissionType: currentAdmission.admissionType,
        doctor: currentAdmission.doctor?.user?.name, doctorSpecialization: currentAdmission.doctor?.specialization,
        nurse: currentAdmission.nurse?.name,
        ward: currentAdmission.ward?.name, wardType: currentAdmission.ward?.type,
        bed: currentAdmission.bed?.code,
        dischargeDate: currentAdmission.dischargeDate,
        billing: currentAdmission.billing ? {
          admissionCharge: currentAdmission.billing.admissionCharge,
          roomChargePerDay: currentAdmission.billing.roomChargePerDay,
          advance: currentAdmission.billing.advance,
          paymentMode: currentAdmission.billing.paymentMode,
          paymentStatus: currentAdmission.billing.paymentStatus,
        } : null,
        transfers: currentAdmission.transfers.map((t) => ({
          from: t.fromBed?.code,
          fromWard: t.fromBed?.ward?.name,
          to: t.toBed?.code,
          toWard: t.toBed?.ward?.name,
          reason: t.reason,
          date: t.createdAt,
        })),
      } : null,
      stats: {
        current: admissions.filter((a) => !a.dischargeDate && a.status !== 'READY_FOR_DISCHARGE').length,
        past: pastAdmissions.length,
        discharged: admissions.filter((a) => a.status === 'READY_FOR_DISCHARGE' || a.dischargeDate).length,
        active: admissions.filter((a) => !a.dischargeDate).length,
      },
    });
  } catch (err) {
    console.error('Patient admissions error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAdmissionById = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { id } = req.params;

    const admission = await prisma.admission.findFirst({
      where: { id, patientId: pid },
      include: {
        patient: { select: { uhid: true, name: true, mobile: true, age: true, gender: true, address: true, bloodGroup: true, weightKg: true } },
        doctor: { select: { specialization: true, qualification: true, experienceYears: true, user: { select: { name: true, phone: true } } } },
        nurse: { select: { name: true, email: true, phone: true } },
        ward: { select: { id: true, name: true, type: true, isActive: true } },
        bed: { select: { id: true, code: true, status: true } },
        billing: { select: { admissionCharge: true, roomChargePerDay: true, advance: true, paymentMode: true, paymentStatus: true } },
        treatmentPlan: { select: { id: true, description: true, instructions: true, medicines: true, updatedAt: true } },
        transfers: {
          orderBy: { createdAt: 'asc' },
          include: {
            fromBed: { select: { code: true, ward: { select: { name: true, type: true } } } },
            toBed: { select: { code: true, ward: { select: { name: true, type: true } } } },
            createdBy: { select: { name: true, role: true } },
          },
        },
        vitalsRecords: { orderBy: { createdAt: 'desc' }, take: 5 },
        otRequests: { select: { id: true, requestNumber: true, status: true, createdAt: true, expectedSurgeryDate: true, surgeryRecommendation: true } },
        notes: { orderBy: { createdAt: 'desc' }, take: 5, select: { note: true, createdAt: true } },
      },
    });

    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    return res.json({
      admission: {
        id: admission.id, ipdNumber: admission.ipdNumber,
        uhid: admission.patient?.uhid, patientName: admission.patient?.name,
        patientMobile: admission.patient?.mobile, patientAge: admission.patient?.age,
        patientGender: admission.patient?.gender, patientAddress: admission.patient?.address,
        patientBloodGroup: admission.patient?.bloodGroup, patientWeight: admission.patient?.weightKg,
        admissionDate: admission.admissionDate, createdAt: admission.createdAt,
        dischargeDate: admission.dischargeDate, dischargeRequestedAt: admission.dischargeRequestedAt,
        status: admission.status, clinicalCondition: admission.clinicalCondition,
        department: admission.department, admissionType: admission.admissionType,
        notesText: admission.notesText, dischargeSummaryData: admission.dischargeSummaryData,
        doctor: {
          name: admission.doctor?.user?.name,
          specialization: admission.doctor?.specialization,
          qualification: admission.doctor?.qualification,
          experienceYears: admission.doctor?.experienceYears,
          phone: admission.doctor?.user?.phone,
        },
        nurse: {
          name: admission.nurse?.name,
          email: admission.nurse?.email,
          phone: admission.nurse?.phone,
        },
        ward: {
          name: admission.ward?.name,
          type: admission.ward?.type,
          isActive: admission.ward?.isActive,
        },
        bed: {
          code: admission.bed?.code,
          status: admission.bed?.status,
        },
        billing: admission.billing ? {
          admissionCharge: admission.billing.admissionCharge,
          roomChargePerDay: admission.billing.roomChargePerDay,
          advance: admission.billing.advance,
          paymentMode: admission.billing.paymentMode,
          paymentStatus: admission.billing.paymentStatus,
        } : null,
        treatmentPlan: admission.treatmentPlan ? {
          description: admission.treatmentPlan.description,
          instructions: admission.treatmentPlan.instructions,
          medicines: admission.treatmentPlan.medicines,
          updatedAt: admission.treatmentPlan.updatedAt,
        } : null,
        transfers: admission.transfers.map((t) => ({
          id: t.id,
          fromBed: t.fromBed?.code, fromWard: t.fromBed?.ward?.name, fromWardType: t.fromBed?.ward?.type,
          toBed: t.toBed?.code, toWard: t.toBed?.ward?.name, toWardType: t.toBed?.ward?.type,
          reason: t.reason,
          date: t.createdAt,
          createdBy: t.createdBy?.name,
        })),
        otRequests: admission.otRequests.map((o) => ({
          id: o.id, requestNumber: o.requestNumber, status: o.status,
          createdAt: o.createdAt, expectedSurgeryDate: o.expectedSurgeryDate,
          surgeryRecommendation: o.surgeryRecommendation,
        })),
        vitals: admission.vitalsRecords.map((v) => ({
          id: v.id, bp: v.bp, pulse: v.pulse, spo2: v.spo2, temp: v.temp,
          recordedAt: v.createdAt,
        })),
        notes: admission.notes.map((n) => ({ text: n.note, date: n.createdAt })),
      },
    });
  } catch (err) {
    console.error('Patient admission detail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getPrescriptions = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const consultations = await prisma.consultation.findMany({
      where: { patientId: pid, prescription: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: { doctor: { select: { id: true, specialization: true, user: { select: { name: true } } } } },
    });

    return res.json({
      prescriptions: consultations.map((c) => ({
        id: c.id, date: c.createdAt,
        doctor: c.doctor?.user?.name, specialization: c.doctor?.specialization,
        diagnosis: c.diagnosis, symptoms: c.symptoms,
        medicines: c.prescription,
        followUpDate: c.followUpDate,
      })),
    });
  } catch (err) {
    console.error('Patient prescriptions error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getLabReports = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { filter = 'all', search } = req.query;

    const where = { patientId: pid };

    if (filter === 'pending') where.status = { in: ['PENDING_BILLING', 'BILLED'] };
    else if (filter === 'in_progress') where.status = { in: ['COLLECTED', 'IN_PROGRESS'] };
    else if (filter === 'completed') where.reportStatus = 'COMPLETED';
    else if (filter === 'critical') where.status = 'COMPLETED';
    else if (filter === 'this_month') {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { items: { some: { testName: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const orders = await prisma.labOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { select: { user: { select: { name: true } } } },
        items: { select: { id: true, testName: true, category: true, unit: true, referenceRange: true } },
        results: { select: { id: true, testName: true, value: true, unit: true, referenceRange: true, remarks: true, attachmentUrl: true, createdAt: true } },
      },
    });

    const [totalCount, pendingCount, completedCount] = await Promise.all([
      prisma.labOrder.count({ where: { patientId: pid } }),
      prisma.labOrder.count({ where: { patientId: pid, status: { in: ['PENDING_BILLING', 'BILLED', 'COLLECTED', 'IN_PROGRESS'] } } }),
      prisma.labOrder.count({ where: { patientId: pid, reportStatus: 'COMPLETED' } }),
    ]);

    return res.json({
      labReports: orders.map((o) => ({
        id: o.id, orderNumber: o.orderNumber,
        status: o.status, reportStatus: o.reportStatus,
        doctor: o.doctor?.user?.name, notes: o.notes,
        createdAt: o.createdAt, updatedAt: o.updatedAt,
        items: o.items,
        results: o.results,
      })),
      stats: {
        total: totalCount,
        pending: pendingCount,
        completed: completedCount,
        critical: completedCount,
      },
    });
  } catch (err) {
    console.error('Patient lab reports error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getLabReportById = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { id } = req.params;

    const order = await prisma.labOrder.findFirst({
      where: { id, patientId: pid },
      include: {
        patient: { select: { name: true, uhid: true, mobile: true, age: true, gender: true, bloodGroup: true } },
        doctor: { select: { user: { select: { name: true, phone: true } }, specialization: true } },
        items: { select: { id: true, testName: true, category: true, unit: true, referenceRange: true, price: true } },
        results: { orderBy: { createdAt: 'asc' }, select: { id: true, testName: true, value: true, unit: true, referenceRange: true, remarks: true, attachmentUrl: true, createdAt: true } },
        bill: { select: { billNumber: true, totalAmount: true, status: true } },
        appointment: { select: { id: true, date: true } },
        consultation: { select: { id: true, createdAt: true } },
      },
    });

    if (!order) return res.status(404).json({ message: 'Lab report not found' });

    return res.json({
      labReport: {
        id: order.id, orderNumber: order.orderNumber,
        status: order.status, reportStatus: order.reportStatus,
        notes: order.notes, createdAt: order.createdAt, updatedAt: order.updatedAt,
        patient: {
          name: order.patient?.name, uhid: order.patient?.uhid,
          mobile: order.patient?.mobile, age: order.patient?.age,
          gender: order.patient?.gender, bloodGroup: order.patient?.bloodGroup,
        },
        doctorName: order.doctor?.user?.name,
        doctorSpecialization: order.doctor?.specialization,
        doctorPhone: order.doctor?.user?.phone,
        items: order.items,
        results: order.results,
        bill: order.bill ? { billNumber: order.bill.billNumber, totalAmount: order.bill.totalAmount, status: order.bill.status } : null,
        appointmentDate: order.appointment?.date,
        consultationDate: order.consultation?.createdAt,
      },
    });
  } catch (err) {
    console.error('Patient lab report detail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getOtSurgery = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { filter = 'all' } = req.query;

    const where = { patientId: pid };
    if (filter === 'scheduled') where.status = { in: ['APPROVED_FOR_OT', 'SCHEDULED'] };
    else if (filter === 'in_progress') where.status = { in: ['IN_PROGRESS', 'IN_RECOVERY'] };
    else if (filter === 'completed') where.status = 'COMPLETED';
    else if (filter === 'recovery') where.status = 'IN_RECOVERY';

    const otRequests = await prisma.otRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { uhid: true, name: true } },
        doctor: { select: { specialization: true, user: { select: { name: true } } } },
        nurse: { select: { name: true, phone: true } },
        admission: { select: { ipdNumber: true } },
        preOperativeAssessment: { select: { status: true, assessmentDate: true } },
        surgerySchedule: {
          include: {
            otRoom: { select: { roomNumber: true, roomName: true } },
            surgeon: { select: { specialization: true, user: { select: { name: true } } } },
            assistantSurgeon: { select: { user: { select: { name: true } } } },
            anaesthetist: { select: { user: { select: { name: true } } } },
            otNurse: { select: { name: true } },
            surgerySession: {
              include: {
                postSurgeryNote: true,
                recoveryRecord: {
                  include: {
                    assignedNurse: { select: { name: true } },
                    timeline: { orderBy: { createdAt: 'asc' } },
                    assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
                    transfers: { orderBy: { createdAt: 'desc' } },
                  },
                },
              },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    const [totalCount, scheduledCount, completedCount, recoveryCount, medicineIssues] = await Promise.all([
      prisma.otRequest.count({ where: { patientId: pid } }),
      prisma.otRequest.count({ where: { patientId: pid, status: { in: ['APPROVED_FOR_OT', 'SCHEDULED'] } } }),
      prisma.otRequest.count({ where: { patientId: pid, status: 'COMPLETED' } }),
      prisma.otRequest.count({ where: { patientId: pid, status: 'IN_RECOVERY' } }),
      prisma.otMedicineIssue.findMany({
        where: { patientId: pid },
        include: { items: true, movements: { orderBy: { movementAt: 'desc' }, take: 20 } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const medicineBySession = {};
    for (const m of medicineIssues) {
      const sid = m.surgerySessionId;
      if (!medicineBySession[sid]) medicineBySession[sid] = [];
      medicineBySession[sid].push(m);
    }

    const currentSurgery = otRequests.find(
      (o) => !['OT_REQUEST_CREATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'COMPLETED'].includes(o.status)
    ) || null;

    return res.json({
      otRequests: otRequests.map((o) => {
        const pn = o.surgerySchedule?.surgerySession?.postSurgeryNote;
        const rc = o.surgerySchedule?.surgerySession?.recoveryRecord;
        return {
          id: o.id, requestNumber: o.requestNumber, uhid: o.patient?.uhid,
          diagnosis: o.diagnosis, surgeryRecommendation: o.surgeryRecommendation,
          priority: o.priority, status: o.status,
          expectedSurgeryDate: o.expectedSurgeryDate,
          notes: o.notes, createdAt: o.createdAt, updatedAt: o.updatedAt,
          doctor: o.doctor?.user?.name, doctorSpecialization: o.doctor?.specialization,
          nurse: o.nurse?.name, nursePhone: o.nurse?.phone,
          ipdNumber: o.admission?.ipdNumber,
          preOpAssessment: o.preOperativeAssessment ? {
            status: o.preOperativeAssessment.status,
            assessmentDate: o.preOperativeAssessment.assessmentDate,
          } : null,
          schedule: o.surgerySchedule ? {
            surgeryDate: o.surgerySchedule.surgeryDate,
            startTime: o.surgerySchedule.startTime,
            estimatedDuration: o.surgerySchedule.estimatedDuration,
            room: `${o.surgerySchedule.otRoom?.roomName || ''} (${o.surgerySchedule.otRoom?.roomNumber || ''})`,
            roomName: o.surgerySchedule.otRoom?.roomName,
            roomNumber: o.surgerySchedule.otRoom?.roomNumber,
            surgeon: o.surgerySchedule.surgeon?.user?.name,
            surgeonSpecialization: o.surgerySchedule.surgeon?.specialization,
            assistantSurgeon: o.surgerySchedule.assistantSurgeon?.user?.name,
            anaesthetist: o.surgerySchedule.anaesthetist?.user?.name,
            otNurse: o.surgerySchedule.otNurse?.name,
            status: o.surgerySchedule.status,
            session: o.surgerySchedule.surgerySession ? {
              startTime: o.surgerySchedule.surgerySession.startTime,
              endTime: o.surgerySchedule.surgerySession.endTime,
              status: o.surgerySchedule.surgerySession.status,
              postSurgeryNote: pn ? {
                id: pn.id,
                surgeryOutcome: pn.surgeryOutcome,
                procedureSummary: pn.procedureSummary,
                operationFindings: pn.operationFindings,
                surgeonNotes: pn.surgeonNotes,
                complications: pn.complications,
                bloodLoss: pn.bloodLoss,
                specialInstructions: pn.specialInstructions,
                followUpInstructions: pn.followUpInstructions,
                preOperativeDiagnosis: pn.preOperativeDiagnosis,
                postOperativeDiagnosis: pn.postOperativeDiagnosis,
                anaesthesiaType: pn.anaesthesiaType,
                implantsUsed: pn.implantsUsed,
                specimenCollected: pn.specimenCollected,
                dischargeRecommendation: pn.dischargeRecommendation,
                medicines: pn.medicines,
                createdAt: pn.createdAt,
                updatedAt: pn.updatedAt,
              } : null,
              recoveryRecord: rc ? {
                id: rc.id, status: rc.status,
                admittedAt: rc.admittedAt, dischargedAt: rc.dischargedAt,
                transferredTo: rc.transferredTo, transferredAt: rc.transferredAt,
                assignedNurse: rc.assignedNurse?.name,
                painScore: rc.painScore, consciousnessLevel: rc.consciousnessLevel,
                surgicalSiteAssessment: rc.surgicalSiteAssessment,
                recoveryNotes: rc.recoveryNotes,
                bpSystolic: rc.bpSystolic, bpDiastolic: rc.bpDiastolic,
                pulse: rc.pulse, temperature: rc.temperature,
                spo2: rc.spo2, respiratoryRate: rc.respiratoryRate,
                timeline: rc.timeline?.map((t) => ({
                  id: t.id, eventType: t.eventType,
                  eventDescription: t.eventDescription, createdAt: t.createdAt,
                })) || [],
                assessments: rc.assessments?.map((a) => ({
                  id: a.id, bpSystolic: a.bpSystolic, bpDiastolic: a.bpDiastolic,
                  pulse: a.pulse, temperature: a.temperature, spo2: a.spo2,
                  painScore: a.painScore, consciousnessLevel: a.consciousnessLevel,
                  recoveryNotes: a.recoveryNotes, createdAt: a.createdAt,
                })) || [],
                transfers: rc.transfers?.map((t) => ({
                  id: t.id, transferType: t.transferType,
                  fromLocation: t.fromLocation, toLocation: t.toLocation,
                  reason: t.reason, createdAt: t.createdAt,
                })) || [],
              } : null,
            } : null,
          } : null,
          statusHistory: o.statusHistory.map((h) => ({
            id: h.id, status: h.status, createdAt: h.createdAt,
          })),
          medicines: o.surgerySchedule?.surgerySession?.id
            ? (medicineBySession[o.surgerySchedule.surgerySession.id] || []).map((m) => ({
                id: m.id, issueNumber: m.issueNumber, status: m.status,
                createdAt: m.createdAt, items: m.items,
              }))
            : [],
        };
      }),
      currentSurgery: currentSurgery ? (() => {
        const o = currentSurgery;
        const pn = o.surgerySchedule?.surgerySession?.postSurgeryNote;
        const rc = o.surgerySchedule?.surgerySession?.recoveryRecord;
        return {
          id: o.id, requestNumber: o.requestNumber,
          diagnosis: o.diagnosis, surgeryRecommendation: o.surgeryRecommendation,
          priority: o.priority, status: o.status,
          expectedSurgeryDate: o.expectedSurgeryDate,
          doctor: o.doctor?.user?.name, nurse: o.nurse?.name,
          schedule: o.surgerySchedule ? {
            surgeryDate: o.surgerySchedule.surgeryDate,
            startTime: o.surgerySchedule.startTime,
            estimatedDuration: o.surgerySchedule.estimatedDuration,
            room: `${o.surgerySchedule.otRoom?.roomName || ''} (${o.surgerySchedule.otRoom?.roomNumber || ''})`,
            surgeon: o.surgerySchedule.surgeon?.user?.name,
            assistantSurgeon: o.surgerySchedule.assistantSurgeon?.user?.name,
            anaesthetist: o.surgerySchedule.anaesthetist?.user?.name,
            otNurse: o.surgerySchedule.otNurse?.name,
            status: o.surgerySchedule.status,
            session: o.surgerySchedule.surgerySession ? {
              startTime: o.surgerySchedule.surgerySession.startTime,
              endTime: o.surgerySchedule.surgerySession.endTime,
              status: o.surgerySchedule.surgerySession.status,
              postSurgeryNote: pn ? {
                surgeryOutcome: pn.surgeryOutcome,
                procedureSummary: pn.procedureSummary,
                complications: pn.complications,
                bloodLoss: pn.bloodLoss,
                specialInstructions: pn.specialInstructions,
                preOperativeDiagnosis: pn.preOperativeDiagnosis,
                postOperativeDiagnosis: pn.postOperativeDiagnosis,
              } : null,
              recoveryRecord: rc ? {
                status: rc.status,
                assignedNurse: rc.assignedNurse?.name,
                painScore: rc.painScore,
                consciousnessLevel: rc.consciousnessLevel,
                timeline: rc.timeline?.length || 0,
              } : null,
            } : null,
          } : null,
          statusHistory: o.statusHistory.map((h) => ({
            status: h.status, createdAt: h.createdAt,
          })),
          medicines: o.surgerySchedule?.surgerySession?.id
            ? (medicineBySession[o.surgerySchedule.surgerySession.id] || []).map((m) => ({
                id: m.id, issueNumber: m.issueNumber, status: m.status,
                createdAt: m.createdAt, items: m.items,
              }))
            : [],
        };
      })() : null,
      stats: {
        total: totalCount,
        scheduled: scheduledCount,
        completed: completedCount,
        recovery: recoveryCount,
      },
    });
  } catch (err) {
    console.error('Patient OT surgery error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getOtSurgeryById = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { id } = req.params;

    const o = await prisma.otRequest.findFirst({
      where: { id, patientId: pid },
      include: {
        patient: { select: { uhid: true, name: true, mobile: true, age: true, gender: true, bloodGroup: true, address: true, weightKg: true } },
        doctor: { select: { specialization: true, qualification: true, user: { select: { name: true, phone: true } } } },
        nurse: { select: { name: true, phone: true, email: true } },
        admission: { select: { ipdNumber: true, department: true, status: true, admissionDate: true, ward: { select: { name: true, type: true } }, bed: { select: { code: true } } } },
        preOperativeAssessment: {
          include: {
            assessedBy: { select: { name: true } },
          },
        },
        bill: { select: { billNumber: true, totalAmount: true, paidAmount: true, status: true } },
        surgerySchedule: {
          include: {
            otRoom: { select: { roomNumber: true, roomName: true, floor: true } },
            surgeon: { select: { specialization: true, qualification: true, user: { select: { name: true, phone: true } } } },
            assistantSurgeon: { select: { specialization: true, user: { select: { name: true } } } },
            anaesthetist: { select: { specialization: true, user: { select: { name: true } } } },
            otNurse: { select: { name: true, phone: true } },
            surgerySession: {
              include: {
                postSurgeryNote: true,
                recoveryRecord: {
                  include: {
                    assignedNurse: { select: { name: true, phone: true } },
                    timeline: { orderBy: { createdAt: 'asc' } },
                    assessments: { orderBy: { createdAt: 'desc' }, take: 10 },
                    transfers: { orderBy: { createdAt: 'desc' } },
                  },
                },
              },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' }, include: { changedByUser: { select: { name: true, role: true } } } },
      },
    });

    if (!o) return res.status(404).json({ message: 'OT record not found' });

    const pn = o.surgerySchedule?.surgerySession?.postSurgeryNote;
    const rc = o.surgerySchedule?.surgerySession?.recoveryRecord;
    const sessionId = o.surgerySchedule?.surgerySession?.id;

    const sessionMedicines = sessionId
      ? await prisma.otMedicineIssue.findMany({
          where: { surgerySessionId: sessionId },
          include: { items: true, movements: { orderBy: { movementAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return res.json({
      otRequest: {
        id: o.id, requestNumber: o.requestNumber,
        patient: {
          name: o.patient?.name, uhid: o.patient?.uhid,
          mobile: o.patient?.mobile, age: o.patient?.age,
          gender: o.patient?.gender, bloodGroup: o.patient?.bloodGroup,
          address: o.patient?.address, weight: o.patient?.weightKg,
        },
        diagnosis: o.diagnosis, surgeryRecommendation: o.surgeryRecommendation,
        priority: o.priority, status: o.status,
        notes: o.notes,
        expectedSurgeryDate: o.expectedSurgeryDate,
        createdAt: o.createdAt, updatedAt: o.updatedAt,
        doctor: { name: o.doctor?.user?.name, specialization: o.doctor?.specialization, qualification: o.doctor?.qualification, phone: o.doctor?.user?.phone },
        nurse: { name: o.nurse?.name, phone: o.nurse?.phone },
        admission: o.admission ? {
          ipdNumber: o.admission.ipdNumber, department: o.admission.department,
          status: o.admission.status, admissionDate: o.admission.admissionDate,
          ward: o.admission.ward?.name, wardType: o.admission.ward?.type,
          bed: o.admission.bed?.code,
        } : null,
        bill: o.bill ? {
          billNumber: o.bill.billNumber, totalAmount: o.bill.totalAmount,
          paidAmount: o.bill.paidAmount, status: o.bill.status,
        } : null,
        preOpAssessment: o.preOperativeAssessment ? {
          id: o.preOperativeAssessment.id,
          status: o.preOperativeAssessment.status,
          assessmentDate: o.preOperativeAssessment.assessmentDate,
          bpSystolic: o.preOperativeAssessment.bpSystolic,
          bpDiastolic: o.preOperativeAssessment.bpDiastolic,
          pulse: o.preOperativeAssessment.pulse,
          temperature: o.preOperativeAssessment.temperature,
          spo2: o.preOperativeAssessment.spo2,
          respiratoryRate: o.preOperativeAssessment.respiratoryRate,
          heightCm: o.preOperativeAssessment.heightCm,
          weightKg: o.preOperativeAssessment.weightKg,
          bmi: o.preOperativeAssessment.bmi,
          knownAllergies: o.preOperativeAssessment.knownAllergies,
          currentMedications: o.preOperativeAssessment.currentMedications,
          previousSurgeries: o.preOperativeAssessment.previousSurgeries,
          nurseNotes: o.preOperativeAssessment.nurseNotes,
          assessedBy: o.preOperativeAssessment.assessedBy?.name,
        } : null,
        schedule: o.surgerySchedule ? {
          surgeryDate: o.surgerySchedule.surgeryDate,
          startTime: o.surgerySchedule.startTime,
          estimatedDuration: o.surgerySchedule.estimatedDuration,
          remarks: o.surgerySchedule.remarks,
          status: o.surgerySchedule.status,
          room: {
            name: o.surgerySchedule.otRoom?.roomName,
            number: o.surgerySchedule.otRoom?.roomNumber,
            floor: o.surgerySchedule.otRoom?.floor,
          },
          surgeon: {
            name: o.surgerySchedule.surgeon?.user?.name,
            specialization: o.surgerySchedule.surgeon?.specialization,
            qualification: o.surgerySchedule.surgeon?.qualification,
            phone: o.surgerySchedule.surgeon?.user?.phone,
          },
          assistantSurgeon: {
            name: o.surgerySchedule.assistantSurgeon?.user?.name,
            specialization: o.surgerySchedule.assistantSurgeon?.specialization,
          },
          anaesthetist: {
            name: o.surgerySchedule.anaesthetist?.user?.name,
            specialization: o.surgerySchedule.anaesthetist?.specialization,
          },
          otNurse: {
            name: o.surgerySchedule.otNurse?.name,
            phone: o.surgerySchedule.otNurse?.phone,
          },
          session: o.surgerySchedule.surgerySession ? {
            startTime: o.surgerySchedule.surgerySession.startTime,
            endTime: o.surgerySchedule.surgerySession.endTime,
            status: o.surgerySchedule.surgerySession.status,
            postSurgeryNote: pn ? {
              id: pn.id, surgeryOutcome: pn.surgeryOutcome,
              procedureSummary: pn.procedureSummary,
              operationFindings: pn.operationFindings,
              surgeonNotes: pn.surgeonNotes,
              complications: pn.complications, bloodLoss: pn.bloodLoss,
              specialInstructions: pn.specialInstructions,
              followUpInstructions: pn.followUpInstructions,
              preOperativeDiagnosis: pn.preOperativeDiagnosis,
              postOperativeDiagnosis: pn.postOperativeDiagnosis,
              anaesthesiaType: pn.anaesthesiaType,
              implantsUsed: pn.implantsUsed,
              specimenCollected: pn.specimenCollected,
              dischargeRecommendation: pn.dischargeRecommendation,
              medicines: pn.medicines,
              createdAt: pn.createdAt, updatedAt: pn.updatedAt,
            } : null,
            recoveryRecord: rc ? {
              id: rc.id, status: rc.status,
              admittedAt: rc.admittedAt, dischargedAt: rc.dischargedAt,
              transferredTo: rc.transferredTo, transferredAt: rc.transferredAt,
              assignedNurse: { name: rc.assignedNurse?.name, phone: rc.assignedNurse?.phone },
              painScore: rc.painScore, consciousnessLevel: rc.consciousnessLevel,
              surgicalSiteAssessment: rc.surgicalSiteAssessment,
              recoveryNotes: rc.recoveryNotes,
              bpSystolic: rc.bpSystolic, bpDiastolic: rc.bpDiastolic,
              pulse: rc.pulse, temperature: rc.temperature,
              spo2: rc.spo2, respiratoryRate: rc.respiratoryRate,
              timeline: rc.timeline?.map((t) => ({
                id: t.id, eventType: t.eventType,
                eventDescription: t.eventDescription, createdAt: t.createdAt,
              })) || [],
              assessments: rc.assessments?.map((a) => ({
                id: a.id, bpSystolic: a.bpSystolic, bpDiastolic: a.bpDiastolic,
                pulse: a.pulse, temperature: a.temperature, spo2: a.spo2,
                painScore: a.painScore, consciousnessLevel: a.consciousnessLevel,
                surgicalSiteAssessment: a.surgicalSiteAssessment,
                recoveryNotes: a.recoveryNotes, createdAt: a.createdAt,
              })) || [],
              transfers: rc.transfers?.map((t) => ({
                id: t.id, transferType: t.transferType,
                fromLocation: t.fromLocation, toLocation: t.toLocation,
                reason: t.reason, createdAt: t.createdAt,
              })) || [],
            } : null,
          } : null,
        } : null,
        statusHistory: o.statusHistory.map((h) => ({
          id: h.id, status: h.status, createdAt: h.createdAt,
          changedBy: h.changedByUser?.name, changedByRole: h.changedByUser?.role,
        })),
        medicines: sessionMedicines.map((m) => ({
          id: m.id, issueNumber: m.issueNumber, status: m.status,
          createdAt: m.createdAt, updatedAt: m.updatedAt,
          requestedByName: m.requestedByName, requestedAt: m.requestedAt,
          issuedByName: m.issuedByName, issuedAt: m.issuedAt,
          receivedByOtName: m.receivedByOtName,
          returnSubmittedAt: m.returnSubmittedAt, returnConfirmedAt: m.returnConfirmedAt,
          remarks: m.remarks, items: m.items, movements: m.movements,
        })),
      },
    });
  } catch (err) {
    console.error('Patient OT surgery detail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getRecovery = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const otRequests = await prisma.otRequest.findMany({
      where: { patientId: pid },
      select: {
        id: true, requestNumber: true,
        surgerySchedule: {
          select: {
            surgerySession: {
              select: {
                recoveryRecord: {
                  include: {
                    assignedNurse: { select: { name: true } },
                    timeline: { orderBy: { createdAt: 'asc' } },
                    assessments: { orderBy: { createdAt: 'desc' }, take: 5 },
                    transfers: { orderBy: { createdAt: 'desc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const records = otRequests
      .map((o) => o.surgerySchedule?.surgerySession?.recoveryRecord)
      .filter(Boolean);

    return res.json({
      recoveryRecords: records.map((r) => ({
        id: r.id,
        status: r.status,
        admittedAt: r.admittedAt,
        dischargedAt: r.dischargedAt,
        transferredTo: r.transferredTo,
        transferredAt: r.transferredAt,
        assignedNurse: r.assignedNurse?.name,
        painScore: r.painScore,
        consciousnessLevel: r.consciousnessLevel,
        surgicalSiteAssessment: r.surgicalSiteAssessment,
        recoveryNotes: r.recoveryNotes,
        postAnaesthesiaMonitoring: r.postAnaesthesiaMonitoring,
        bpSystolic: r.bpSystolic, bpDiastolic: r.bpDiastolic,
        pulse: r.pulse, temperature: r.temperature, spo2: r.spo2, respiratoryRate: r.respiratoryRate,
        timeline: r.timeline,
        assessments: r.assessments,
        transfers: r.transfers,
      })),
    });
  } catch (err) {
    console.error('Patient recovery error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getVitals = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const admissions = await prisma.admission.findMany({
      where: { patientId: pid },
      select: { id: true, ipdNumber: true },
    });
    const admissionIds = admissions.map((a) => a.id);

    const vitals = await prisma.vitals.findMany({
      where: { admissionId: { in: admissionIds } },
      orderBy: { createdAt: 'desc' },
    });

    const preOpAssessments = await prisma.preOperativeAssessment.findMany({
      where: { otRequest: { patientId: pid } },
      orderBy: { assessmentDate: 'desc' },
    });

    const recoveryAssessments = await prisma.recoveryAssessment.findMany({
      where: { recoveryRecord: { surgerySession: { surgerySchedule: { otRequest: { patientId: pid } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      vitals: vitals.map((v) => ({
        id: v.id, admissionId: v.admissionId,
        bp: v.bp, temperature: v.temp, pulse: v.pulse, spo2: v.spo2,
        oxygenTherapy: v.oxygenTherapy, recordedAt: v.createdAt,
      })),
      preOperative: preOpAssessments.map((a) => ({
        id: a.id, bpSystolic: a.bpSystolic, bpDiastolic: a.bpDiastolic,
        pulse: a.pulse, temperature: a.temperature, spo2: a.spo2,
        respiratoryRate: a.respiratoryRate, date: a.assessmentDate,
      })),
      recoveryAssessments: recoveryAssessments.map((a) => ({
        id: a.id, bpSystolic: a.bpSystolic, bpDiastolic: a.bpDiastolic,
        pulse: a.pulse, temperature: a.temperature, spo2: a.spo2,
        respiratoryRate: a.respiratoryRate, painScore: a.painScore,
        consciousnessLevel: a.consciousnessLevel, date: a.createdAt,
      })),
    });
  } catch (err) {
    console.error('Patient vitals error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getBills = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const uhid = req.user.uhid;

    let resolvedPid = pid;
    if (uhid) {
      const patient = await prisma.patient.findUnique({
        where: { uhid },
        select: { id: true },
      });
      if (patient) resolvedPid = patient.id;
    }

    const [storedBills, pharmacyBills, visits, appointments, admissions] = await Promise.all([
      prisma.bill.findMany({
        where: { patientId: resolvedPid },
        orderBy: { createdAt: 'desc' },
        include: {
          lineItems: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.pharmacyBill.findMany({
        where: { patientId: resolvedPid },
        orderBy: { createdAt: 'desc' },
        include: { items: true, payments: true },
      }),
      prisma.receptionVisit.findMany({
        where: { patientId: resolvedPid, registrationFee: { gt: 0 } },
        orderBy: { visitDate: 'desc' },
        select: {
          id: true,
          visitType: true,
          visitDate: true,
          createdAt: true,
          registrationFee: true,
          paymentStatus: true,
          paymentMode: true,
          department: true,
        },
      }),
      prisma.appointment.findMany({
        where: { patientId: resolvedPid, fee: { gt: 0 } },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          opdNumber: true,
          token: true,
          date: true,
          createdAt: true,
          fee: true,
          paymentStatus: true,
          paymentMode: true,
          doctor: { select: { user: { select: { name: true } } } },
        },
      }),
      prisma.admission.findMany({
        where: { patientId: resolvedPid },
        orderBy: { admissionDate: 'desc' },
        select: {
          id: true,
          ipdNumber: true,
          admissionDate: true,
          dischargeDate: true,
          billing: true,
          bills: { where: { NOT: { status: 'CANCELLED' } }, select: { id: true } },
        },
      }),
    ]);

    const billedAppointmentIds = new Set(
      storedBills.map((b) => b.appointmentId).filter(Boolean),
    );
    const billedAdmissionIds = new Set(
      storedBills.map((b) => b.admissionId).filter(Boolean),
    );

    const hospitalBills = storedBills.map(mapStoredBill);

    for (const visit of visits) {
      if (visitCoveredByStoredBill(visit, storedBills)) continue;
      const row = buildVisitBill(visit);
      if (row) hospitalBills.push(row);
    }

    for (const appt of appointments) {
      if (billedAppointmentIds.has(appt.id)) continue;
      const row = buildAppointmentBill(appt);
      if (row) hospitalBills.push(row);
    }

    for (const admission of admissions) {
      if (admission.bills?.length > 0 || billedAdmissionIds.has(admission.id)) continue;
      const row = buildAdmissionBill(admission);
      if (row) hospitalBills.push(row);
    }

    hospitalBills.sort(
      (a, b) => new Date(b.billDate || b.createdAt).getTime() - new Date(a.billDate || a.createdAt).getTime(),
    );

    return res.json({
      bills: hospitalBills,
      pharmacyBills: pharmacyBills.map((b) => ({
        id: b.id, billNumber: b.billNumber, billingType: b.billingType,
        status: b.status, dispenseStatus: b.dispenseStatus,
        subTotal: b.subTotal, discount: b.discount,
        gstAmount: b.gstAmount, grandTotal: b.grandTotal,
        paidAmount: b.paidAmount, pendingAmount: b.pendingAmount,
        paymentMode: b.paymentMode, createdAt: b.createdAt,
        items: b.items, payments: b.payments,
      })),
    });
  } catch (err) {
    console.error('Patient bills error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const [consultations, labOrders, otRequests, admissions] = await Promise.all([
      prisma.consultation.findMany({
        where: { patientId: pid, prescription: { not: null } },
        orderBy: { createdAt: 'desc' },
        include: { doctor: { select: { user: { select: { name: true } } } } },
      }),
      prisma.labOrder.findMany({
        where: { patientId: pid, reportStatus: { not: 'PENDING' } },
        orderBy: { createdAt: 'desc' },
        include: { results: { select: { attachmentUrl: true, testName: true, createdAt: true } } },
      }),
      prisma.otRequest.findMany({
        where: { patientId: pid },
        orderBy: { createdAt: 'desc' },
        include: { surgerySchedule: { include: { surgerySession: { include: { postSurgeryNote: true } } } } },
      }),
      prisma.admission.findMany({
        where: { patientId: pid, dischargeSummaryData: { not: null } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const documents = [];
    consultations.forEach((c) => {
      documents.push({ id: `presc-${c.id}`, type: 'PRESCRIPTION', title: 'Prescription', date: c.createdAt, doctor: c.doctor?.user?.name, description: c.diagnosis });
    });
    labOrders.forEach((o) => {
      o.results.forEach((r) => {
        if (r.attachmentUrl) documents.push({ id: `lab-${r.id}`, type: 'LAB_REPORT', title: `Lab Report: ${r.testName}`, date: r.createdAt, attachmentUrl: r.attachmentUrl });
      });
    });
    otRequests.forEach((o) => {
      const sn = o.surgerySchedule?.surgerySession?.postSurgeryNote;
      if (sn) documents.push({ id: `surg-${sn.id}`, type: 'SURGERY_REPORT', title: 'Surgery Report', date: sn.createdAt, description: sn.procedureSummary, data: sn });
    });
    admissions.forEach((a) => {
      if (a.dischargeSummaryData) documents.push({ id: `dsch-${a.id}`, type: 'DISCHARGE_SUMMARY', title: 'Discharge Summary', date: a.dischargeDate || a.createdAt, data: a.dischargeSummaryData });
    });

    documents.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json({ documents });
  } catch (err) {
    console.error('Patient documents error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const patient = await prisma.patient.findUnique({ where: { id: pid }, select: { id: true, createdAt: true } });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const notifications = [];
    const now = new Date();

    // Upcoming appointments
    const upcomingAppts = await prisma.appointment.findMany({
      where: { patientId: pid, date: { gte: now } },
      orderBy: { date: 'asc' }, take: 5,
      include: { doctor: { select: { user: { select: { name: true } } } } },
    });
    upcomingAppts.forEach((a) => {
      notifications.push({
        type: 'APPOINTMENT', title: 'Upcoming Appointment',
        message: `You have an appointment with Dr. ${a.doctor?.user?.name || 'doctor'} on ${a.date.toISOString().slice(0, 10)} at ${a.time || '—'}`,
        date: a.date, read: false,
      });
    });

    // Recent lab reports
    const labOrders = await prisma.labOrder.findMany({
      where: { patientId: pid, reportStatus: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' }, take: 5,
    });
    labOrders.forEach((o) => {
      notifications.push({
        type: 'LAB_REPORT', title: 'Lab Report Ready',
        message: `Your lab report (${o.orderNumber}) is ready.`,
        date: o.updatedAt, read: false,
      });
    });

    // Recent bills
    const bills = await prisma.bill.findMany({
      where: { patientId: pid, status: { in: ['PENDING', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' }, take: 5,
    });
    bills.forEach((b) => {
      notifications.push({
        type: 'BILL', title: 'Bill Generated',
        message: `Bill ${b.billNumber} for ₹${b.totalAmount} is ${b.status === 'PARTIAL' ? 'partially paid' : 'pending'}.`,
        date: b.createdAt, read: false,
      });
    });

    // OT updates
    const otRequests = await prisma.otRequest.findMany({
      where: { patientId: pid },
      orderBy: { updatedAt: 'desc' }, take: 5,
    });
    otRequests.forEach((o) => {
      if (o.status === 'SCHEDULED') {
        notifications.push({
          type: 'OT_SCHEDULED', title: 'Surgery Scheduled',
          message: `Your surgery (${o.requestNumber}) has been scheduled.`,
          date: o.updatedAt, read: false,
        });
      }
    });

    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

    const unreadCount = notifications.filter((n) => !n.read).length;
    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Patient notifications error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getNotificationCounts = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const patient = await withDbRetry(() =>
      prisma.patient.findUnique({ where: { id: pid }, select: { id: true } })
    );
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const now = new Date();

    const [upcomingAppts, labOrders, bills, otRequests] = await withDbRetry(() =>
      Promise.all([
        prisma.appointment.count({ where: { patientId: pid, date: { gte: now } } }),
        prisma.labOrder.count({ where: { patientId: pid, reportStatus: 'COMPLETED' } }),
        prisma.bill.count({ where: { patientId: pid, status: { in: ['PENDING', 'PARTIAL'] } } }),
        prisma.otRequest.count({ where: { patientId: pid, status: 'SCHEDULED' } }),
      ])
    );

    return res.json({
      counts: {
        APPOINTMENT: upcomingAppts,
        LAB_REPORT: labOrders,
        BILL: bills,
        OT_SCHEDULED: otRequests,
      },
      total: upcomingAppts + labOrders + bills + otRequests,
    });
  } catch (err) {
    console.error('Patient notification counts error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const patient = await prisma.patient.findUnique({
      where: { id: pid },
      select: { ...patientSel, patientAuth: { select: { isActive: true, createdAt: true } } },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const { patientAuth, ...rest } = patient;
    return res.json({
      patient: { ...rest, gender: genderLabel(rest.gender) },
      portalActive: patientAuth?.isActive || false,
      portalSince: patientAuth?.createdAt || null,
    });
  } catch (err) {
    console.error('Patient profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const allowed = ['name', 'mobile', 'address', 'bloodGroup', 'allergies', 'heightCm', 'weightKg', 'emergencyName', 'emergencyPhone', 'emergencyRelation'];
    const data = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) data[k] = req.body[k];
    }

    const patient = await prisma.patient.update({
      where: { id: pid },
      data,
      select: patientSel,
    });
    return res.json({ message: 'Profile updated', patient: { ...patient, gender: genderLabel(patient.gender) } });
  } catch (err) {
    console.error('Patient update profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const pid = req.user.patientId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const auth = await prisma.patientAuth.findUnique({ where: { patientId: pid } });
    if (!auth) return res.status(400).json({ message: 'Portal access not enabled' });

    const valid = await bcrypt.compare(currentPassword, auth.password);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.patientAuth.update({ where: { patientId: pid }, data: { password: hashed } });

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Patient change password error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
