const express = require('express');
const { param, body } = require('express-validator');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { roleMiddleware } = require('../../middleware/roleMiddleware');
const { validateRequest } = require('../../middleware/validateRequest');
const {
  listEmployees, getEmployeeDetail, listEmployeeAllocations, updateEmployeeStatus, updateEmployeeDepartment,
  listDepartments, getDepartmentDetail, assignDepartmentHead, updateDepartment,
  listAllocationRequests, getAllocationRequestDetail, createAllocationRequest,
  approveAllocationRequest, rejectAllocationRequest, assignStaffToRequest,
  listAvailableStaff, getAllocationRequestHistory,
  listPatientAllocations, getPatientAllocationDetail, completePatientAllocation,
  transferPatientAllocation, changeAllocationShift,
  assignNurseDuty, getNurseDuties, removeNurseDuty, listWardNurses,
  listNurseAllocations, allocateWork, debugAllocationRequest,
} = require('./hr.controller');
const {
  listShifts, createShift, updateShift, toggleShift,
  getShiftEmployees, assignEmployeeToShift, removeShiftAssignment, changeEmployeeShift,
  getShiftStats, getAvailableEmployees, getShiftHistory,
} = require('./shift.controller');
const {
  listDutyRosters, getDutyRosterDetail, createDutyRoster, updateDutyRoster, deleteDutyRoster,
  getDutyStats, getMyDuties, getTodayDuty,
} = require('./dutyRoster.controller');
const { getHrReportsAnalytics } = require('./hrReports.controller');

const router = express.Router();
const hrOnly = [authMiddleware, roleMiddleware(['HR_MANAGER', 'SUPER_ADMIN'])];
const anyAuth = [authMiddleware];
const allocationRequestCreators = [authMiddleware, roleMiddleware(['HR_MANAGER', 'SUPER_ADMIN', 'RECEPTIONIST', 'OT_TECHNICIAN', 'NURSE', 'DOCTOR'])];

// ─── Employees ───

router.get('/employees', ...hrOnly, listEmployees);

router.get(
  '/employees/:id',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid employee id is required')],
  validateRequest,
  getEmployeeDetail
);

router.get(
  '/employees/:id/allocations',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid employee id is required')],
  validateRequest,
  listEmployeeAllocations
);

router.patch(
  '/employees/:id/status',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid employee id is required'), body('isActive').isBoolean().withMessage('isActive must be a boolean')],
  validateRequest,
  updateEmployeeStatus
);

router.patch(
  '/employees/:id/department',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid employee id is required'), body('department').isString().notEmpty().withMessage('Department name is required')],
  validateRequest,
  updateEmployeeDepartment
);

// ─── Departments ───

router.get('/departments', ...hrOnly, listDepartments);

router.get(
  '/departments/:name',
  ...hrOnly,
  [param('name').isString().notEmpty().withMessage('Department name is required')],
  validateRequest,
  getDepartmentDetail
);

router.patch(
  '/departments/:name/head',
  ...hrOnly,
  [param('name').isString().notEmpty(), body('userId').optional({ values: 'null' }).isUUID().withMessage('Valid user id is required')],
  validateRequest,
  assignDepartmentHead
);

router.patch(
  '/departments/:name',
  ...hrOnly,
  [param('name').isString().notEmpty()],
  validateRequest,
  updateDepartment
);

// ─── Allocation Requests ───

router.get('/allocation-requests/available-staff', ...hrOnly, listAvailableStaff);

router.post('/allocation-requests', ...allocationRequestCreators, [
  body('patientId').isUUID().withMessage('Patient ID is required'),
  body('uhid').isString().notEmpty().withMessage('UHID is required'),
  body('patientName').isString().notEmpty().withMessage('Patient name is required'),
  body('sourceModule').isIn(['IPD', 'OT', 'RECOVERY']).withMessage('Source module must be IPD, OT, or RECOVERY'),
  body('requestedStaffType').isIn(['NURSE', 'OT_NURSE', 'OT_TECHNICIAN']).withMessage('Invalid staff type'),
], validateRequest, createAllocationRequest);

router.get('/allocation-requests', ...hrOnly, listAllocationRequests);

router.get(
  '/allocation-requests/:id',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required')],
  validateRequest,
  getAllocationRequestDetail
);

router.get(
  '/allocation-requests/:id/history',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required')],
  validateRequest,
  getAllocationRequestHistory
);

router.patch(
  '/allocation-requests/:id/approve',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required')],
  validateRequest,
  approveAllocationRequest
);

router.patch(
  '/allocation-requests/:id/reject',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required'), body('reason').isString().notEmpty().withMessage('Rejection reason is required')],
  validateRequest,
  rejectAllocationRequest
);

router.patch(
  '/allocation-requests/:id/assign',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required'), body('assignedToId').isUUID().withMessage('assignedToId is required')],
  validateRequest,
  assignStaffToRequest
);

