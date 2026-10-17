const { prisma, isDbDisconnectError, reconnectPrisma } = require('../../config/prisma');
const { applyNurseAssignment, releaseNurseAssignment } = require('../../lib/allocationWorkflow');
const { formatShiftLabel, todayStart: shiftTodayStart, computeShiftStatus } = require('../../lib/shiftHelpers');

const ROLE_LABELS = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'Lab Technician',
  HR_MANAGER: 'HR Manager',
  OT_TECHNICIAN: 'OT Technician',
};

const ACTIVE_ADMISSION_STATUSES = ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'];
const ACTIVE_SURGERY_STATUSES = ['SCHEDULED', 'IN_PROGRESS'];

function authUserId(req) {
  return req.user?.userId || req.user?.id;
}

/** Calendar date for NurseDuty (@db.Date) — avoids IST/UTC off-by-one */
function toDutyDate(d = new Date()) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
}

function wardNameMatches(dutyWardName, queryWardName) {
  const a = String(dutyWardName || '').toLowerCase().trim();
  const b = String(queryWardName || '').toLowerCase().trim();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function computeAvailability(activeAdmissions, activeOtCases, isActive) {
  if (!isActive) return 'Off Shift';
  if (activeOtCases > 0) return 'Busy';
  if (activeAdmissions > 0) return 'Assigned';
  return 'Available';
}

function getCurrentAssignment(admissions, otCases) {
  if (admissions.length > 0) {
    const a = admissions[0];
    return {
      type: 'Patient',
      label: a.patient?.uhid ? `Patient: ${a.patient.uhid}` : 'Patient Admission',
      detail: a.ward?.name ? `Ward: ${a.ward.name}` : null,
      subDetail: a.bed?.code ? `Bed: ${a.bed.code}` : null,
      admissionId: a.id,
      ipdNumber: a.ipdNumber,
    };
  }
  if (otCases.length > 0) {
    const o = otCases[0];
    return {
      type: 'OT Case',
      label: o.otRequest?.requestNumber ? `OT Case: ${o.otRequest.requestNumber}` : 'OT Case',
      detail: o.otRoom?.roomName ? `OT Room: ${o.otRoom.roomName}` : null,
      subDetail: null,
      surgeryScheduleId: o.id,
    };
  }
  return null;
}

async function listEmployees(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const { search, role, status, availability, department } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      const roleMap = {
        doctor: 'DOCTOR',
        nurse: 'NURSE',
        receptionist: 'RECEPTIONIST',
        pharmacist: 'PHARMACIST',
        lab_technician: 'LAB_TECHNICIAN',
        hr_manager: 'HR_MANAGER',
        ot_technician: 'OT_TECHNICIAN',
      };
      const mapped = roleMap[role.toLowerCase()];
      if (mapped) where.role = mapped;
    }

    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    if (department) {
      where.department = { contains: department, mode: 'insensitive' };
    }

    // Get summary counts (unfiltered)
    const [totalCount, roleCounts] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    const summary = {
      total: totalCount,
      doctors: 0,
      nurses: 0,
      receptionists: 0,
      otTechnicians: 0,
      labTechnicians: 0,
      pharmacists: 0,
      currentlyAssigned: 0,
      available: 0,
    };

    for (const r of roleCounts) {
      const roleKey = r.role.toLowerCase();
      if (roleKey === 'doctor') summary.doctors = r._count.id;
      else if (roleKey === 'nurse') summary.nurses = r._count.id;
      else if (roleKey === 'receptionist') summary.receptionists = r._count.id;
      else if (roleKey === 'ot_technician') summary.otTechnicians = r._count.id;
      else if (roleKey === 'lab_technician') summary.labTechnicians = r._count.id;
      else if (roleKey === 'pharmacist') summary.pharmacists = r._count.id;
    }

    // Query ALL matching employees first (to filter by computed availability correctly)
    const allMatchingEmployees = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        phone: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (allMatchingEmployees.length === 0) {
      return res.json({
        employees: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
        summary,
      });
    }

    const userIds = allMatchingEmployees.map((u) => u.id);

    // Get active admissions for these users (nurse assignments)
    const admissions = await prisma.admission.findMany({
      where: {
        nurseId: { in: userIds },
        status: { in: ACTIVE_ADMISSION_STATUSES },
      },
      include: {
        patient: { select: { uhid: true, name: true } },
        ward: { select: { name: true } },
        bed: { select: { code: true } },
      },
    });

    // Group admissions by nurseId
    const admissionsByNurse = {};
    for (const a of admissions) {
      if (!admissionsByNurse[a.nurseId]) admissionsByNurse[a.nurseId] = [];
      admissionsByNurse[a.nurseId].push(a);
    }

    // Get active OT cases where user is otNurse
    const otCases = await prisma.surgerySchedule.findMany({
      where: {
        otNurseId: { in: userIds },
        status: { in: ACTIVE_SURGERY_STATUSES },
      },
      include: {
        otRoom: { select: { roomName: true } },
        otRequest: { select: { requestNumber: true } },
      },
    });

    const otCasesByNurse = {};
    for (const o of otCases) {
      if (!otCasesByNurse[o.otNurseId]) otCasesByNurse[o.otNurseId] = [];
      otCasesByNurse[o.otNurseId].push(o);
    }

    // For doctors, also look up OT cases via Doctor profile
    const doctorUsers = allMatchingEmployees.filter((u) => u.role === 'DOCTOR');
    let doctorOtCounts = {};
    if (doctorUsers.length > 0) {
      const doctors = await prisma.doctor.findMany({
        where: { userId: { in: doctorUsers.map((u) => u.id) } },
        select: { id: true, userId: true },
      });
      const doctorIds = doctors.map((d) => d.id);
      const doctorUserIdMap = {};
      for (const d of doctors) doctorUserIdMap[d.id] = d.userId;

      if (doctorIds.length > 0) {
        const doctorOtCases = await prisma.surgerySchedule.findMany({
          where: {
            OR: [
              { surgeonId: { in: doctorIds } },
              { assistantSurgeonId: { in: doctorIds } },
              { anaesthetistId: { in: doctorIds } },
            ],
            status: { in: ACTIVE_SURGERY_STATUSES },
          },
          select: { surgeonId: true, assistantSurgeonId: true, anaesthetistId: true },
        });

        for (const o of doctorOtCases) {
          const roles = [o.surgeonId, o.assistantSurgeonId, o.anaesthetistId].filter(Boolean);
          for (const docId of roles) {
            const uid = doctorUserIdMap[docId];
            if (uid) {
              doctorOtCounts[uid] = (doctorOtCounts[uid] || 0) + 1;
            }
          }
        }
      }
    }

    // Today's shift assignments
    const todayShiftStart = shiftTodayStart();
    const todayShiftAssignments = await prisma.shiftAssignment.findMany({
      where: { assignedDate: { gte: todayShiftStart } },
      include: { shift: { select: { id: true, name: true, startTime: true, endTime: true, isActive: true } } },
    });
    const shiftByEmployee = {};
    for (const a of todayShiftAssignments) {
      shiftByEmployee[a.employeeId] = a.shift;
    }

    // Enrich all matching employees
    let enriched = allMatchingEmployees.map((u) => {
      const userAdmissions = admissionsByNurse[u.id] || [];
      const userOtCases = otCasesByNurse[u.id] || [];
      const doctorOtCount = doctorOtCounts[u.id] || 0;
      const assignedPatientsCount = userAdmissions.length;
      const assignedOtCasesCount = userOtCases.length + doctorOtCount;
      const shift = shiftByEmployee[u.id];

      return {
        ...u,
        role: ROLE_LABELS[u.role] || u.role,
        assignedPatientsCount,
        assignedOtCasesCount,
        currentAssignment: getCurrentAssignment(userAdmissions, userOtCases),
        availabilityStatus: computeAvailability(assignedPatientsCount, assignedOtCasesCount, u.isActive),
        currentShift: shift ? formatShiftLabel({ ...shift, status: computeShiftStatus(shift) }) : null,
      };
    });

    // Compute summary counts for currently assigned and available based on ALL matching employees
    for (const e of enriched) {
      if (e.availabilityStatus === 'Assigned' || e.availabilityStatus === 'Busy') {
        summary.currentlyAssigned++;
      }
      if (e.availabilityStatus === 'Available') {
        summary.available++;
      }
    }

    // Apply computed availability filter (if specified)
    if (availability) {
      const avLower = availability.toLowerCase();
      enriched = enriched.filter((e) => {
        const statusLower = String(e.availabilityStatus || '').toLowerCase();
        return statusLower === avLower;
      });
    }

    // Calculate total and paginate in-memory
    const totalFiltered = enriched.length;
    const paginatedEmployees = enriched.slice(skip, skip + pageSize);

    return res.json({
      employees: paginatedEmployees,
      pagination: {
        page,
        pageSize,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / pageSize),
      },
      summary,
    });
  } catch (err) {
    console.error('listEmployees error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getEmployeeDetail(req, res) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        username: true,
        phone: true,
        address: true,
        role: true,
        department: true,
        profilePhoto: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) return res.status(404).json({ message: 'Employee not found' });

    // Get active admissions
    const activeAdmissions = await prisma.admission.findMany({
      where: { nurseId: id, status: { in: ACTIVE_ADMISSION_STATUSES } },
      include: {
        patient: { select: { uhid: true, name: true, age: true, gender: true } },
        ward: { select: { name: true } },
        bed: { select: { code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get OT cases where user is otNurse
    const otCases = await prisma.surgerySchedule.findMany({
      where: { otNurseId: id, status: { in: ACTIVE_SURGERY_STATUSES } },
      include: {
        otRoom: { select: { roomName: true } },
        otRequest: { select: { requestNumber: true, surgeryRecommendation: true } },
        surgeon: { select: { user: { select: { name: true } } } },
      },
      orderBy: { surgeryDate: 'desc' },
    });

    // For doctors, get OT cases via Doctor profile
    let doctorOtCases = [];
    let doctorProfile = null;
    if (user.role === 'DOCTOR') {
      doctorProfile = await prisma.doctor.findUnique({
        where: { userId: id },
        select: { id: true, specialization: true, qualification: true, experienceYears: true },
      });

      if (doctorProfile) {
        doctorOtCases = await prisma.surgerySchedule.findMany({
          where: {
            OR: [
              { surgeonId: doctorProfile.id },
              { assistantSurgeonId: doctorProfile.id },
              { anaesthetistId: doctorProfile.id },
            ],
            status: { in: ACTIVE_SURGERY_STATUSES },
          },
          include: {
            otRoom: { select: { roomName: true } },
            otRequest: { select: { requestNumber: true, surgeryRecommendation: true } },
          },
          orderBy: { surgeryDate: 'desc' },
        });
      }
    }

    const allOtCases = [...otCases, ...doctorOtCases];
    const assignedPatientsCount = activeAdmissions.length;
    const assignedOtCasesCount = allOtCases.length;

    const workloadStatus =
      assignedOtCasesCount >= 3 ? 'High' :
      assignedOtCasesCount >= 1 ? 'Medium' :
      'Low';

    return res.json({
      employee: {
        ...user,
        role: ROLE_LABELS[user.role] || user.role,
        doctorProfile: doctorProfile || null,
        currentAssignment: getCurrentAssignment(activeAdmissions, allOtCases),
        availabilityStatus: computeAvailability(assignedPatientsCount, assignedOtCasesCount, user.isActive),
        currentShift: null,
        workload: {
          assignedPatientsCount,
          assignedOtCasesCount,
          totalActiveAssignments: assignedPatientsCount + assignedOtCasesCount,
          workloadStatus,
        },
        activeAdmissions,
        activeOtCases: allOtCases,
      },
    });
  } catch (err) {
    console.error('getEmployeeDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function listEmployeeAllocations(req, res) {
  try {
    const { id } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!user) return res.status(404).json({ message: 'Employee not found' });

    // Get admission assignments (nurse role)
    const [admissionAllocations, admissionTotal] = await Promise.all([
      prisma.admission.findMany({
        where: { nurseId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          patient: { select: { uhid: true, name: true } },
          ward: { select: { name: true } },
          bed: { select: { code: true } },
        },
      }),
      prisma.admission.count({ where: { nurseId: id } }),
    ]);

    // Get OT schedule assignments
    const [otAllocations, otTotal] = await Promise.all([
      prisma.surgerySchedule.findMany({
        where: { otNurseId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          otRoom: { select: { roomName: true } },
          otRequest: {
            select: {
              requestNumber: true,
              surgeryRecommendation: true,
              nurse: { select: { name: true } },
            },
          },
        },
      }),
      prisma.surgerySchedule.count({ where: { otNurseId: id } }),
    ]);

    // For doctors, also get via Doctor profile
    let doctorOtAllocations = [];
    let doctorOtTotal = 0;
    if (user.role === 'DOCTOR') {
      const doctorProfile = await prisma.doctor.findUnique({
        where: { userId: id },
        select: { id: true },
      });
      if (doctorProfile) {
        const [docs, docTotal] = await Promise.all([
          prisma.surgerySchedule.findMany({
            where: {
              OR: [
                { surgeonId: doctorProfile.id },
                { assistantSurgeonId: doctorProfile.id },
                { anaesthetistId: doctorProfile.id },
              ],
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
            include: {
              otRoom: { select: { roomName: true } },
              otRequest: {
                select: {
                  requestNumber: true,
                  surgeryRecommendation: true,
                  nurse: { select: { name: true } },
                },
              },
            },
          }),
          prisma.surgerySchedule.count({
            where: {
              OR: [
                { surgeonId: doctorProfile.id },
                { assistantSurgeonId: doctorProfile.id },
                { anaesthetistId: doctorProfile.id },
              ],
            },
          }),
        ]);
        doctorOtAllocations = docs;
        doctorOtTotal = docTotal;
      }
    }

    // Combine and format
    const allocations = [];

    for (const a of admissionAllocations) {
      allocations.push({
        date: a.createdAt,
        patient: a.patient?.name || '—',
        uhid: a.patient?.uhid || '—',
        ward: a.ward?.name || '—',
        bed: a.bed?.code || '—',
        otCase: null,
        assignedBy: 'System',
        shift: null,
        status: a.status,
        type: 'IPD Admission',
      });
    }

    for (const o of otAllocations) {
      allocations.push({
        date: o.createdAt,
        patient: null,
        uhid: null,
        ward: null,
        bed: null,
        otCase: o.otRequest?.requestNumber || '—',
        surgery: o.otRequest?.surgeryRecommendation || '—',
        otRoom: o.otRoom?.roomName || '—',
        assignedBy: o.otRequest?.nurse?.name || 'System',
        shift: null,
        status: o.status,
        type: 'OT Surgery',
      });
    }

    for (const o of doctorOtAllocations) {
      allocations.push({
        date: o.createdAt,
        patient: null,
        uhid: null,
        ward: null,
        bed: null,
        otCase: o.otRequest?.requestNumber || '—',
        surgery: o.otRequest?.surgeryRecommendation || '—',
        otRoom: o.otRoom?.roomName || '—',
        assignedBy: o.otRequest?.nurse?.name || 'System',
        shift: null,
        status: o.status,
        type: 'OT Surgery (Doctor)',
      });
    }

    allocations.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = admissionTotal + otTotal + doctorOtTotal;

    return res.json({
      allocations,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error('listEmployeeAllocations error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateEmployeeStatus(req, res) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLogin: true },
    });

    return res.json({ user });
  } catch (err) {
    if (err && err.code === 'P2025') {
      return res.status(404).json({ message: 'Employee not found' });
    }
    console.error('updateEmployeeStatus error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

const STANDARD_DEPARTMENTS = [
  { name: 'Administration', description: 'Hospital administration and management' },
  { name: 'Reception', description: 'Front desk and patient registration' },
  { name: 'Doctor', description: 'Medical officers and specialists' },
  { name: 'Nurse', description: 'Nursing staff' },
  { name: 'OT', description: 'Operation Theatre' },
  { name: 'Laboratory', description: 'Diagnostic Laboratory Services' },
  { name: 'Pharmacy', description: 'Pharmacy and Medicine Dispensary' },
  { name: 'HR', description: 'Human Resources' },
];

async function ensureStandardDepartments() {
  for (const dept of STANDARD_DEPARTMENTS) {
    try {
      await prisma.department.upsert({
        where: { name: dept.name },
        update: { description: dept.description },
        create: dept,
      });
    } catch (err) {
      if (isDbDisconnectError(err)) {
        await reconnectPrisma();
        await prisma.department.upsert({
          where: { name: dept.name },
          update: { description: dept.description },
          create: dept,
        });
      } else {
        throw err;
      }
    }
  }
}

const ACTIVE_ADMISSION_STATUSES_DEPT = ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'];
const ACTIVE_SURGERY_STATUSES_DEPT = ['SCHEDULED', 'IN_PROGRESS'];

function deptAvailability(activeAdmissions, activeOtCases, isActive) {
  if (!isActive) return 'Off Shift';
  if (activeOtCases > 0) return 'Busy';
  if (activeAdmissions > 0) return 'Assigned';
  return 'Available';
}

async function listDepartments(req, res) {
  try {
    await ensureStandardDepartments();

    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { head: { select: { id: true, name: true, employeeId: true, role: true } } },
    });

    // Get all users grouped by department
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        employeeId: true,
      },
    });

    // Fetch all doctor profiles to map doctorIds to userIds
    const doctors = await prisma.doctor.findMany({
      select: { id: true, userId: true },
    });
    const doctorIdToUserId = {};
    for (const d of doctors) {
      doctorIdToUserId[d.id] = d.userId;
    }

    // Get admission counts per user (nurse or doctor)
    const admissions = await prisma.admission.findMany({
      where: { status: { in: ACTIVE_ADMISSION_STATUSES_DEPT } },
      select: { nurseId: true, doctorId: true },
    });
    const admissionCountMap = {};
    for (const a of admissions) {
      if (a.nurseId) {
        admissionCountMap[a.nurseId] = (admissionCountMap[a.nurseId] || 0) + 1;
      }
      if (a.doctorId) {
        const uId = doctorIdToUserId[a.doctorId];
        if (uId) {
          admissionCountMap[uId] = (admissionCountMap[uId] || 0) + 1;
        }
      }
    }

    // Get OT schedule counts per user (otNurse or surgeon/assistant/anaesthetist)
    const otSchedules = await prisma.surgerySchedule.findMany({
      where: { status: { in: ACTIVE_SURGERY_STATUSES_DEPT } },
      select: { otNurseId: true, surgeonId: true, assistantSurgeonId: true, anaesthetistId: true },
    });
    const otCountMap = {};
    for (const o of otSchedules) {
      if (o.otNurseId) {
        otCountMap[o.otNurseId] = (otCountMap[o.otNurseId] || 0) + 1;
      }
      const docIds = [o.surgeonId, o.assistantSurgeonId, o.anaesthetistId].filter(Boolean);
      for (const dId of docIds) {
        const uId = doctorIdToUserId[dId];
        if (uId) {
          otCountMap[uId] = (otCountMap[uId] || 0) + 1;
        }
      }
    }

    // Group users by department
    const usersByDept = {};
    for (const u of allUsers) {
      const dept = u.department || 'Unassigned';
      if (!usersByDept[dept]) usersByDept[dept] = [];
      usersByDept[dept].push(u);
    }

    const enriched = departments.map((d) => {
      const deptUsers = usersByDept[d.name] || [];
      const totalStaff = deptUsers.length;
      let availableStaff = 0;
      let assignedStaff = 0;

      for (const u of deptUsers) {
        const aCount = admissionCountMap[u.id] || 0;
        const oCount = otCountMap[u.id] || 0;
        const status = deptAvailability(aCount, oCount, u.isActive);
        if (status === 'Available') availableStaff++;
        if (status === 'Assigned' || status === 'Busy') assignedStaff++;
      }

      return {
        id: d.id,
        name: d.name,
        description: d.description,
        head: d.head,
        isActive: d.isActive,
        totalStaff,
        availableStaff,
        assignedStaff,
        createdAt: d.createdAt,
      };
    });

    // Add "Unassigned" row for users without a department
    const unassignedUsers = usersByDept['Unassigned'] || [];
    if (unassignedUsers.length > 0) {
      let unAvail = 0, unAssigned = 0;
      for (const u of unassignedUsers) {
        const aCount = admissionCountMap[u.id] || 0;
        const oCount = otCountMap[u.id] || 0;
        const status = deptAvailability(aCount, oCount, u.isActive);
        if (status === 'Available') unAvail++;
        if (status === 'Assigned' || status === 'Busy') unAssigned++;
      }
      enriched.unshift({
        id: null,
        name: 'Unassigned',
        description: 'Employees not yet assigned to a department',
        head: null,
        isActive: true,
        totalStaff: unassignedUsers.length,
        availableStaff: unAvail,
        assignedStaff: unAssigned,
        isUnassigned: true,
      });
    }

    // Summary
    const totalUsers = allUsers.length;
    const unassignedCount = (usersByDept['Unassigned'] || []).length;
    const assignedToDept = totalUsers - unassignedCount;

    return res.json({
      departments: enriched,
      summary: {
        totalDepartments: departments.length,
        totalEmployees: totalUsers,
        unassignedStaff: unassignedCount,
        assignedStaff: assignedToDept,
      },
    });
  } catch (err) {
    console.error('listDepartments error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getDepartmentDetail(req, res) {
  try {
    const { name } = req.params;
    await ensureStandardDepartments();

    const isUnassigned = String(name).toLowerCase() === 'unassigned';
    let department;
    let users;

    if (isUnassigned) {
      department = {
        id: null,
        name: 'Unassigned',
        description: 'Employees not yet assigned to a department',
        head: null,
        isActive: true,
      };
      users = await prisma.user.findMany({
        where: { OR: [{ department: null }, { department: '' }] },
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          phone: true,
          role: true,
          department: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });
    } else {
      department = await prisma.department.findUnique({
        where: { name },
        include: { head: { select: { id: true, name: true, employeeId: true, role: true, email: true, phone: true, department: true } } },
      });
      if (!department) return res.status(404).json({ message: 'Department not found' });

      users = await prisma.user.findMany({
        where: { department: name },
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          phone: true,
          role: true,
          department: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    // Get admission counts
    const userIds = users.map((u) => u.id);
    const admissions = await prisma.admission.findMany({
      where: { nurseId: { in: userIds }, status: { in: ACTIVE_ADMISSION_STATUSES_DEPT } },
      include: {
        patient: { select: { uhid: true, name: true } },
        ward: { select: { name: true } },
        bed: { select: { code: true } },
      },
    });
    const admissionsByUser = {};
    for (const a of admissions) {
      if (!admissionsByUser[a.nurseId]) admissionsByUser[a.nurseId] = [];
      admissionsByUser[a.nurseId].push(a);
    }

    // Get OT schedule counts
    const otSchedules = await prisma.surgerySchedule.findMany({
      where: { otNurseId: { in: userIds }, status: { in: ACTIVE_SURGERY_STATUSES_DEPT } },
      include: {
        otRoom: { select: { roomName: true } },
        otRequest: { select: { requestNumber: true, surgeryRecommendation: true } },
      },
    });
    const otByUser = {};
    for (const o of otSchedules) {
      if (!otByUser[o.otNurseId]) otByUser[o.otNurseId] = [];
      otByUser[o.otNurseId].push(o);
    }

    // Enrich staff list
    const staffList = users.map((u) => {
      const userAdmissions = admissionsByUser[u.id] || [];
      const userOtCases = otByUser[u.id] || [];
      const aCount = userAdmissions.length;
      const oCount = userOtCases.length;
      const currentAssignment = userAdmissions.length > 0
        ? { type: 'Patient', label: `Patient: ${userAdmissions[0].patient?.uhid || ''}`, detail: userAdmissions[0].ward?.name ? `Ward: ${userAdmissions[0].ward.name}` : null }
        : userOtCases.length > 0
        ? { type: 'OT Case', label: `OT: ${userOtCases[0].otRequest?.requestNumber || ''}`, detail: userOtCases[0].otRoom?.roomName ? `Room: ${userOtCases[0].otRoom.roomName}` : null }
        : null;

      return {
        ...u,
        assignedPatientsCount: aCount,
        assignedOtCasesCount: oCount,
        availabilityStatus: deptAvailability(aCount, oCount, u.isActive),
        currentAssignment,
        currentShift: null,
      };
    });

    // Role counts
    const roleCounts = { doctors: 0, nurses: 0, technicians: 0, other: 0 };
    for (const u of users) {
      const r = String(u.role).toLowerCase();
      if (r === 'doctor') roleCounts.doctors++;
      else if (r === 'nurse') roleCounts.nurses++;
      else if (r === 'lab_technician' || r === 'ot_technician') roleCounts.technicians++;
      else roleCounts.other++;
    }

    // Workload
    const totalActivePatients = admissions.length;
    const totalAssignedStaff = users.filter((u) => {
      const aCount = (admissionsByUser[u.id] || []).length;
      const oCount = (otByUser[u.id] || []).length;
      return aCount > 0 || oCount > 0;
    }).length;
    const activeOtCases = otSchedules.length;
    const workload = totalActivePatients + activeOtCases;

    return res.json({
      department: {
        ...department,
        head: department.head,
        staffList,
        roleCounts,
        workload: {
          totalActivePatients,
          totalAssignedStaff,
          activeOtCases,
          currentWorkload: workload <= 5 ? 'Low' : workload <= 15 ? 'Medium' : 'High',
        },
        totalStaff: users.length,
        availableStaff: staffList.filter((s) => s.availabilityStatus === 'Available').length,
        assignedStaff: staffList.filter((s) => s.availabilityStatus === 'Assigned' || s.availabilityStatus === 'Busy').length,
      },
    });
  } catch (err) {
    console.error('getDepartmentDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function assignDepartmentHead(req, res) {
  try {
    const { name } = req.params;
    const { userId } = req.body;

    const department = await prisma.department.findUnique({ where: { name } });
    if (!department) return res.status(404).json({ message: 'Department not found' });

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ message: 'Employee not found' });
    }

    const updated = await prisma.department.update({
      where: { name },
      data: { headId: userId || null },
      include: { head: { select: { id: true, name: true, employeeId: true, role: true } } },
    });

    return res.json({ department: updated });
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ message: 'This employee is already the head of another department' });
    }
    console.error('assignDepartmentHead error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateDepartment(req, res) {
  try {
    const { name } = req.params;
    const { description, isActive } = req.body;

    const data = {};
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;

    const department = await prisma.department.update({
      where: { name },
      data,
      include: { head: { select: { id: true, name: true, employeeId: true, role: true } } },
    });

    return res.json({ department });
  } catch (err) {
    if (err && err.code === 'P2025') {
      return res.status(404).json({ message: 'Department not found' });
    }
    console.error('updateDepartment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateEmployeeDepartment(req, res) {
  try {
    const { id } = req.params;
    const { department } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Employee not found' });

    const updated = await prisma.user.update({
      where: { id },
      data: { department },
      select: { id: true, name: true, department: true, role: true, employeeId: true },
    });

    return res.json({ employee: updated });
  } catch (err) {
    if (err && err.code === 'P2025') {
      return res.status(404).json({ message: 'Employee not found' });
    }
    console.error('updateEmployeeDepartment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ──────────────────────────────────────────────
// Allocation Requests
// ──────────────────────────────────────────────

async function generateRequestNumber() {
  const year = new Date().getFullYear();
  const prefix = `AR-${year}-`;
  const last = await prisma.allocationRequest.findFirst({
    where: { requestNumber: { startsWith: prefix } },
    orderBy: { requestNumber: 'desc' },
    select: { requestNumber: true },
  });
  let seq = 1;
  if (last) {
    const parts = last.requestNumber.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function listAllocationRequests(req, res) {
  try {
    const { page = 1, pageSize = 20, search, source, status, priority } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const take = parseInt(pageSize, 10);

    const where = {};
    if (search) {
      where.OR = [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { patientName: { contains: search, mode: 'insensitive' } },
        { uhid: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (source) {
      if (source === 'WARD_TRANSFER') {
        return res.json({ requests: [], summary: { total: 0, pending: 0, approved: 0, rejected: 0, critical: 0 }, pagination: { page: 1, pageSize: take, total: 0, totalPages: 0 }, message: 'WARD_TRANSFER requests are handled by Reception. HR receives IPD nurse allocation after transfer.' });
      }
      where.sourceModule = source;
    } else {
      where.sourceModule = { not: 'WARD_TRANSFER' };
    }
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [total, requests] = await Promise.all([
      prisma.allocationRequest.count({ where }),
      prisma.allocationRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    // Single aggregate query for summary (avoids 5 separate count round-trips)
    const aggRows = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
        COUNT(*) FILTER (WHERE priority = 'CRITICAL' AND status = 'PENDING')::int AS critical
      FROM "AllocationRequest"
      WHERE "sourceModule" != 'WARD_TRANSFER'
    `);
    const row = Array.isArray(aggRows) ? aggRows[0] : aggRows;
    const summary = { total: row.total, pending: row.pending, approved: row.approved, rejected: row.rejected, critical: row.critical };

    return res.json({ requests, summary, pagination: { page: parseInt(page, 10), pageSize: take, total, totalPages: Math.ceil(total / take) } });
  } catch (err) {
    console.error('listAllocationRequests error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getAllocationRequestDetail(req, res) {
  try {
    const request = await prisma.allocationRequest.findUnique({
      where: { id: req.params.id },
      include: { history: { orderBy: { createdAt: 'desc' } } },
    });
    if (!request) return res.status(404).json({ message: 'Allocation request not found' });

    // Enrich with patient, admission, OT data
    let patientData = null, admissionData = null, otRequestData = null;
    try {
      patientData = await prisma.patient.findUnique({ where: { id: request.patientId }, select: { id: true, name: true, uhid: true, gender: true, age: true, mobile: true } });
    } catch (_) { /* ignore */ }
    if (request.admissionId) {
      try {
        admissionData = await prisma.admission.findUnique({
          where: { id: request.admissionId },
          select: { id: true, ipdNumber: true, clinicalCondition: true, ward: { select: { id: true, name: true } }, bed: { select: { code: true } } },
        });
      } catch (_) { /* ignore */ }
    }
    if (request.otRequestId) {
      try {
        otRequestData = await prisma.otRequest.findUnique({
          where: { id: request.otRequestId },
          select: { id: true, requestNumber: true, surgeryRecommendation: true, diagnosis: true, priority: true },
        });
      } catch (_) { /* ignore */ }
    }

    return res.json({ request: { ...request, patient: patientData, admission: admissionData, otRequest: otRequestData } });
  } catch (err) {
    console.error('getAllocationRequestDetail error:', err?.message || err, err?.stack || '');
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// For Reception/IPD/OT modules to create requests
async function createAllocationRequest(req, res) {
  try {
    const { patientId, uhid, patientName, admissionId, otRequestId, sourceModule, department, requestedStaffType, reason, requiredShift, priority } = req.body;
    const userId = req.user?.userId || req.user?.id || req.body.requestedById;
    if (!userId) return res.status(400).json({ message: 'requestedById is required' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const requestNumber = await generateRequestNumber();

    const request = await prisma.allocationRequest.create({
      data: {
        requestNumber,
        patientId, uhid, patientName,
        admissionId: admissionId || null,
        otRequestId: otRequestId || null,
        sourceModule, department: department || null,
        requestedStaffType, reason: reason || null,
        requiredShift: requiredShift || null,
        priority: priority || 'MEDIUM',
        requestedById: userId,
        requestedByName: user.name,
        history: {
          create: {
            action: 'REQUEST_CREATED',
            userId,
            userName: user.name,
            details: JSON.stringify({ sourceModule, requestedStaffType, priority: priority || 'MEDIUM' }),
          },
        },
      },
    });

    return res.status(201).json({ request });
  } catch (err) {
    console.error('createAllocationRequest error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function approveAllocationRequest(req, res) {
  try {
    const { id } = req.params;
    const { assignedToId, shift, remarks } = req.body;
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userName = req.user.name || 'HR';

    const existing = await prisma.allocationRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Allocation request not found' });
    if (existing.status !== 'PENDING') return res.status(400).json({ message: `Request is already ${existing.status.toLowerCase()}` });

    // Validate assigned employee
    let assignedEmployee = null;
    if (assignedToId) {
      assignedEmployee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, name: true, role: true } });
      if (!assignedEmployee) return res.status(400).json({ message: 'Assigned employee not found' });
    }

    const data = {
      status: 'APPROVED',
      approvedById: userId,
      approvedByName: userName,
      approvedAt: new Date(),
      assignedShift: shift || existing.assignedShift || existing.requiredShift,
      remarks: remarks || existing.remarks,
    };
    if (assignedToId) {
      data.assignedToId = assignedToId;
      data.assignedToName = assignedEmployee.name;
      data.assignedById = userId;
      data.assignedByName = userName;
      data.assignedAt = new Date();
    }

    const updated = await prisma.allocationRequest.update({
      where: { id },
      data,
    });

    // Create history
    await prisma.allocationRequestHistory.create({
      data: {
        requestId: id,
        action: 'REQUEST_APPROVED',
        userId,
        userName,
        details: JSON.stringify({ assignedToId: assignedToId || null, assignedToName: assignedEmployee?.name || null, shift, remarks }),
      },
    });

    // If staff assigned, also create assignment history and update source allocation
    if (assignedToId) {
      await prisma.allocationRequestHistory.create({
        data: {
          requestId: id,
          action: 'STAFF_ASSIGNED',
          userId,
          userName,
          details: JSON.stringify({ assignedToId, assignedToName: assignedEmployee.name, shift, remarks }),
        },
      });

      // Update source module allocation
      await applyNurseAssignment(prisma, existing, assignedToId);

      // Sync with DutyRoster + NurseDuty
      await syncDutyFromAllocation(existing, assignedToId, assignedEmployee.name, userId, userName, shift);

      // Direct WARD_TRANSFER update (belt-and-suspenders)
      if (existing.sourceModule === 'WARD_TRANSFER' && existing.otRequestId) {
        try {
          const rows2 = await prisma.$executeRaw`
            UPDATE "RecoveryRecord"
            SET "assignedNurseId" = ${assignedToId}::uuid
            WHERE "surgerySessionId" IN (
              SELECT ss.id FROM "SurgerySession" ss
              JOIN "SurgerySchedule" sch ON sch.id = ss."surgeryScheduleId"
              WHERE sch."otRequestId" = ${existing.otRequestId}::uuid
            )
            AND "status" = 'TRANSFERRED'
          `;
          console.log('RAW WARD_TRANSFER approve update affected', rows2, 'rows');
        } catch (directErr) {
          console.error('RAW WARD_TRANSFER approve error:', directErr?.message || directErr);
        }
      }

      // Send notification to assigned nurse
      try {
        const wardInfo = existing.sourceModule === 'WARD_TRANSFER' && existing.reason ? ` in ${existing.reason.replace('Ward transfer to ', '')}` : '';
        await prisma.notification.create({
          data: {
            userId: assignedToId,
            type: 'ALERT',
            severity: 'INFO',
            title: 'New Patient Assigned',
            message: `Patient ${existing.patientName} (${existing.uhid}) has been assigned${wardInfo ? ` to you${wardInfo}` : ` to you. Source: ${existing.sourceModule}`}.`,
          },
        });
      } catch (err) { console.error('approveAllocationRequest notification error:', err?.message || err); }
    }

    return res.json({ request: updated });
  } catch (err) {
    console.error('approveAllocationRequest error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function rejectAllocationRequest(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userName = req.user.name || 'HR';

    if (!reason) return res.status(400).json({ message: 'Rejection reason is required' });

    const existing = await prisma.allocationRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Allocation request not found' });
    if (existing.status !== 'PENDING') return res.status(400).json({ message: `Request is already ${existing.status.toLowerCase()}` });

    const updated = await prisma.allocationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedById: userId,
        rejectedByName: userName,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await prisma.allocationRequestHistory.create({
      data: {
        requestId: id,
        action: 'REQUEST_REJECTED',
        userId,
        userName,
        details: JSON.stringify({ reason }),
      },
    });

    return res.json({ request: updated });
  } catch (err) {
    console.error('rejectAllocationRequest error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function assignStaffToRequest(req, res) {
  try {
    const { id } = req.params;
    const { assignedToId, shift, remarks } = req.body;
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userName = req.user.name || 'HR';

    const existing = await prisma.allocationRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Allocation request not found' });
    if (existing.status !== 'APPROVED' && existing.status !== 'PENDING') return res.status(400).json({ message: 'Cannot assign staff to a rejected request' });

    const assignedEmployee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, name: true, role: true } });
    if (!assignedEmployee) return res.status(400).json({ message: 'Employee not found' });

    const action = existing.assignedToId ? 'STAFF_REASSIGNED' : 'STAFF_ASSIGNED';

    const updated = await prisma.allocationRequest.update({
      where: { id },
      data: {
        assignedToId,
        assignedToName: assignedEmployee.name,
        assignedById: userId,
        assignedByName: userName,
        assignedAt: new Date(),
        assignedShift: shift || existing.assignedShift || existing.requiredShift,
        remarks: remarks || existing.remarks,
        status: existing.status === 'PENDING' ? 'APPROVED' : existing.status,
        approvedById: existing.approvedById || userId,
        approvedByName: existing.approvedByName || userName,
        approvedAt: existing.approvedAt || new Date(),
      },
    });

    await prisma.allocationRequestHistory.create({
      data: {
        requestId: id,
        action,
        userId,
        userName,
        details: JSON.stringify({ assignedToId, assignedToName: assignedEmployee.name, shift, remarks }),
      },
    });

    await applyNurseAssignment(prisma, existing, assignedToId);

    // Sync with DutyRoster + NurseDuty
    await syncDutyFromAllocation(existing, assignedToId, assignedEmployee.name, userId, userName, shift);

    // Direct WARD_TRANSFER update (raw SQL to bypass Prisma relation issues)
    if (existing.sourceModule === 'WARD_TRANSFER' && existing.otRequestId) {
      try {
          const rows2 = await prisma.$executeRaw`
            UPDATE "RecoveryRecord"
            SET "assignedNurseId" = ${assignedToId}::uuid
            WHERE "surgerySessionId" IN (
              SELECT ss.id FROM "SurgerySession" ss
              JOIN "SurgerySchedule" sch ON sch.id = ss."surgeryScheduleId"
              WHERE sch."otRequestId" = ${existing.otRequestId}::uuid
            )
            AND "status" = 'TRANSFERRED'
          `;
          console.log('RAW WARD_TRANSFER assign update affected', rows2, 'rows');
      } catch (directErr) {
        console.error('RAW WARD_TRANSFER error:', directErr?.message || directErr);
      }
    }

    // Send notification to assigned nurse
    try {
      const wardInfo = existing.sourceModule === 'WARD_TRANSFER' && existing.reason ? ` in ${existing.reason.replace('Ward transfer to ', '')}` : '';
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: 'ALERT',
          severity: 'INFO',
          title: 'New Patient Assigned',
          message: `Patient ${existing.patientName} (${existing.uhid}) has been assigned${wardInfo ? ` to you${wardInfo}` : ` to you. Source: ${existing.sourceModule}`}.`,
        },
      });
    } catch (err) { console.error('assignStaffToRequest notification error:', err?.message || err); }

    return res.json({ request: updated });
  } catch (err) {
    console.error('assignStaffToRequest error:', err?.message || err, err?.stack || '');
    console.error('assignStaffToRequest params:', { id: req.params.id, assignedToId: req.body?.assignedToId, shift: req.body?.shift });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Shift timings for DutyRoster sync ───
const SHIFT_TIMINGS = {
  MORNING: { start: '07:00', end: '15:00' },
  EVENING: { start: '15:00', end: '23:00' },
  NIGHT: { start: '23:00', end: '07:00' },
};

async function syncDutyFromAllocation(request, assignedToId, assignedToName, userId, userName, shiftOverride) {
  try {
    const shift = shiftOverride || request.assignedShift || request.requiredShift || 'MORNING';
    const timings = SHIFT_TIMINGS[shift] || SHIFT_TIMINGS.MORNING;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    console.log(`syncDutyFromAllocation called: emp=${assignedToId}, name=${assignedToName}, shift=${shift}, patientId=${request.patientId}, srcModule=${request.sourceModule}, admissionId=${request.admissionId}`);

    // Map sourceModule to dutyType
    let dutyType = 'WARD';
    let wardType = null;
    let dutyLocation = request.department || request.reason || null;
    let otRoomName = null;
    let recoveryRoomName = null;

    if (request.sourceModule === 'OT') {
      dutyType = 'OT';
      if (request.otRequestId) {
        try {
          const sched = await prisma.surgerySchedule.findUnique({
            where: { otRequestId: request.otRequestId },
            select: { otRoom: { select: { roomName: true } }, surgeon: { select: { user: { select: { name: true } } } } },
          });
          if (sched?.otRoom) otRoomName = sched.otRoom.roomName;
        } catch (_) { /* ignore */ }
      }
    } else if (request.sourceModule === 'WARD_TRANSFER' || request.sourceModule === 'RECOVERY') {
      dutyType = 'RECOVERY';
      recoveryRoomName = request.reason || null;
    } else if (request.sourceModule === 'IPD') {
      dutyType = 'WARD';
    }

    // Get ward info from admission
    if (request.admissionId) {
      try {
        const admission = await prisma.admission.findUnique({
          where: { id: request.admissionId },
          select: { ward: { select: { id: true, name: true, type: true } }, department: true },
        });
        if (admission) {
          dutyLocation = admission.ward?.name || admission.department || dutyLocation;
          wardType = admission.ward?.type || null;

          // Upsert NurseDuty entry
          if (admission.ward?.id && admission.ward?.name) {
            await prisma.nurseDuty.upsert({
              where: { nurseId_dutyDate_shift: { nurseId: assignedToId, dutyDate: today, shift } },
              update: { wardId: admission.ward.id, wardName: admission.ward.name, nurseName: assignedToName },
              create: { nurseId: assignedToId, nurseName: assignedToName, wardId: admission.ward.id, wardName: admission.ward.name, shift, dutyDate: today },
            });
          }
        }
      } catch (_) { /* ignore */ }
    }

    // Check if a DutyRoster entry already exists for this nurse + today + shift
    let existingDuty = null;
    try {
      existingDuty = await prisma.dutyRoster.findFirst({
        where: { employeeId: assignedToId, date: today, shift },
      });
    } catch (_) { /* ignore */ }

    const patientId = request.patientId;

    if (existingDuty) {
      // Update existing entry — append patient
      let existingPatients = [];
      try { existingPatients = JSON.parse(existingDuty.assignedPatientIds || '[]'); } catch { existingPatients = []; }
      if (!existingPatients.includes(patientId)) {
        existingPatients.push(patientId);
      }
      await prisma.dutyRoster.update({
        where: { id: existingDuty.id },
        data: {
          assignedPatientIds: JSON.stringify(existingPatients),
          patientCount: existingPatients.length,
          dutyLocation: existingDuty.dutyLocation || dutyLocation,
          wardType: existingDuty.wardType || wardType,
          otRoomName: existingDuty.otRoomName || otRoomName,
          recoveryRoomName: existingDuty.recoveryRoomName || recoveryRoomName,
        },
      });
    } else {
      // Create new DutyRoster entry
      await prisma.dutyRoster.create({
        data: {
          date: today,
          shift,
          employeeId: assignedToId,
          employeeName: assignedToName,
          department: request.department || null,
          dutyType,
          dutyLocation,
          startTime: timings.start,
          endTime: timings.end,
          wardType,
          assignedPatientIds: JSON.stringify([patientId]),
          patientCount: 1,
          otRoomName,
          createdById: userId,
          createdByName: userName,
        },
      });
    }
  } catch (err) {
    console.error('syncDutyFromAllocation error:', err?.message || err);
  }
}

async function removePatientFromDutyRoster(employeeId, patientId) {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const duties = await prisma.dutyRoster.findMany({
      where: { employeeId, date: today },
    });
    for (const duty of duties) {
      let patients = [];
      try { patients = JSON.parse(duty.assignedPatientIds || '[]'); } catch { patients = []; }
      const idx = patients.indexOf(patientId);
      if (idx !== -1) {
        patients.splice(idx, 1);
        await prisma.dutyRoster.update({
          where: { id: duty.id },
          data: {
            assignedPatientIds: patients.length > 0 ? JSON.stringify(patients) : null,
            patientCount: patients.length,
          },
        });
        break;
      }
    }
  } catch (err) {
    console.error('removePatientFromDutyRoster error:', err?.message || err);
  }
}

async function listAvailableStaff(req, res) {
  try {
    const { staffType, department, wardName, shift } = req.query;

    // Map requestedStaffType to roles
    let roleFilter = {};
    if (staffType === 'NURSE') roleFilter = { role: 'NURSE' };
    else if (staffType === 'OT_NURSE') roleFilter = { role: 'NURSE' };
    else if (staffType === 'OT_TECHNICIAN') roleFilter = { role: { in: ['LAB_TECHNICIAN', 'TECHNICIAN'] } };

    const where = { isActive: true, ...roleFilter };
    if (department) where.department = department;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, role: true, department: true, employeeId: true, isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    // Filter by shift if requested — show employees with that shift assignment
    let filteredUserIds = null;
    if (shift) {
      const allAssignments = await prisma.shiftAssignment.findMany({
        include: { shift: { select: { name: true } } },
      });
      const shiftNameMap = { MORNING: 'Morning', EVENING: 'Evening', NIGHT: 'Night' };
      const targetName = shiftNameMap[shift.toUpperCase()];
      if (targetName) {
        const matchingEmpIds = new Set(
          allAssignments
            .filter((a) => a.shift.name.toLowerCase().includes(targetName.toLowerCase()))
            .map((a) => a.employeeId)
        );
        filteredUserIds = matchingEmpIds;
      }
    }

    // Get admission counts
    const admissions = await prisma.admission.findMany({
      where: { status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] }, nurseId: { not: null } },
      select: { nurseId: true },
    });
    const admissionCountMap = {};
    for (const a of admissions) {
      admissionCountMap[a.nurseId] = (admissionCountMap[a.nurseId] || 0) + 1;
    }

    // Get OT counts (otNurseId is required, so no null check needed)
    const otSchedules = await prisma.surgerySchedule.findMany({
      where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      select: { otNurseId: true },
    });
    const otCountMap = {};
    for (const o of otSchedules) {
      otCountMap[o.otNurseId] = (otCountMap[o.otNurseId] || 0) + 1;
    }

    // Filter by shift if requested before fetching duties
    let filteredUsers = users;
    if (filteredUserIds) {
      filteredUsers = filteredUsers.filter((u) => filteredUserIds.has(u.id));
    }

    // Get today's nurse duty assignments (only for filtered users)
    const today = toDutyDate();
    const duties = await prisma.nurseDuty.findMany({
      where: { dutyDate: today, nurseId: { in: filteredUsers.map((u) => u.id) } },
      select: { nurseId: true, wardId: true, wardName: true, shift: true },
    });
    const dutyMap = {};
    for (const d of duties) {
      dutyMap[d.nurseId] = { wardId: d.wardId, wardName: d.wardName, shift: d.shift };
    }

    // Filter by ward if specified
    if (wardName && typeof wardName === 'string' && wardName.trim()) {
      const nurseIdsWithWardDuty = new Set(
        duties.filter((d) => wardNameMatches(d.wardName, wardName)).map((d) => d.nurseId)
      );
      filteredUsers = filteredUsers.filter((u) => nurseIdsWithWardDuty.has(u.id));
    }

    const staff = filteredUsers.map((u) => {
      const aCount = admissionCountMap[u.id] || 0;
      const oCount = otCountMap[u.id] || 0;
      let availabilityStatus;
      if (oCount > 0) availabilityStatus = 'Busy';
      else if (aCount > 0) availabilityStatus = 'Assigned';
      else availabilityStatus = 'Available';

      let workload;
      const total = aCount + oCount;
      if (total >= 3) workload = 'High';
      else if (total >= 1) workload = 'Medium';
      else workload = 'Low';

      const duty = dutyMap[u.id] || null;

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        department: u.department || '—',
        employeeId: u.employeeId,
        currentShift: null,
        availabilityStatus,
        assignedPatients: aCount,
        assignedOtCases: oCount,
        currentWorkload: workload,
        currentDuty: duty,
      };
    });

    return res.json({ staff });
  } catch (err) {
    console.error('listAvailableStaff error:', err?.message || err, err?.stack || '');
    console.error('listAvailableStaff query:', { staffType, department, wardName });
    return res.status(500).json({ message: 'Internal server error: ' + (err?.message || 'Unknown') });
  }
}

async function getAllocationRequestHistory(req, res) {
  try {
    const { id } = req.params;
    const history = await prisma.allocationRequestHistory.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ history });
  } catch (err) {
    console.error('getAllocationRequestHistory error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ──────────────────────────────────────────────
// Patient Staff Allocations
// ──────────────────────────────────────────────

async function listPatientAllocations(req, res) {
  try {
    const { page = 1, pageSize = 20, search, department, shift, status } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const take = parseInt(pageSize, 10);

    const where = { status: { in: ['APPROVED', 'COMPLETED', 'TRANSFERRED'] }, assignedToId: { not: null } };
    if (search) {
      where.OR = [
        { patientName: { contains: search, mode: 'insensitive' } },
        { uhid: { contains: search, mode: 'insensitive' } },
        { assignedToName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (department) where.department = department;
    if (shift) where.assignedShift = shift;
    if (status) where.status = status;

    const [total, allocations] = await Promise.all([
      prisma.allocationRequest.count({ where }),
      prisma.allocationRequest.findMany({
        where,
        orderBy: { assignedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    // Enrich with admission data
    const enriched = await Promise.all(allocations.map(async (a) => {
      let admissionData = null;
      if (a.admissionId) {
        try {
          admissionData = await prisma.admission.findUnique({
            where: { id: a.admissionId },
            select: { ipdNumber: true, clinicalCondition: true, ward: { select: { name: true } }, bed: { select: { code: true } } },
          });
    } catch (err) { console.error('allocateWork notification error:', err?.message || err); }
      }
      return { ...a, admission: admissionData };
    }));

    // Summary
    const allActive = await prisma.allocationRequest.count({ where: { status: 'APPROVED', assignedToId: { not: null } } });
    const allCompleted = await prisma.allocationRequest.count({ where: { status: 'COMPLETED', assignedToId: { not: null } } });
    const allTransferred = await prisma.allocationRequest.count({ where: { status: 'TRANSFERRED', assignedToId: { not: null } } });
    const totalNurses = await prisma.user.count({ where: { role: 'NURSE', isActive: true } });
    const assignedNurseIds = await prisma.allocationRequest.findMany({
      where: { status: 'APPROVED', assignedToId: { not: null } },
      select: { assignedToId: true },
      distinct: ['assignedToId'],
    });

    return res.json({
      allocations: enriched,
      summary: {
        totalAllocations: total,
        activeAllocations: allActive,
        completedAllocations: allCompleted,
        availableNurses: totalNurses - assignedNurseIds.length,
        assignedNurses: assignedNurseIds.length,
      },
      pagination: { page: parseInt(page, 10), pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    console.error('listPatientAllocations error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPatientAllocationDetail(req, res) {
  try {
    const allocation = await prisma.allocationRequest.findUnique({
      where: { id: req.params.id },
      include: { history: { orderBy: { createdAt: 'desc' } } },
    });
    if (!allocation) return res.status(404).json({ message: 'Allocation not found' });

    let patientData = null, admissionData = null, assignedEmployee = null;
    try {
      patientData = await prisma.patient.findUnique({ where: { id: allocation.patientId }, select: { id: true, name: true, uhid: true, gender: true, age: true, mobile: true } });
    } catch (_) { /* ignore */ }
    if (allocation.admissionId) {
      try {
        admissionData = await prisma.admission.findUnique({
          where: { id: allocation.admissionId },
          select: { id: true, ipdNumber: true, clinicalCondition: true, department: true, admissionDate: true, ward: { select: { name: true } }, bed: { select: { code: true } } },
        });
      } catch (_) { /* ignore */ }
    }
    if (allocation.assignedToId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: allocation.assignedToId },
          select: { id: true, name: true, role: true, employeeId: true, department: true },
        });
        if (user) {
          const aCount = await prisma.admission.count({ where: { nurseId: user.id, status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] } } });
          const oCount = await prisma.surgerySchedule.count({ where: { otNurseId: user.id, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } });
          assignedEmployee = { ...user, activePatients: aCount, activeOtCases: oCount, workload: aCount + oCount >= 3 ? 'High' : aCount + oCount >= 1 ? 'Medium' : 'Low' };
        }
      } catch (_) { /* ignore */ }
    }

    return res.json({ allocation: { ...allocation, patient: patientData, admission: admissionData, assignedEmployee } });
  } catch (err) {
    console.error('getPatientAllocationDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function completePatientAllocation(req, res) {
  try {
    const { id } = req.params;
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userName = req.user.name || 'HR';

    const allocation = await prisma.allocationRequest.findUnique({ where: { id } });
    if (!allocation) return res.status(404).json({ message: 'Allocation not found' });
    if (allocation.status !== 'APPROVED') return res.status(400).json({ message: 'Only active allocations can be completed' });

    await prisma.allocationRequest.update({
      where: { id },
      data: { status: 'COMPLETED', remarks: allocation.remarks },
    });

    await prisma.allocationRequestHistory.create({
      data: { requestId: id, action: 'ALLOCATION_COMPLETED', userId, userName, details: JSON.stringify({ previousStatus: 'APPROVED' }) },
    });

    // Remove nurse assignment from source records
    await releaseNurseAssignment(prisma, allocation);

    // Remove patient from DutyRoster
    if (allocation.assignedToId && allocation.patientId) {
      await removePatientFromDutyRoster(allocation.assignedToId, allocation.patientId);
    }

    return res.json({ message: 'Allocation completed' });
  } catch (err) {
    console.error('completePatientAllocation error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function transferPatientAllocation(req, res) {
  try {
    const { id } = req.params;
    const { newAssignedToId, reason } = req.body;
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userName = req.user.name || 'HR';

    const allocation = await prisma.allocationRequest.findUnique({ where: { id } });
    if (!allocation) return res.status(404).json({ message: 'Allocation not found' });
    if (allocation.status !== 'APPROVED') return res.status(400).json({ message: 'Only active allocations can be transferred' });

    const newEmployee = await prisma.user.findUnique({ where: { id: newAssignedToId }, select: { id: true, name: true, role: true } });
    if (!newEmployee) return res.status(400).json({ message: 'Employee not found' });

    const prevName = allocation.assignedToName;

    await prisma.allocationRequest.update({
      where: { id },
      data: {
        assignedToId: newAssignedToId,
        assignedToName: newEmployee.name,
        assignedById: userId,
        assignedByName: userName,
        assignedAt: new Date(),
        status: 'APPROVED',
        assignedShift: allocation.assignedShift || allocation.requiredShift,
        remarks: allocation.remarks,
      },
    });

    await prisma.allocationRequestHistory.create({
      data: {
        requestId: id,
        action: 'STAFF_REASSIGNED',
        userId,
        userName,
        details: JSON.stringify({ previousNurse: prevName, newNurse: newEmployee.name, reason: reason || null }),
      },
    });

    await applyNurseAssignment(prisma, { ...allocation, assignedToId: newAssignedToId }, newAssignedToId);

    // Sync DutyRoster: remove from old nurse, add to new nurse
    if (allocation.assignedToId && allocation.patientId) {
      await removePatientFromDutyRoster(allocation.assignedToId, allocation.patientId);
    }
    await syncDutyFromAllocation(allocation, newAssignedToId, newEmployee.name, userId, userName);

    // Send notification to new nurse
    try {
      await prisma.notification.create({
        data: {
          userId: newAssignedToId,
          type: 'ALERT',
          severity: 'INFO',
          title: 'Patient Reassigned to You',
          message: `Patient ${allocation.patientName} (${allocation.uhid}) has been reassigned to you. Previous nurse: ${prevName}.`,
        },
      });
    } catch (_) { /* ignore */ }

    return res.json({ message: 'Allocation transferred', assignedToName: newEmployee.name });
  } catch (err) {
    console.error('transferPatientAllocation error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function changeAllocationShift(req, res) {
  try {
    const { id } = req.params;
    const { shift, reason } = req.body;
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userName = req.user.name || 'HR';

    if (!['MORNING', 'EVENING', 'NIGHT'].includes(shift)) return res.status(400).json({ message: 'Invalid shift' });

    const allocation = await prisma.allocationRequest.findUnique({ where: { id } });
    if (!allocation) return res.status(404).json({ message: 'Allocation not found' });

    const prevShift = allocation.assignedShift || allocation.requiredShift;

    await prisma.allocationRequest.update({
      where: { id },
      data: { assignedShift: shift },
    });

    await prisma.allocationRequestHistory.create({
      data: {
        requestId: id,
        action: 'SHIFT_CHANGED',
        userId,
        userName,
        details: JSON.stringify({ previousShift: prevShift, newShift: shift, reason: reason || null }),
      },
    });

    // Update DutyRoster shift for any entries matching this nurse + patient + today
    if (allocation.assignedToId && allocation.patientId) {
      try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const timings = SHIFT_TIMINGS[shift] || SHIFT_TIMINGS.MORNING;
        const duties = await prisma.dutyRoster.findMany({
          where: { employeeId: allocation.assignedToId, date: today },
        });
        for (const d of duties) {
          let patients = [];
          try { patients = JSON.parse(d.assignedPatientIds || '[]'); } catch { patients = []; }
          if (patients.includes(allocation.patientId)) {
            await prisma.dutyRoster.update({
              where: { id: d.id },
              data: { shift, startTime: timings.start, endTime: timings.end },
            });
            break;
          }
        }
      } catch (_) { /* ignore */ }
    }

    return res.json({ message: 'Shift updated' });
  } catch (err) {
    console.error('changeAllocationShift error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ──────────────────────────────────────────────
// Nurse Duty Management
// ──────────────────────────────────────────────

async function assignNurseDuty(req, res) {
  try {
    const { id } = req.params;
    const { wardId, wardName, shift, dutyDate } = req.body;
    if (!wardId || !wardName || !shift) return res.status(400).json({ message: 'wardId, wardName, and shift are required' });

    const nurse = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
    if (!nurse || nurse.role !== 'NURSE') return res.status(400).json({ message: 'Employee not found or not a nurse' });

    const date = toDutyDate(dutyDate ? new Date(dutyDate) : new Date());

    // Upsert: replace existing duty for same nurse+date+shift
    const duty = await prisma.nurseDuty.upsert({
      where: { nurseId_dutyDate_shift: { nurseId: id, dutyDate: date, shift } },
      update: { wardId, wardName, nurseName: nurse.name },
      create: { nurseId: id, nurseName: nurse.name, wardId, wardName, shift, dutyDate: date },
    });

    return res.json({ duty });
  } catch (err) {
    console.error('assignNurseDuty error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getNurseDuties(req, res) {
  try {
    const { id } = req.params;
    const today = toDutyDate();
    const duties = await prisma.nurseDuty.findMany({
      where: { nurseId: id, dutyDate: { gte: today } },
      orderBy: { dutyDate: 'asc' },
    });
    return res.json({ duties });
  } catch (err) {
    console.error('getNurseDuties error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function removeNurseDuty(req, res) {
  try {
    const { id, dutyId } = req.params;
    await prisma.nurseDuty.delete({ where: { id: dutyId, nurseId: id } });
    return res.json({ message: 'Duty removed' });
  } catch (err) {
    if (err && err.code === 'P2025') return res.status(404).json({ message: 'Duty not found' });
    console.error('removeNurseDuty error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Ward nurses lookup (for allocation approval page) ───

async function listWardNurses(req, res) {
  try {
    const { wardId, wardName, shift } = req.query;
    const today = toDutyDate();

    const where = { dutyDate: today };
    if (wardId) where.wardId = wardId;
    if (wardName) where.wardName = { contains: wardName, mode: 'insensitive' };
    if (shift) where.shift = shift;

    const duties = await prisma.nurseDuty.findMany({ where, select: { nurseId: true, nurseName: true, wardId: true, wardName: true, shift: true } });

    // Enrich with patient counts
    const nurseIds = duties.map((d) => d.nurseId);
    const admissions = await prisma.admission.findMany({
      where: { nurseId: { in: nurseIds }, status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] } },
      select: { nurseId: true },
    });
    const countMap = {};
    for (const a of admissions) {
      countMap[a.nurseId] = (countMap[a.nurseId] || 0) + 1;
    }

    const nurses = duties.map((d) => ({
      id: d.nurseId,
      name: d.nurseName,
      wardId: d.wardId,
      wardName: d.wardName,
      shift: d.shift,
      activePatients: countMap[d.nurseId] || 0,
    }));

    return res.json({ nurses });
  } catch (err) {
    console.error('listWardNurses error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ──────────────────────────────────────────────
// Nurse Allocation Page
// ──────────────────────────────────────────────

async function listNurseAllocations(req, res) {
  try {
    const nurses = await prisma.user.findMany({
      where: { role: 'NURSE', isActive: true },
      select: { id: true, name: true, employeeId: true, department: true, phone: true, email: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    // Get today's duties
    const today = toDutyDate();
    const duties = await prisma.nurseDuty.findMany({
      where: { dutyDate: today, nurseId: { in: nurses.map((n) => n.id) } },
      select: { nurseId: true, wardId: true, wardName: true, shift: true },
    });
    const dutyMap = {};
    for (const d of duties) dutyMap[d.nurseId] = { wardId: d.wardId, wardName: d.wardName, shift: d.shift };

    // Get patient counts
    const admissions = await prisma.admission.findMany({
      where: { nurseId: { in: nurses.map((n) => n.id) }, status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] } },
      select: { nurseId: true },
    });
    const patientCount = {};
    for (const a of admissions) patientCount[a.nurseId] = (patientCount[a.nurseId] || 0) + 1;

    // Get OT counts
    const otScheds = await prisma.surgerySchedule.findMany({
      where: { otNurseId: { in: nurses.map((n) => n.id) }, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      select: { otNurseId: true },
    });
    const otCount = {};
    for (const o of otScheds) otCount[o.otNurseId] = (otCount[o.otNurseId] || 0) + 1;

    const list = nurses.map((n) => ({
      id: n.id,
      name: n.name,
      employeeId: n.employeeId,
      department: n.department || '—',
      phone: n.phone,
      email: n.email,
      isActive: n.isActive,
      currentDuty: dutyMap[n.id] || null,
      activePatients: patientCount[n.id] || 0,
      activeOtCases: otCount[n.id] || 0,
    }));

    return res.json({ nurses: list, total: list.length });
  } catch (err) {
    console.error('listNurseAllocations error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function allocateWork(req, res) {
  try {
    const { id } = req.params;
    const { wardId, wardName, shift, dutyDate } = req.body;
    if (!wardId || !wardName || !shift) return res.status(400).json({ message: 'wardId, wardName, and shift are required' });

    const nurse = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });

    const date = toDutyDate(dutyDate ? new Date(dutyDate) : new Date());

    // Upsert duty
    await prisma.nurseDuty.upsert({
      where: { nurseId_dutyDate_shift: { nurseId: id, dutyDate: date, shift } },
      update: { wardId, wardName, nurseName: nurse.name },
      create: { nurseId: id, nurseName: nurse.name, wardId, wardName, shift, dutyDate: date },
    });

    // Send notification to nurse
    try {
      await prisma.notification.create({
        data: {
          userId: id,
          type: 'ALERT',
          severity: 'INFO',
          title: 'Duty Assigned',
          message: `Your duty today: ${wardName} (${shift.replace(/_/g, ' ')})`,
        },
      });
    } catch (err) { console.error('allocateWork notification error:', err?.message || err); }

    // Get updated duty info
    const duties = await prisma.nurseDuty.findMany({
      where: { nurseId: id, dutyDate: date },
      select: { wardId: true, wardName: true, shift: true },
    });

    return res.json({ message: 'Work allocated', duties, nurseName: nurse.name });
  } catch (err) {
    console.error('allocateWork error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function debugAllocationRequest(req, res) {
  try {
    const { id } = req.params;
    const ar = await prisma.allocationRequest.findUnique({
      where: { id },
      select: { id: true, sourceModule: true, otRequestId: true, patientId: true, patientName: true, uhid: true, reason: true, status: true, assignedToId: true, assignedToName: true },
    });
    if (!ar) return res.status(404).json({ message: 'Not found' });
    let surgerySchedule = null, surgerySession = null, recoveryRecord = null;
    if (ar.otRequestId) {
      surgerySchedule = await prisma.surgerySchedule.findUnique({
        where: { otRequestId: ar.otRequestId },
        select: { id: true, otRequestId: true, otNurseId: true, surgeryDate: true },
      });
      if (surgerySchedule?.id) {
        surgerySession = await prisma.surgerySession.findUnique({
          where: { surgeryScheduleId: surgerySchedule.id },
          select: { id: true, surgeryScheduleId: true, status: true },
        });
        if (surgerySession?.id) {
          recoveryRecord = await prisma.recoveryRecord.findMany({
            where: { surgerySessionId: surgerySession.id },
            select: { id: true, assignedNurseId: true, status: true, patientName: true, uhid: true },
          });
        }
      }
    }
    return res.json({ allocationRequest: ar, surgerySchedule, surgerySession, recoveryRecord });
  } catch (err) {
    console.error('debugAllocationRequest error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listEmployees, getEmployeeDetail, listEmployeeAllocations, updateEmployeeStatus, updateEmployeeDepartment, listDepartments, getDepartmentDetail, assignDepartmentHead, updateDepartment, listAllocationRequests, getAllocationRequestDetail, createAllocationRequest, approveAllocationRequest, rejectAllocationRequest, assignStaffToRequest, listAvailableStaff, getAllocationRequestHistory, listPatientAllocations, getPatientAllocationDetail, completePatientAllocation, transferPatientAllocation, changeAllocationShift, assignNurseDuty, getNurseDuties, removeNurseDuty, listWardNurses, listNurseAllocations, allocateWork, debugAllocationRequest };
