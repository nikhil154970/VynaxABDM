import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { MdAssignment, MdPeople, MdCheckCircle, MdCancel, MdSearch, MdBusiness, MdPerson, MdStar, MdClose, MdWork, MdSchedule, MdHistory, MdLocalHospital, MdRefresh, MdVisibility, MdSwapHoriz, MdAccessTime, MdCheckBox, MdBlock, MdWarning } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import '../ot/SurgeryScheduling.css';

const statusVariant = (s) => {
  if (s === 'APPROVED') return 'green';
  if (s === 'COMPLETED') return 'blue';
  if (s === 'TRANSFERRED') return 'amber';
  return 'gray';
};

const shiftVariant = (s) => {
  if (s === 'MORNING') return 'amber';
  if (s === 'EVENING') return 'purple';
  if (s === 'NIGHT') return 'blue';
  return 'gray';
};

const availabilityVariant = (s) => {
  if (s === 'Available') return 'green';
  if (s === 'Assigned') return 'blue';
  if (s === 'Busy') return 'red';
  return 'gray';
};

const workloadVariant = (s) => {
  if (s === 'High') return 'red';
  if (s === 'Medium') return 'amber';
  return 'green';
};

export default function HrPatientAllocation() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [allocations, setAllocations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [deptFilter, setDeptFilter] = useState(searchParams.get('department') || '');
  const [shiftFilter, setShiftFilter] = useState(searchParams.get('shift') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page'), 10) || 1);

  const [selectedAlloc, setSelectedAlloc] = useState(null);
  const [allocDetail, setAllocDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [shiftOpen, setShiftOpen] = useState(false);
  const [newShift, setNewShift] = useState('');
  const [shiftReason, setShiftReason] = useState('');
  const [shiftUpdating, setShiftUpdating] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize: 20 };
      if (search) params.search = search;
      if (deptFilter) params.department = deptFilter;
      if (shiftFilter) params.shift = shiftFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/hr/patient-allocations', { params });
      setAllocations(Array.isArray(res.data?.allocations) ? res.data.allocations : []);
      setSummary(res.data?.summary || null);
      setPagination(res.data?.pagination || null);
    } catch (e) {
      console.error('Patient allocations fetch error:', e);
      setError(e.response?.data?.message || 'Failed to load allocations');
      setAllocations([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, deptFilter, shiftFilter, statusFilter]);

  useEffect(() => { fetchAllocations(); }, [fetchAllocations]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    if (deptFilter) sp.set('department', deptFilter);
    if (shiftFilter) sp.set('shift', shiftFilter);
    if (statusFilter) sp.set('status', statusFilter);
    if (page > 1) sp.set('page', String(page));
    setSearchParams(sp, { replace: true });
  }, [search, deptFilter, shiftFilter, statusFilter, page, setSearchParams]);

  const openDetail = async (a) => {
    setSelectedAlloc(a);
    setDetailLoading(true);
    setAllocDetail(null);
    try {
      const res = await api.get('/hr/patient-allocations/' + a.id);
      setAllocDetail(res.data?.allocation || null);
    } catch (e) {
      console.error('Patient allocation detail error:', e);
      setError(e.response?.data?.message || 'Failed to load detail');
      setAllocDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleComplete = () => {
    setConfirmCompleteOpen(true);
  };

  const executeComplete = async () => {
    setConfirmCompleteOpen(false);
    setCompleting(true);
    try {
      await api.patch('/hr/patient-allocations/' + selectedAlloc.id + '/complete');
      setSelectedAlloc(null);
      setAllocDetail(null);
      fetchAllocations();
    } catch (e) {
      console.error('Complete allocation error:', e);
      setError(e.response?.data?.message || 'Failed to complete');
    } finally {
      setCompleting(false);
    }
  };

  const openReassign = async () => {
    setStaffLoading(true);
    setReassignOpen(true);
    setSelectedStaffId('');
    setTransferReason('');
    try {
      const res = await api.get('/hr/allocation-requests/available-staff', { params: { staffType: 'NURSE' } });
      setAvailableStaff(Array.isArray(res.data?.staff) ? res.data.staff : []);
    } catch (e) {
      console.error('Fetch available staff error:', e);
      setError(e.response?.data?.message || 'Failed to load available staff');
      setAvailableStaff([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedStaffId) return;
    setTransferring(true);
    try {
      await api.patch('/hr/patient-allocations/' + selectedAlloc.id + '/transfer', {
        newAssignedToId: selectedStaffId,
        reason: transferReason || null,
      });
      setReassignOpen(false);
      setSelectedAlloc(null);
      setAllocDetail(null);
      fetchAllocations();
    } catch (e) { console.error('Transfer allocation error:', e); setError(e.response?.data?.message || 'Failed to transfer'); } finally {
      setTransferring(false);
    }
  };

  const handleShiftChange = async () => {
    if (!newShift) return;
    setShiftUpdating(true);
    try {
      await api.patch('/hr/patient-allocations/' + selectedAlloc.id + '/shift', {
        shift: newShift,
        reason: shiftReason || null,
      });
      setShiftOpen(false);
      setNewShift('');
      setShiftReason('');
      const res = await api.get('/hr/patient-allocations/' + selectedAlloc.id);
      setAllocDetail(res.data?.allocation || null);
    } catch (e) { console.error('Shift change error:', e); setError(e.response?.data?.message || 'Failed to change shift'); } finally {
      setShiftUpdating(false);
    }
  };

  const statCards = summary ? [
    { label: 'Total Allocations', value: summary.totalAllocations, icon: MdAssignment, color: 'gray' },
    { label: 'Active Allocations', value: summary.activeAllocations, icon: MdCheckCircle, color: 'green' },
    { label: 'Completed', value: summary.completedAllocations, icon: MdCheckBox, color: 'blue' },
    { label: 'Available Nurses', value: summary.availableNurses, icon: MdPeople, color: 'amber' },
    { label: 'Assigned Nurses', value: summary.assignedNurses, icon: MdPerson, color: 'purple' },
  ] : [];

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-[#0077B6] rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <MdAssignment className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#001B48]">Patient Staff Allocation</h1>
              <p className="text-sm text-gray-500 mt-1">Manage active nurse-to-patient assignments across all wards.</p>
            </div>
          </div>
          <button type="button" onClick={fetchAllocations}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 active:scale-95 transition shadow-sm flex items-center gap-2">
            <MdRefresh className="w-4.5 h-4.5" /> Refresh
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center justify-between">
            <span className="font-semibold">{error}</span>
            <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition"><MdClose className="w-4 h-4" /></button>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    background: s.color === 'amber' ? '#fffbeb' : s.color === 'green' ? '#f0fdf4' : s.color === 'blue' ? '#eff6ff' : s.color === 'purple' ? '#faf5ff' : '#f8fafc',
                    color: s.color === 'amber' ? '#d97706' : s.color === 'green' ? '#16a34a' : s.color === 'blue' ? '#0077B6' : s.color === 'purple' ? '#8b5cf6' : '#64748b',
                  }}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                  <p className="text-xl font-extrabold text-[#001B48] mt-0.5">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search & Filters */}
        <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <MdSearch className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by Patient / UHID / Nurse..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
            </div>
            <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
              <option value="">All Departments</option>
              <option value="General Ward">General Ward</option>
              <option value="IPD">IPD</option>
              <option value="ICU">ICU</option>
              <option value="Private">Private Ward</option>
            </select>
            <select value={shiftFilter} onChange={(e) => { setShiftFilter(e.target.value); setPage(1); }}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
              <option value="">All Shifts</option>
              <option value="MORNING">Morning</option>
              <option value="EVENING">Evening</option>
              <option value="NIGHT">Night</option>
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
              <option value="">All Status</option>
              <option value="APPROVED">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="TRANSFERRED">Transferred</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="text-left px-4 py-3">Allocation ID</th>
                  <th className="text-left px-4 py-3">Patient</th>
                  <th className="text-left px-4 py-3">Ward / Bed</th>
                  <th className="text-left px-4 py-3">Assigned Staff</th>
                  <th className="text-center px-4 py-3">Shift</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-8 text-gray-450 text-center font-semibold" colSpan={8}>Loading allocations…</td></tr>
                ) : allocations.length === 0 ? (
                  <tr><td className="px-4 py-8 text-gray-455 text-center font-semibold" colSpan={8}>No patient allocations found.</td></tr>
                ) : (
                  allocations.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/60 cursor-pointer transition" onClick={() => openDetail(a)}>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-bold text-[#0077B6]">{a.requestNumber}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-bold text-[#001B48]">{a.patientName}</p>
                          <p className="text-xs text-gray-450 font-semibold mt-0.5">{a.uhid}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-650">
                        {a.admission?.ward?.name || '—'}{a.admission?.bed?.code ? ` / ${a.admission.bed.code}` : ''}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-gray-700">
                          <MdPerson className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>{a.assignedToName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant={shiftVariant(a.assignedShift || a.requiredShift)}>
                          {(a.assignedShift || a.requiredShift || '—').replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 font-semibold">{a.assignedAt ? new Date(a.assignedAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3.5 text-center"><Badge variant={statusVariant(a.status)}>{a.status === 'APPROVED' ? 'Active' : a.status}</Badge></td>
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openDetail(a)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-[#0077B6] transition" title="View Details">
                          <MdVisibility className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500 font-bold">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
              <div className="flex gap-2">
                <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition">Previous</button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedAlloc && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedAlloc(null)}>
          <div className="pl-modal pl-modalAnimate max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdAssignment className="text-white w-5 h-5" /> Allocation: {selectedAlloc.requestNumber}
              </h3>
              <button type="button" onClick={() => setSelectedAlloc(null)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {detailLoading ? (
                <div className="text-center py-8 text-gray-400 font-bold">Loading details…</div>
              ) : allocDetail ? (
                <>
                  {/* Patient Information */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdLocalHospital className="text-[#0077B6] w-4.5 h-4.5" /> Patient Information</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Patient Name</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{allocDetail.patient?.name || allocDetail.patientName}</p></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">UHID</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{allocDetail.uhid}</p></div>
                      {allocDetail.admission?.ipdNumber && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Admission No.</p><p className="text-sm font-mono font-extrabold text-[#001B48] mt-1">{allocDetail.admission.ipdNumber}</p></div>}
                      {allocDetail.patient?.gender && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Gender</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.patient.gender}</p></div>}
                      {allocDetail.patient?.age && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Age</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.patient.age}</p></div>}
                      {allocDetail.admission?.ward?.name && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ward</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.admission.ward.name}</p></div>}
                      {allocDetail.admission?.bed?.code && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bed</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.admission.bed.code}</p></div>}
                      {allocDetail.admission?.clinicalCondition && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Condition</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.admission.clinicalCondition}</p></div>}
                    </div>
                  </div>

                  {/* Staff Information */}
                  <div className="bg-white rounded-2xl border border-gray-150 p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdPerson className="text-green-650 w-4.5 h-4.5" /> Staff Information</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {allocDetail.assignedEmployee ? (
                        <>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Assigned Employee</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{allocDetail.assignedEmployee.name}</p></div>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Employee ID</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.assignedEmployee.employeeId || '—'}</p></div>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Role</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.assignedEmployee.role}</p></div>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Department</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.assignedEmployee.department || '—'}</p></div>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Active Patients</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.assignedEmployee.activePatients || 0}</p></div>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Active OT Cases</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.assignedEmployee.activeOtCases || 0}</p></div>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Current Workload</p><div className="mt-1"><Badge variant={workloadVariant(allocDetail.assignedEmployee.workload)}>{allocDetail.assignedEmployee.workload}</Badge></div></div>
                          <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Current Shift</p><div className="mt-1"><Badge variant={shiftVariant(allocDetail.assignedShift || allocDetail.requiredShift)}>{(allocDetail.assignedShift || allocDetail.requiredShift || '—').replace(/_/g, ' ')}</Badge></div></div>
                        </>
                      ) : <div className="col-span-4 text-sm text-gray-400 font-semibold">Employee details not available</div>}
                    </div>
                  </div>

                  {/* Allocation Information */}
                  <div className="bg-white rounded-2xl border border-gray-150 p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdSchedule className="text-amber-600 w-4.5 h-4.5" /> Allocation Information</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Allocation Date</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.assignedAt ? new Date(allocDetail.assignedAt).toLocaleString('en-IN') : '—'}</p></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Assigned By</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.assignedByName || '—'}</p></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Request Source</p><div className="mt-1"><Badge variant={allocDetail.sourceModule === 'OT' ? 'purple' : allocDetail.sourceModule === 'IPD' ? 'blue' : 'green'}>{allocDetail.sourceModule}</Badge></div></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Priority</p><div className="mt-1"><Badge variant={allocDetail.priority === 'CRITICAL' ? 'rose' : allocDetail.priority === 'HIGH' ? 'amber' : allocDetail.priority === 'MEDIUM' ? 'blue' : 'gray'}>{allocDetail.priority}</Badge></div></div>
                      {allocDetail.admission?.department && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Department</p><p className="text-sm font-bold text-gray-700 mt-1">{allocDetail.admission.department}</p></div>}
                      {allocDetail.admission?.admissionDate && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Admission Date</p><p className="text-sm font-bold text-gray-700 mt-1">{new Date(allocDetail.admission.admissionDate).toLocaleDateString('en-IN')}</p></div>}
                      {allocDetail.remarks && <div className="col-span-2"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Remarks</p><p className="text-sm font-medium text-gray-600 mt-1">{allocDetail.remarks}</p></div>}
                    </div>
                  </div>

                  {/* HR Actions */}
                  {allocDetail.status === 'APPROVED' && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5">HR Actions</h4>
                      <div className="flex flex-wrap gap-2.5">
                        <button type="button" onClick={openReassign}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition shadow-sm active:scale-95">
                          <MdSwapHoriz className="w-4 h-4" /> Reassign Staff
                        </button>
                        <button type="button" onClick={() => { setShiftOpen(true); setNewShift(allocDetail.assignedShift || allocDetail.requiredShift || ''); setShiftReason(''); }}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-[#0077B6] border border-blue-100 hover:bg-blue-100 transition shadow-sm active:scale-95">
                          <MdAccessTime className="w-4 h-4" /> Change Shift
                        </button>
                        <button type="button" onClick={handleComplete} disabled={completing}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition shadow-sm disabled:opacity-50 active:scale-95">
                          <MdCheckCircle className="w-4 h-4" /> {completing ? 'Processing…' : 'Complete Allocation'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Allocation History */}
                  {allocDetail.history?.length > 0 && (
                    <div className="bg-white border border-gray-150 rounded-2xl p-5">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdHistory className="text-purple-600 w-4.5 h-4.5" /> Allocation History</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {allocDetail.history.map((h) => {
                          let details = null;
                          try { details = h.details ? JSON.parse(h.details) : null; } catch { details = null; }
                          return (
                            <div key={h.id} className="flex items-start gap-3 text-xs bg-slate-50 border border-slate-100 rounded-xl p-3">
                              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                                style={{
                                  background: h.action === 'REQUEST_CREATED' || h.action === 'ALLOCATION_CREATED' ? '#eff6ff' : h.action === 'REQUEST_APPROVED' || h.action === 'ALLOCATION_COMPLETED' ? '#f0fdf4' : h.action === 'REQUEST_REJECTED' ? '#fef2f2' : h.action === 'STAFF_REASSIGNED' ? '#fffbeb' : '#faf5ff',
                                  color: h.action === 'REQUEST_CREATED' || h.action === 'ALLOCATION_CREATED' ? '#0077B6' : h.action === 'REQUEST_APPROVED' || h.action === 'ALLOCATION_COMPLETED' ? '#16a34a' : h.action === 'REQUEST_REJECTED' ? '#dc2626' : h.action === 'STAFF_REASSIGNED' ? '#d97706' : '#8b5cf6',
                                }}>
                                {h.action === 'ALLOCATION_COMPLETED' ? <MdCheckCircle className="w-3.5 h-3.5" /> : h.action === 'STAFF_REASSIGNED' ? <MdSwapHoriz className="w-3.5 h-3.5" /> : h.action === 'SHIFT_CHANGED' ? <MdAccessTime className="w-3.5 h-3.5" /> : <MdAssignment className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800">{h.action.replace(/_/g, ' ')}</p>
                                <p className="text-gray-400 font-semibold mt-0.5">by {h.userName} — {new Date(h.createdAt).toLocaleString('en-IN')}</p>
                                {details && (
                                  <div className="text-gray-500 font-semibold mt-1 bg-white border border-gray-100 rounded-lg p-2 space-y-0.5">
                                    {details.previousNurse && <div><span className="text-gray-400">From Nurse:</span> {details.previousNurse}</div>}
                                    {details.newNurse && <div><span className="text-gray-400">To Nurse:</span> {details.newNurse}</div>}
                                    {details.previousShift && <div><span className="text-gray-400">Shift change:</span> {details.previousShift} → {details.newShift}</div>}
                                    {details.reason && <div><span className="text-gray-400">Reason:</span> {details.reason}</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : <div className="text-center py-8 text-gray-450 font-bold">Could not load details.</div>}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button type="button" onClick={() => setSelectedAlloc(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reassign Staff Modal */}
      {reassignOpen && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => { if (!transferring) setReassignOpen(false); }}>
          <div className="pl-modal pl-modalAnimate max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdSwapHoriz className="text-white w-5 h-5" /> Reassign Staff
              </h3>
              <button onClick={() => setReassignOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Assign a new nurse for <span className="text-[#0077B6]">{selectedAlloc?.patientName}</span> (Current: {selectedAlloc?.assignedToName})
              </p>

              <h4 className="text-xs font-bold text-gray-450 uppercase tracking-wider block">Available Nurses</h4>
              {staffLoading ? (
                <div className="text-center py-6 text-gray-405 font-bold">Loading staff…</div>
              ) : availableStaff.length === 0 ? (
                <div className="text-center py-6 text-gray-405 font-bold">No available nurses found.</div>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-150 divide-y divide-gray-100 bg-white">
                  {availableStaff.map((s) => (
                    <div key={s.id}
                      className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-50 transition ${selectedStaffId === s.id ? 'bg-blue-50/50 border-y border-y-[#0077B6]/30' : ''}`}
                      onClick={() => setSelectedStaffId(s.id)}>
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0077B6] flex items-center justify-center text-xs font-bold shrink-0">{s.name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{s.name}</p>
                        <p className="text-xs font-semibold text-gray-400">{s.role} {s.department !== '—' ? `· ${s.department}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={availabilityVariant(s.availabilityStatus)}>{s.availabilityStatus}</Badge>
                        <p className="text-xs text-gray-450 font-semibold mt-1">WL: {s.currentWorkload} · {s.assignedPatients}P · {s.assignedOtCases}OT</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason (optional)</label>
                <input value={transferReason} onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Reason for reassignment..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setReassignOpen(false)} disabled={transferring}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">Cancel</button>
                <button type="button" onClick={handleTransfer} disabled={!selectedStaffId || transferring}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 disabled:opacity-50 active:scale-95 transition flex items-center gap-1.5 shadow-sm">
                  {transferring ? 'Transferring…' : <><MdSwapHoriz /> Confirm Transfer</>}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Change Shift Modal */}
      {shiftOpen && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => { if (!shiftUpdating) setShiftOpen(false); }}>
          <div className="pl-modal pl-modalAnimate max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdAccessTime className="text-white w-5 h-5" /> Change Shift
              </h3>
              <button onClick={() => setShiftOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Update shift for <strong>{selectedAlloc?.patientName}</strong>
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">New Shift</label>
                <select value={newShift} onChange={(e) => setNewShift(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
                  <option value="">Select shift</option>
                  <option value="MORNING">Morning</option>
                  <option value="EVENING">Evening</option>
                  <option value="NIGHT">Night</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Reason (optional)</label>
                <input value={shiftReason} onChange={(e) => setShiftReason(e.target.value)}
                  placeholder="Reason for shift change..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShiftOpen(false)} disabled={shiftUpdating}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-250 transition">Cancel</button>
                <button type="button" onClick={handleShiftChange} disabled={!newShift || shiftUpdating}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 disabled:opacity-50 active:scale-95 transition shadow-sm">
                  {shiftUpdating ? 'Updating…' : 'Update Shift'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmCompleteOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <MdWarning className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-[#001B48]">Complete Allocation</h3>
              <p className="text-sm font-semibold text-gray-500 leading-relaxed">
                Complete this allocation? Patient will be removed from nurse assignments.
              </p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <button
                type="button"
                onClick={() => setConfirmCompleteOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeComplete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 text-sm font-bold text-white transition shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