// ─── Patient Staff Allocations ───

router.get('/patient-allocations', ...hrOnly, listPatientAllocations);

router.get(
  '/patient-allocations/:id',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required')],
  validateRequest,
  getPatientAllocationDetail
);

router.patch(
  '/patient-allocations/:id/complete',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required')],
  validateRequest,
  completePatientAllocation
);

router.patch(
  '/patient-allocations/:id/transfer',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required'), body('newAssignedToId').isUUID().withMessage('newAssignedToId is required')],
  validateRequest,
  transferPatientAllocation
);

router.patch(
  '/patient-allocations/:id/shift',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid id is required'), body('shift').isIn(['MORNING', 'EVENING', 'NIGHT']).withMessage('Shift must be MORNING, EVENING, or NIGHT')],
  validateRequest,
  changeAllocationShift
);

// ─── Nurse Duty Management ───

router.get('/nurse-duties/ward-nurses', ...hrOnly, listWardNurses);

router.post(
  '/employees/:id/duty',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid employee id is required'), body('wardId').isString().notEmpty(), body('shift').isIn(['MORNING', 'EVENING', 'NIGHT'])],
  validateRequest,
  assignNurseDuty
);

router.get(
  '/employees/:id/duties',
  ...hrOnly,
  [param('id').isUUID().withMessage('Valid employee id is required')],
  validateRequest,
  getNurseDuties
);

router.delete(
  '/employees/:id/duties/:dutyId',
  ...hrOnly,
  [param('id').isUUID(), param('dutyId').isUUID()],
  validateRequest,
  removeNurseDuty
);

// ─── Nurse Allocation Page ───

router.get('/nurse-allocations', ...hrOnly, listNurseAllocations);

router.post(
  '/nurse-allocations/:id/allocate',
  ...hrOnly,
  [param('id').isUUID(), body('wardId').isString().notEmpty(), body('wardName').isString().notEmpty(), body('shift').isIn(['MORNING', 'EVENING', 'NIGHT'])],
  validateRequest,
  allocateWork
);

// ─── Debug ───
router.get('/debug/allocation-request/:id', ...hrOnly, debugAllocationRequest);

// ─── Shift Management ───

router.get('/shifts/stats', ...hrOnly, getShiftStats);
router.get('/shifts/available-employees', ...hrOnly, getAvailableEmployees);
router.get('/shifts', ...hrOnly, listShifts);
router.post('/shifts', ...hrOnly, [
  body('name').notEmpty().withMessage('Shift name is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required'),
], validateRequest, createShift);
router.put('/shifts/:id', ...hrOnly, updateShift);
router.patch('/shifts/:id/toggle', ...hrOnly, toggleShift);
router.get('/shifts/:id', ...hrOnly, getShiftEmployees);
router.get('/shifts/:id/history', ...hrOnly, getShiftHistory);
router.post('/shifts/assign', ...hrOnly, [
  body('shiftId').isUUID().withMessage('Shift ID is required'),
  body('employeeId').isUUID().withMessage('Employee ID is required'),
  body('wardType').optional().isIn(['GENERAL', 'ICU', 'PRIVATE']),
  body('dutyLocation').optional().isString(),
  body('department').optional().isString(),
  body('startTime').optional().isString(),
  body('endTime').optional().isString(),
], validateRequest, assignEmployeeToShift);
router.delete('/shifts/assign/:id', ...hrOnly, removeShiftAssignment);
router.patch('/shifts/assign/:id/change', ...hrOnly, [
  body('newShiftId').isUUID().withMessage('New shift ID is required'),
], validateRequest, changeEmployeeShift);

// ─── Duty Roster ───

router.get('/duty-rosters/stats', ...hrOnly, getDutyStats);
router.get('/duty-rosters', ...hrOnly, listDutyRosters);
router.get('/duty-rosters/:id', ...hrOnly, getDutyRosterDetail);
router.post('/duty-rosters', ...hrOnly, [
  body('date').notEmpty().withMessage('Date is required'),
  body('shift').isIn(['MORNING', 'EVENING', 'NIGHT']).withMessage('Shift must be MORNING, EVENING, or NIGHT'),
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('employeeName').notEmpty().withMessage('Employee name is required'),
  body('dutyType').isIn(['GENERAL_WARD', 'PRIVATE_WARD', 'ICU', 'RECOVERY', 'OT']).withMessage('Invalid duty type'),
], validateRequest, createDutyRoster);
router.put('/duty-rosters/:id', ...hrOnly, updateDutyRoster);
router.delete('/duty-rosters/:id', ...hrOnly, deleteDutyRoster);

// ─── Reports & Analytics ───

router.get('/reports/analytics', ...hrOnly, getHrReportsAnalytics);

// ─── Staff Duty View (nurse/staff) ───

router.get('/my-duties', ...anyAuth, getMyDuties);
router.get('/my-duties/today', ...anyAuth, getTodayDuty);

module.exports = router;
