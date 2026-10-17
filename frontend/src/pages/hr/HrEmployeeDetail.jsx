import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { MdPerson, MdArrowBack, MdEmail, MdPhone, MdBusinessCenter, MdCalendarToday, MdAssignment, MdMedicalServices, MdPeople, MdCheckCircle, MdWarning, MdBlock, MdCheck, MdHistory, MdRefresh, MdWork, MdStar, MdInfo, MdBadge, MdLocalHospital, MdClose } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import Pagination from '../../components/Pagination';
import ConfirmModal from '../../components/ConfirmModal';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const availabilityVariant = (s) => {
  if (s === 'Available') return 'green';
  if (s === 'Assigned') return 'blue';
  if (s === 'Busy') return 'red';
  return 'gray';
};
const workloadVariant = (s) => {
  if (s === 'Low') return 'green';
  if (s === 'Medium') return 'amber';
  if (s === 'High') return 'red';
  return 'gray';
};
export default function HrEmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [allocationPagination, setAllocationPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [dutyOpen, setDutyOpen] = useState(false);
  const [dutyWard, setDutyWard] = useState('');
  const [dutyShift, setDutyShift] = useState('');
  const [dutySubmitting, setDutySubmitting] = useState(false);
  const [currentDuties, setCurrentDuties] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    api.get('/receptionist/ipd/wards').then((r) => {
      const items = Array.isArray(r.data?.items) ? r.data.items : [];
      setWards(items.map((w) => ({ id: w.id, name: w.name, type: w.type })));
    }).catch(() => {});
  }, []);

  // Fetch duties when employee loads
  useEffect(() => {
    if (employee && employee.role === 'NURSE') {
      api.get('/hr/employees/' + id + '/duties').then((r) => setCurrentDuties(Array.isArray(r.data?.duties) ? r.data.duties : [])).catch(() => {});
    }
  }, [employee, id]);

  const fetchEmployee = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hr/employees/' + id);
      setEmployee(res.data?.employee || null);
    } catch {
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAllocations = useCallback(async (page = 1) => {
    try {
      const res = await api.get('/hr/employees/' + id + '/allocations', { params: { page, pageSize: 10 } });
      setAllocations(Array.isArray(res.data?.allocations) ? res.data.allocations : []);
      setAllocationPagination(res.data?.pagination || { page, totalPages: 1 });
    } catch {
      setAllocations([]);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployee();
    fetchAllocations(1);
  }, [fetchEmployee, fetchAllocations]);

  const handleToggleStatus = async () => {
    if (!employee) return;
    setStatusUpdating(true);
    try {
      await api.patch('/hr/employees/' + id + '/status', { isActive: !employee.isActive });
      setConfirmOpen(false);
      setConfirmAction(null);
      fetchEmployee();
    } catch {
      // ignore
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-6xl mx-auto text-center py-16 text-gray-400">Loading employee details…</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-6xl mx-auto text-center py-16 text-gray-400">Employee not found.</div>
      </div>
    );
  }

  const wl = employee.workload || {};
  const currentAssignment = employee.currentAssignment;

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdPerson className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">{employee.name}</h1>
              <p className="text-sm font-semibold text-gray-500">
                Employee Profile Registry — {employee.role} | {employee.department || 'No Department'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard/hr/employees')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all duration-200 shrink-0"
            >
              <MdArrowBack className="w-4.5 h-4.5" />
              Back
            </button>
            <button
              type="button"
              onClick={fetchEmployee}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0077B6] border border-blue-150 bg-blue-50/50 hover:bg-blue-50 active:scale-95 transition-all duration-200 shrink-0"
            >
              <MdRefresh className="w-4.5 h-4.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0077B6] flex items-center justify-center shrink-0 shadow-sm font-extrabold text-2xl">
              {employee.name ? employee.name.charAt(0).toUpperCase() : 'E'}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-start justify-between gap-4 flex-wrap border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#001B48]">{employee.name}</h2>
                  <p className="text-sm font-semibold text-gray-500 mt-0.5">{employee.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={availabilityVariant(employee.availabilityStatus)}>{employee.availabilityStatus}</Badge>
                  <Badge variant={employee.isActive === false ? 'gray' : 'green'}>{employee.isActive === false ? 'Inactive' : 'Active'}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdBadge className="w-3.5 h-3.5 text-[#0077B6]" /> Employee ID</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{employee.employeeId || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdBusinessCenter className="w-3.5 h-3.5 text-[#0077B6]" /> Role</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{employee.role || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdInfo className="w-3.5 h-3.5 text-[#0077B6]" /> Department</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{employee.department || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdPhone className="w-3.5 h-3.5 text-[#0077B6]" /> Phone</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{employee.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdCalendarToday className="w-3.5 h-3.5 text-[#0077B6]" /> Joined</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{formatDate(employee.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdCalendarToday className="w-3.5 h-3.5 text-[#0077B6]" /> Last Login</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{formatDateTime(employee.lastLogin)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdPerson className="w-3.5 h-3.5 text-[#0077B6]" /> Username</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{employee.username || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MdInfo className="w-3.5 h-3.5 text-[#0077B6]" /> Address</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{employee.address || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Workload & Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#001B48] mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                <MdWork className="text-[#0077B6] w-4.5 h-4.5" /> Workload Summary
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-600">Assigned Patients</span>
                  <span className="text-lg font-bold text-[#001B48]">{wl.assignedPatientsCount || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-600">OT Cases</span>
                  <span className="text-lg font-bold text-[#001B48]">{wl.assignedOtCasesCount || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-600">Total Active Assignments</span>
                  <span className="text-lg font-bold text-[#001B48]">{wl.totalActiveAssignments || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-semibold text-gray-600">Workload Status</span>
                  <Badge variant={workloadVariant(wl.workloadStatus)}>{wl.workloadStatus || 'Low'}</Badge>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#001B48] mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                <MdStar className="text-[#0077B6] w-4.5 h-4.5" /> Quick Actions
              </h3>
              <div className="space-y-2">
                {employee?.role === 'NURSE' && (
                  <button
                    type="button"
                    onClick={() => setDutyOpen(true)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0077B6] bg-blue-50/50 hover:bg-blue-55 active:scale-95 transition-all duration-200"
                  >
                    <MdLocalHospital className="w-4.5 h-4.5" />
                    Assign Duty / Ward
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { const el = document.getElementById('allocation-history'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-55/60 active:scale-95 transition-all duration-200"
                >
                  <MdHistory className="w-4.5 h-4.5" />
                  View Allocation History
                </button>
                <button
                  type="button"
                  onClick={() => { const el = document.getElementById('current-assignment'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-55/60 active:scale-95 transition-all duration-200"
                >
                  <MdAssignment className="w-4.5 h-4.5" />
                  View Current Assignments
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmAction('status'); setConfirmOpen(true); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all duration-200 ${
                    employee.isActive === false
                      ? 'text-green-700 bg-green-50 hover:bg-green-100'
                      : 'text-red-700 bg-red-50 hover:bg-red-100'
                  }`}
                >
                  {employee.isActive === false ? <MdCheckCircle className="w-4.5 h-4.5" /> : <MdBlock className="w-4.5 h-4.5" />}
                  {employee.isActive === false ? 'Activate User' : 'Deactivate User'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Current Assignments */}
          <div className="lg:col-span-2 space-y-6">
            <div id="current-assignment" className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#001B48] mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                <MdAssignment className="text-[#0077B6] w-4.5 h-4.5" /> Current Assignment
              </h3>
              {currentAssignment ? (
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={currentAssignment.type === 'Patient' ? 'blue' : 'purple'}>{currentAssignment.type}</Badge>
                    <span className="font-bold text-gray-900">{currentAssignment.label}</span>
                  </div>
                  {currentAssignment.detail && <p className="text-sm text-gray-600 font-semibold ml-1">{currentAssignment.detail}</p>}
                  {currentAssignment.subDetail && <p className="text-sm text-gray-500 ml-1 mt-0.5">{currentAssignment.subDetail}</p>}
                  {currentAssignment.ipdNumber && <p className="text-sm text-gray-400 font-mono mt-1.5 ml-1">IPD ID: {currentAssignment.ipdNumber}</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-3 text-center">No current assignment.</p>
              )}
            </div>

            {/* Active Admissions */}
            {employee.activeAdmissions && employee.activeAdmissions.length > 0 && (
              <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm overflow-hidden">
                <h3 className="text-sm font-extrabold text-[#001B48] mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <MdPeople className="text-[#0077B6] w-4.5 h-4.5" /> Assigned Patients ({employee.activeAdmissions.length})
                </h3>
                <div className="overflow-x-auto -mx-5">
                  <div className="inline-block min-w-full align-middle px-5">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <thead>
                        <tr className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                          <th className="text-left px-3 py-2.5">Patient</th>
                          <th className="text-left px-3 py-2.5">UHID</th>
                          <th className="text-left px-3 py-2.5">Ward</th>
                          <th className="text-left px-3 py-2.5">Bed</th>
                          <th className="text-left px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {employee.activeAdmissions.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50/50 transition">
                            <td className="px-3 py-3 font-semibold text-[#001B48]">{a.patient?.name || '—'}</td>
                            <td className="px-3 py-3 font-mono text-xs text-gray-500">{a.patient?.uhid || '—'}</td>
                            <td className="px-3 py-3 text-gray-600 font-medium">{a.ward?.name || '—'}</td>
                            <td className="px-3 py-3 text-gray-600 font-semibold">{a.bed?.code || '—'}</td>
                            <td className="px-3 py-3"><Badge variant="blue">{a.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Active OT Cases */}
            {employee.activeOtCases && employee.activeOtCases.length > 0 && (
              <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm overflow-hidden">
                <h3 className="text-sm font-extrabold text-[#001B48] mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <MdMedicalServices className="text-[#0077B6] w-4.5 h-4.5" /> Assigned OT Cases ({employee.activeOtCases.length})
                </h3>
                <div className="overflow-x-auto -mx-5">
                  <div className="inline-block min-w-full align-middle px-5">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <thead>
                        <tr className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                          <th className="text-left px-3 py-2.5">OT #</th>
                          <th className="text-left px-3 py-2.5">Surgery</th>
                          <th className="text-left px-3 py-2.5">Room</th>
                          <th className="text-left px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {employee.activeOtCases.map((o) => (
                          <tr key={o.id} className="hover:bg-gray-50/50 transition">
                            <td className="px-3 py-3 font-mono text-xs font-bold text-gray-500">{o.otRequest?.requestNumber || '—'}</td>
                            <td className="px-3 py-3 font-semibold text-[#001B48]">{o.otRequest?.surgeryRecommendation || '—'}</td>
                            <td className="px-3 py-3 text-gray-600 font-semibold">{o.otRoom?.roomName || '—'}</td>
                            <td className="px-3 py-3"><Badge variant="purple">{o.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Allocation History */}
        <div id="allocation-history" className="border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-extrabold text-[#001B48] flex items-center gap-2">
              <MdHistory className="text-[#0077B6] w-4.5 h-4.5" /> Allocation History
            </p>
            <p className="text-xs font-bold text-gray-400">Page {allocationPagination.page} of {allocationPagination.totalPages}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Type</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Patient / OT Case</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Ward / Room</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Assigned By</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allocations.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-gray-400 text-center">No allocation history found.</td></tr>
                ) : (
                  allocations.map((al, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition">
                      <td className="px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">{formatDateTime(al.date)}</td>
                      <td className="px-4 py-3"><Badge variant={al.type?.includes('OT') ? 'purple' : 'blue'}>{al.type}</Badge></td>
                      <td className="px-4 py-3">
                        {al.patient ? (
                          <div>
                            <span className="font-semibold text-[#001B48]">{al.patient}</span>
                            <br />
                            <span className="text-xs text-gray-400 font-mono">{al.uhid}</span>
                          </div>
                        ) : al.otCase ? (
                          <div>
                            <span className="font-semibold text-[#001B48]">{al.otCase}</span>
                            <br />
                            <span className="text-xs text-gray-400">{al.surgery}</span>
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{al.ward || al.otRoom || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{al.assignedBy || '—'}</td>
                      <td className="px-4 py-3"><Badge variant={al.status === 'ACTIVE' || al.status === 'SCHEDULED' ? 'green' : 'gray'}>{al.status}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination page={allocationPagination.page} totalPages={allocationPagination.totalPages} onPageChange={fetchAllocations} />
          </div>
        </div>
      </div>

      {/* Assign Duty Modal */}
      {dutyOpen && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => { if (!dutySubmitting) setDutyOpen(false); }}>
          <div className="pl-modal pl-modalAnimate max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdLocalHospital className="text-blue-200" /> Assign Duty — {employee?.name}
              </h3>
              <button onClick={() => setDutyOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Current Duties */}
              {currentDuties.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Current Duty Assignments</h4>
                  <div className="space-y-1.5">
                    {currentDuties.map((d) => (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs">
                        <div>
                          <span className="font-bold text-gray-700">{d.wardName}</span>
                          <span className="text-gray-500 font-semibold ml-2">({d.shift?.replace(/_/g, ' ')})</span>
                          <span className="text-gray-400 ml-2">{new Date(d.dutyDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.delete('/hr/employees/' + id + '/duties/' + d.id);
                              const r = await api.get('/hr/employees/' + id + '/duties');
                              setCurrentDuties(Array.isArray(r.data?.duties) ? r.data.duties : []);
                            } catch {}
                          }}
                          className="text-red-500 hover:text-red-700 transition"
                        >
                          <MdClose className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Ward</label>
                  <select
                    value={dutyWard}
                    onChange={(e) => setDutyWard(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  >
                    <option value="">Select ward</option>
                    {wards.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.type || 'General'})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Shift</label>
                  <select
                    value={dutyShift}
                    onChange={(e) => setDutyShift(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  >
                    <option value="">Select shift</option>
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                    <option value="NIGHT">Night</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDutyOpen(false)}
                  disabled={dutySubmitting}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!dutyWard || !dutyShift) return;
                    setDutySubmitting(true);
                    try {
                      const w = wards.find((x) => x.id === dutyWard);
                      await api.post('/hr/employees/' + id + '/duty', { wardId: dutyWard, wardName: w?.name || dutyWard, shift: dutyShift });
                      setDutyWard('');
                      setDutyShift('');
                      const r = await api.get('/hr/employees/' + id + '/duties');
                      setCurrentDuties(Array.isArray(r.data?.duties) ? r.data.duties : []);
                    } catch {}
                    finally { setDutySubmitting(false); }
                  }}
                  disabled={!dutyWard || !dutyShift || dutySubmitting}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 disabled:opacity-50 active:scale-95 transition"
                >
                  {dutySubmitting ? 'Assigning…' : 'Assign Duty'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        open={confirmOpen}
        title={employee.isActive === false ? 'Activate Employee' : 'Deactivate Employee'}
        message={`Are you sure you want to ${employee.isActive === false ? 'activate' : 'deactivate'} ${employee.name}?`}
        confirmText={employee.isActive === false ? 'Activate' : 'Deactivate'}
        cancelText="Cancel"
        confirmVariant={employee.isActive === false ? 'primary' : 'danger'}
        onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
        onConfirm={handleToggleStatus}
      />
    </div>
  );
}
