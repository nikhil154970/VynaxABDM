import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MdBusiness, MdPeople, MdSearch, MdPerson, MdStar, MdRefresh,
  MdVisibility, MdCheckCircle, MdWarning, MdClose, MdWork,
  MdAssignment, MdGroup, MdAdd, MdMedicalServices, MdLocalHospital,
  MdScience, MdLocalPharmacy, MdBadge
} from 'react-icons/md';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import '../ot/SurgeryScheduling.css';

const availabilityVariant = (s) => {
  if (s === 'Available') return 'green';
  if (s === 'Assigned') return 'blue';
  if (s === 'Busy') return 'red';
  return 'gray';
};

const DEPT_STYLE = {
  Administration: { Icon: MdBusiness,        color: '#3b82f6', bg: '#eff6ff' },
  Reception:      { Icon: MdPeople,          color: '#0ea5e9', bg: '#f0f9ff' },
  Doctor:         { Icon: MdMedicalServices,  color: '#10b981', bg: '#f0fdf4' },
  Nurse:          { Icon: MdLocalHospital,   color: '#f97316', bg: '#fff7ed' },
  OT:             { Icon: MdLocalHospital,   color: '#ef4444', bg: '#fef2f2' },
  Laboratory:     { Icon: MdScience,         color: '#8b5cf6', bg: '#fdf4ff' },
  Pharmacy:       { Icon: MdLocalPharmacy,   color: '#22c55e', bg: '#f0fdf4' },
  HR:             { Icon: MdBadge,           color: '#f59e0b', bg: '#fffbeb' },
  Unassigned:     { Icon: MdWarning,         color: '#64748B', bg: '#f1f5f9' },
};

function AssignDeptDropdown({ employeeId, employeeName, allDepartments, onAssigned, currentDept }) {
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedDept, setSelectedDept] = useState(currentDept || '');
  const [assignErr, setAssignErr] = useState('');

  const handleAssign = async () => {
    if (!selectedDept || selectedDept === currentDept) return;
    setAssigning(true);
    setAssignErr('');
    try {
      const deptValue = selectedDept === '__unassigned__' ? '' : selectedDept;
      await api.patch(`/hr/employees/${employeeId}/department`, { department: deptValue });
      setOpen(false);
      onAssigned();
    } catch {
      setAssignErr('Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="relative">
      {open ? (
        <div className="flex items-center gap-1">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-gray-200 px-2 py-1 w-32 bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
          >
            <option value="__unassigned__">Unassigned</option>
            {allDepartments.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          <button
            onClick={handleAssign}
            disabled={assigning || selectedDept === currentDept}
            className="text-xs px-2.5 py-1 rounded-lg bg-[#0077B6] text-white hover:bg-[#0077B6]/90 disabled:opacity-50 font-bold active:scale-95 transition"
          >
            {assigning ? '...' : 'Save'}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold active:scale-95 transition"
          >
            Cancel
          </button>
          {assignErr && <span className="text-xs font-semibold text-red-500 ml-1">{assignErr}</span>}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs font-bold text-[#0077B6] border border-blue-100 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 rounded-lg active:scale-95 transition"
        >
          {currentDept ? <MdAssignment className="w-3.5 h-3.5" /> : <MdAdd className="w-3.5 h-3.5" />}
          {currentDept ? 'Transfer' : 'Assign'}
        </button>
      )}
    </div>
  );
}

export default function HrDepartments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedDept, setSelectedDept] = useState(null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [headModalOpen, setHeadModalOpen] = useState(false);
  const [headSearch, setHeadSearch] = useState('');
  const [employeeList, setEmployeeList] = useState([]);
  const [headUpdating, setHeadUpdating] = useState(false);
  const [allDepartments, setAllDepartments] = useState([]);

  useEffect(() => {
    setLoading(true);
    api.get('/hr/departments')
      .then((res) => {
        console.log('[HrDept] API response:', res.data);
        const depts = Array.isArray(res.data?.departments) ? res.data.departments : [];
        setDepartments(depts);
        setAllDepartments(depts.filter((d) => !d.isUnassigned && d.name !== 'IPD' && d.name !== 'OPD'));
        setSummary(res.data?.summary || null);
      })
      .catch(() => {
        setDepartments([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = departments.filter((d) => {
    if (search && d.name && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'active' && d.isActive === false) return false;
    if (statusFilter === 'inactive' && d.isActive !== false) return false;
    return true;
  });

  const statCards = summary ? [
    { label: 'Total Departments', value: summary.totalDepartments, icon: MdBusiness, color: 'blue' },
    { label: 'Total Employees', value: summary.totalEmployees, icon: MdPeople, color: 'purple' },
    { label: 'Unassigned Staff', value: summary.unassignedStaff, icon: MdWarning, color: 'amber' },
    { label: 'Assigned Staff', value: summary.assignedStaff, icon: MdAssignment, color: 'indigo' },
  ] : [];

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdBusiness className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Department Management</h1>
              <p className="text-sm font-semibold text-gray-500">
                Organizational structure — manage departments, assign department heads, and track staff allocations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0077B6] border border-blue-150 bg-blue-50/50 hover:bg-blue-50 active:scale-95 transition-all duration-200 shrink-0 self-start sm:self-auto"
          >
            <MdRefresh className="w-4.5 h-4.5" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    background: s.color === 'blue' ? '#eff6ff' : s.color === 'purple' ? '#faf5ff' : s.color === 'green' ? '#f0fdf4' : '#eef2ff',
                    color: s.color === 'blue' ? '#0077B6' : s.color === 'purple' ? '#9333ea' : s.color === 'green' ? '#16a34a' : '#4f46e5'
                  }}
                >
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

        {/* Search & Filter */}
        <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <MdSearch className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search department by name..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Department Table */}
        <div className="border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-extrabold text-[#001B48]">All Departments</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="text-left px-4 py-3">Department</th>
                  <th className="text-left px-4 py-3">Head</th>
                  <th className="text-center px-4 py-3">Total Staff</th>
                  <th className="text-center px-4 py-3">Available</th>
                  <th className="text-center px-4 py-3">Assigned</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-8 text-gray-400 text-center font-medium" colSpan={6}>Loading departments…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="px-4 py-8 text-gray-400 text-center font-medium" colSpan={6}>No departments found.</td></tr>
                ) : (
                  filtered.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-gray-50/60 cursor-pointer transition"
                      onClick={() => {
                        setSelectedDept(d);
                        setDetailLoading(true);
                        api.get('/hr/departments/' + encodeURIComponent(d.name))
                          .then((res) => setDeptDetail(res.data?.department || null))
                          .catch(() => setDeptDetail(null))
                          .finally(() => setDetailLoading(false));
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const style = DEPT_STYLE[d.name] || DEPT_STYLE.Unassigned;
                            const DeptIcon = style.Icon;
                            return (
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: style.bg }}>
                                <DeptIcon className="w-5 h-5" style={{ color: style.color }} />
                              </div>
                            );
                          })()}
                          <div>
                            <p className="font-bold text-[#001B48]">{d.name}</p>
                            {d.description && <p className="text-xs text-gray-400 font-semibold mt-0.5">{d.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {d.head ? (
                          <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                            <MdPerson className="w-4 h-4 text-amber-500" />
                            <span>{d.head.name}</span>
                          </div>
                        ) : <span className="text-xs text-gray-400 font-bold">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-gray-700">{d.totalStaff}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-green-600">{d.availableStaff}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-blue-600">{d.assignedStaff}</td>
                      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDept(d);
                            setDetailLoading(true);
                            api.get('/hr/departments/' + encodeURIComponent(d.name))
                              .then((res) => setDeptDetail(res.data?.department || null))
                              .catch(() => setDeptDetail(null))
                              .finally(() => setDetailLoading(false));
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#0077B6] bg-blue-50 border border-transparent hover:border-[#0077B6]/30 hover:bg-sky-50 active:bg-sky-100 transition-all duration-200 cursor-pointer shadow-sm mx-auto"
                          title="View Details"
                        >
                          <MdVisibility className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedDept && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedDept(null)}>
          <div className="pl-modal pl-modalAnimate max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#ffffff' }}>
                <MdBusiness className="text-blue-200" style={{ color: '#bae6fd' }} /> {selectedDept.name} Department Details
              </h3>
              <button type="button" onClick={() => setSelectedDept(null)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[calc(90vh-80px)] overflow-y-auto">
              {detailLoading ? (
                <div className="text-center py-8 text-gray-400 font-bold">Loading department details…</div>
              ) : deptDetail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{deptDetail.description || 'No description provided.'}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Department Head</p>
                      <p className="text-sm font-bold text-gray-800 mt-1 flex items-center gap-1.5">
                        {deptDetail.head ? (
                          <span className="flex items-center gap-1.5 font-bold text-[#001B48]">
                            <MdStar className="text-amber-500 w-4.5 h-4.5" />
                            {deptDetail.head.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium italic">No head assigned</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-150 p-3 text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Staff</p>
                      <p className="text-xl font-extrabold text-[#001B48] mt-1">{deptDetail.totalStaff}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-150 p-3 text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Available</p>
                      <p className="text-xl font-extrabold text-green-600 mt-1">{deptDetail.availableStaff}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-150 p-3 text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned</p>
                      <p className="text-xl font-extrabold text-blue-600 mt-1">{deptDetail.assignedStaff}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-150 p-3 text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">DR / NURSE / TECH</p>
                      <p className="text-base font-extrabold text-[#001B48] mt-2">
                        {deptDetail.roleCounts?.doctors || 0} / {deptDetail.roleCounts?.nurses || 0} / {deptDetail.roleCounts?.technicians || 0}
                      </p>
                    </div>
                  </div>

                  {deptDetail.workload && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <MdWork className="text-[#0077B6] w-4.5 h-4.5" /> Department Workload Log
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-400">Active Patients</p>
                          <p className="text-base font-bold text-[#001B48] mt-0.5">{deptDetail.workload.totalActivePatients}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400">Assigned Staff</p>
                          <p className="text-base font-bold text-[#001B48] mt-0.5">{deptDetail.workload.totalAssignedStaff}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400">Active OT Cases</p>
                          <p className="text-base font-bold text-[#001B48] mt-0.5">{deptDetail.workload.activeOtCases}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400">Workload Index</p>
                          <div className="mt-1">
                            <Badge variant={deptDetail.workload.currentWorkload === 'High' ? 'red' : deptDetail.workload.currentWorkload === 'Medium' ? 'amber' : 'green'}>{deptDetail.workload.currentWorkload}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-extrabold text-[#001B48] mb-3 flex items-center gap-2">
                      <MdGroup className="text-[#0077B6] w-4.5 h-4.5" /> Staff Roster ({deptDetail.staffList?.length || 0})
                    </h4>
                    {deptDetail.staffList?.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-gray-150">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                            <tr>
                              <th className="text-left px-3 py-2">Name</th>
                              <th className="text-left px-3 py-2">Role</th>
                              <th className="text-left px-3 py-2">Availability</th>
                              <th className="text-left px-3 py-2">Department</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {deptDetail.staffList.map((s) => (
                              <tr key={s.id} className="hover:bg-gray-50/40 transition">
                                <td className="px-3 py-3 font-semibold text-[#001B48]">{s.name}</td>
                                <td className="px-3 py-3"><Badge variant={s.role?.toLowerCase().includes('doctor') ? 'purple' : s.role?.toLowerCase().includes('nurse') ? 'emerald' : 'gray'}>{s.role}</Badge></td>
                                <td className="px-3 py-3"><Badge variant={availabilityVariant(s.availabilityStatus)}>{s.availabilityStatus}</Badge></td>
                                <td className="px-3 py-3 text-xs font-bold text-gray-500">{s.department || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-gray-400 py-2">No staff assigned to this department.</p>
                    )}
                  </div>

                </>
              ) : (
                <div className="text-center py-8 text-gray-400 font-bold">Could not load details.</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Head Modal */}
      {headModalOpen && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => { if (!headUpdating) setHeadModalOpen(false); }}>
          <div className="pl-modal pl-modalAnimate max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdStar className="text-amber-300 w-4.5 h-4.5" /> Assign Head
              </h3>
              <button onClick={() => setHeadModalOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Assign head for <span className="text-[#0077B6]">{selectedDept?.name}</span>
              </p>
              <div className="relative">
                <MdSearch className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
                <input
                  value={headSearch}
                  onChange={(e) => setHeadSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full pl-11 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                />
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-150">
                {employeeList.filter((e) => e.name.toLowerCase().includes(headSearch.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 font-bold">No employees found.</p>
                ) : (
                  employeeList.filter((e) => e.name.toLowerCase().includes(headSearch.toLowerCase())).map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0077B6] flex items-center justify-center text-xs font-bold shrink-0">
                          {e.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{e.name}</p>
                          <p className="text-xs font-semibold text-gray-400">{e.role}{e.employeeId ? ' (' + e.employeeId + ')' : ''}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setHeadUpdating(true);
                          api.patch('/hr/departments/' + encodeURIComponent(selectedDept.name) + '/head', { userId: e.id })
                            .then(() => {
                              setHeadModalOpen(false);
                              setHeadUpdating(false);
                              api.get('/hr/departments/' + encodeURIComponent(selectedDept.name)).then((r) => setDeptDetail(r.data?.department || null));
                              api.get('/hr/departments').then((r) => setDepartments(Array.isArray(r.data?.departments) ? r.data.departments : []));
                            })
                            .catch(() => setHeadUpdating(false));
                        }}
                        disabled={headUpdating}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 disabled:opacity-50 active:scale-95 transition"
                      >
                        {headUpdating ? '...' : 'Assign'}
                      </button>
                    </div>
                  ))
                )}
              </div>
              {deptDetail?.head && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Current Head</p>
                    <div className="flex items-center gap-1.5 mt-1 font-bold text-gray-700 text-sm">
                      <MdPerson className="w-4 h-4 text-amber-500" />
                      <span>{deptDetail.head.name}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHeadUpdating(true);
                      api.patch('/hr/departments/' + encodeURIComponent(selectedDept.name) + '/head', { userId: null })
                        .then(() => {
                          setHeadModalOpen(false);
                          setHeadUpdating(false);
                          api.get('/hr/departments/' + encodeURIComponent(selectedDept.name)).then((r) => setDeptDetail(r.data?.department || null));
                          api.get('/hr/departments').then((r) => setDepartments(Array.isArray(r.data?.departments) ? r.data.departments : []));
                        })
                        .catch(() => setHeadUpdating(false));
                    }}
                    disabled={headUpdating}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 active:scale-95 transition"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
