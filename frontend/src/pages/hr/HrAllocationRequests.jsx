import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { MdAssignment, MdPeople, MdCheckCircle, MdCancel, MdWarning, MdSearch, MdBusiness, MdPerson, MdStar, MdClose, MdWork, MdSchedule, MdHistory, MdDescription, MdLocalHospital, MdMedicalServices, MdRefresh, MdVisibility, MdThumbUp, MdThumbDown, MdSwapHoriz } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import '../ot/SurgeryScheduling.css';

const priorityVariant = (p) => {
  if (p === 'CRITICAL') return 'rose';
  if (p === 'HIGH') return 'amber';
  if (p === 'MEDIUM') return 'blue';
  return 'gray';
};

const statusVariant = (s) => {
  if (s === 'PENDING') return 'amber';
  if (s === 'APPROVED') return 'green';
  if (s === 'REJECTED') return 'red';
  return 'gray';
};

const availabilityVariant = (s) => {
  if (s === 'Available') return 'green';
  if (s === 'Assigned') return 'blue';
  if (s === 'Busy') return 'red';
  return 'gray';
};

export default function HrAllocationRequests() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page'), 10) || 1);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignShift, setAssignShift] = useState('');
  const [assignRemarks, setAssignRemarks] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize: 20 };
      if (search) params.search = search;
      if (sourceFilter) params.source = sourceFilter;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await api.get('/hr/allocation-requests', { params });
      setRequests(Array.isArray(res.data?.requests) ? res.data.requests : []);
      setSummary(res.data?.summary || null);
      setPagination(res.data?.pagination || null);
    } catch (e) {
      console.error('Fetch allocation requests error:', e);
      setError(e.response?.data?.message || 'Failed to load requests');
      setRequests([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, sourceFilter, statusFilter, priorityFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    if (sourceFilter) sp.set('source', sourceFilter);
    if (statusFilter) sp.set('status', statusFilter);
    if (priorityFilter) sp.set('priority', priorityFilter);
    if (page > 1) sp.set('page', String(page));
    setSearchParams(sp, { replace: true });
  }, [search, sourceFilter, statusFilter, priorityFilter, page, setSearchParams]);

  const openDetail = async (r) => {
    setSelectedRequest(r);
    setDetailLoading(true);
    setRequestDetail(null);
    try {
      const res = await api.get('/hr/allocation-requests/' + r.id);
      setRequestDetail(res.data?.request || null);
    } catch (e) {
      console.error('Fetch allocation detail error:', e);
      setError(e.response?.data?.message || 'Failed to load detail');
      setRequestDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (assignStaff) => {
    setApproving(true);
    try {
      await api.patch('/hr/allocation-requests/' + selectedRequest.id + '/approve', {
        assignedToId: assignStaff || null,
        remarks: assignRemarks || null,
      });
      setAssignModalOpen(false);
      setSelectedRequest(null);
      setRequestDetail(null);
      fetchRequests();
    } catch (e) { console.error('Allocation request error:', e); setError(e.response?.data?.message || 'Something went wrong'); } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    setRejecting(true);
    try {
      await api.patch('/hr/allocation-requests/' + selectedRequest.id + '/reject', { reason: rejectionReason });
      setRejectModalOpen(false);
      setRejectionReason('');
      setSelectedRequest(null);
      setRequestDetail(null);
      fetchRequests();
    } catch (e) { console.error('Allocation request error:', e); setError(e.response?.data?.message || 'Something went wrong'); } finally {
      setRejecting(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedStaffId) return;
    setAssigning(true);
    try {
      await api.patch('/hr/allocation-requests/' + selectedRequest.id + '/assign', {
        assignedToId: selectedStaffId,
        shift: assignShift || null,
        remarks: assignRemarks || null,
      });
      setAssignModalOpen(false);
      setSelectedStaffId('');
      setAssignShift('');
      setAssignRemarks('');
      setSelectedRequest(null);
      setRequestDetail(null);
      fetchRequests();
    } catch (e) { console.error('Allocation request error:', e); setError(e.response?.data?.message || 'Something went wrong'); } finally {
      setAssigning(false);
    }
  };

  const fetchAvailableStaff = async (shiftOverride) => {
    if (!selectedRequest) return;
    setStaffLoading(true);
    try {
      const params = {
        staffType: selectedRequest?.requestedStaffType,
        shift: shiftOverride || undefined,
      };
      const res = await api.get('/hr/allocation-requests/available-staff', { params });
      setAvailableStaff(Array.isArray(res.data?.staff) ? res.data.staff : []);
    } catch (e) {
      console.error('Fetch available staff error:', e);
      setError((e.response?.data?.message || e.message || 'Failed to load available staff') + (e.response?.status ? ` (${e.response.status})` : ''));
      setAvailableStaff([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const openAssignModal = async () => {
    setAssignModalOpen(true);
    setSelectedStaffId('');
    setAssignShift('');
    setAssignRemarks('');
    await fetchAvailableStaff('');
  };

  // Re-fetch staff when shift filter changes
  useEffect(() => {
    if (assignModalOpen) fetchAvailableStaff(assignShift);
  }, [assignShift, assignModalOpen]);

  const statCards = summary ? [
    { label: 'Total Requests', value: summary.total, icon: MdAssignment, color: 'gray' },
    { label: 'Pending', value: summary.pending, icon: MdSchedule, color: 'amber' },
    { label: 'Approved', value: summary.approved, icon: MdCheckCircle, color: 'green' },
    { label: 'Rejected', value: summary.rejected, icon: MdCancel, color: 'red' },
    { label: 'Critical', value: summary.critical, icon: MdWarning, color: 'rose' },
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
              <h1 className="text-2xl font-bold text-[#001B48]">Allocation Requests</h1>
              <p className="text-sm text-gray-500 mt-1">Review and process staff allocation requests from all modules.</p>
            </div>
          </div>
          <button type="button" onClick={fetchRequests}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 active:scale-95 transition shadow-sm flex items-center gap-2">
            <MdRefresh className="w-4.5 h-4.5" /> Refresh
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center justify-between">
            <span className="font-semibold">{error}</span>
            <button type="button" onClick={() => setError('')} className="text-red-450 hover:text-red-655 transition"><MdClose className="w-4 h-4" /></button>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    background: s.color === 'amber' ? '#fffbeb' : s.color === 'green' ? '#f0fdf4' : s.color === 'red' ? '#fef2f2' : s.color === 'rose' ? '#fff1f2' : '#f8fafc',
                    color: s.color === 'amber' ? '#d97706' : s.color === 'green' ? '#16a34a' : s.color === 'red' ? '#dc2626' : s.color === 'rose' ? '#e11d48' : '#64748b',
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
                placeholder="Search by Request ID / Patient / UHID..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
            </div>
            <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
              <option value="">All Sources</option>
              <option value="IPD">IPD</option>
              <option value="OT">OT</option>
              <option value="RECOVERY">Recovery</option>
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
              <option value="">All Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="text-left px-4 py-3">Request ID</th>
                  <th className="text-left px-4 py-3">Patient</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Staff Type</th>
                  <th className="text-center px-4 py-3">Priority</th>
                  <th className="text-left px-4 py-3">Requested By</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Assigned Staff</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-8 text-gray-450 text-center font-semibold" colSpan={10}>Loading requests…</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td className="px-4 py-8 text-gray-455 text-center font-semibold" colSpan={10}>No allocation requests found.</td></tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/60 cursor-pointer transition" onClick={() => openDetail(r)}>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-bold text-[#0077B6]">{r.requestNumber}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-bold text-[#001B48]">{r.patientName}</p>
                          <p className="text-xs text-gray-450 font-semibold mt-0.5">{r.uhid}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={r.sourceModule === 'OT' ? 'purple' : r.sourceModule === 'IPD' ? 'blue' : 'green'}>{r.sourceModule}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-600">{r.requestedStaffType.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3.5 text-center"><Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge></td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-600">{r.requestedByName}</td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-gray-500">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                          {((typeof r.remarks === 'string' && r.remarks.includes('NIGHT_RECEPTION')) || (typeof r.remarks === 'object' && r.remarks?.assignedBy === 'NIGHT_RECEPTION')) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold bg-[#0077B6]/10 text-[#0077B6] border border-[#0077B6]/20">
                              Night Reception
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-700">{r.assignedToName || <span className="text-gray-400 font-normal">—</span>}</td>
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openDetail(r)}
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
      {selectedRequest && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedRequest(null)}>
          <div className="pl-modal pl-modalAnimate max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdAssignment className="text-white w-5 h-5" /> Request: {selectedRequest.requestNumber}
              </h3>
              <button type="button" onClick={() => setSelectedRequest(null)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {detailLoading ? (
                <div className="text-center py-8 text-gray-400 font-bold">Loading details…</div>
              ) : requestDetail ? (
                <>
                  {/* Patient Info */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdLocalHospital className="text-[#0077B6] w-4.5 h-4.5" /> Patient Information</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Patient Name</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{requestDetail.patient?.name || requestDetail.patientName}</p></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">UHID</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{requestDetail.uhid}</p></div>
                      {requestDetail.patient?.gender && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Gender</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.patient.gender}</p></div>}
                      {requestDetail.patient?.age && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Age</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.patient.age}</p></div>}
                    </div>
                  </div>

                  {/* Source Info */}
                  <div className="bg-white rounded-2xl border border-gray-150 p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdBusiness className="text-[#0077B6] w-4.5 h-4.5" /> Source Details</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Source Module</p><div className="mt-1"><Badge variant={requestDetail.sourceModule === 'OT' ? 'purple' : requestDetail.sourceModule === 'IPD' ? 'blue' : 'green'}>{requestDetail.sourceModule}</Badge></div></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Department</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.department || '—'}</p></div>
                      {requestDetail.admission?.ipdNumber && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">IPD Number</p><p className="text-sm font-mono font-bold text-gray-700 mt-1">{requestDetail.admission.ipdNumber}</p></div>}
                      {requestDetail.admission?.ward?.name && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ward</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.admission.ward.name}</p></div>}
                      {requestDetail.admission?.bed?.code && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bed</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.admission.bed.code}</p></div>}
                      {requestDetail.admission?.clinicalCondition && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Condition</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.admission.clinicalCondition}</p></div>}
                      {requestDetail.otRequest?.surgeryRecommendation && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Surgery</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.otRequest.surgeryRecommendation}</p></div>}
                    </div>
                  </div>

                  {/* Request Details */}
                  <div className="bg-white rounded-2xl border border-gray-150 p-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdDescription className="text-amber-600 w-4.5 h-4.5" /> Request Details</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Staff Type</p><p className="text-sm font-extrabold text-[#001B48] mt-1">{requestDetail.requestedStaffType.replace(/_/g, ' ')}</p></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Priority</p><div className="mt-1"><Badge variant={priorityVariant(requestDetail.priority)}>{requestDetail.priority}</Badge></div></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Required Shift</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.requiredShift || '—'}</p></div>
                      <div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Status</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant={statusVariant(requestDetail.status)}>{requestDetail.status}</Badge>
                          {((typeof requestDetail.remarks === 'string' && requestDetail.remarks.includes('NIGHT_RECEPTION')) || (typeof requestDetail.remarks === 'object' && requestDetail.remarks?.assignedBy === 'NIGHT_RECEPTION')) ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold bg-[#0077B6]/10 text-[#0077B6] border border-[#0077B6]/20">
                              Night Reception
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {requestDetail.reason && <div className="col-span-2"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Reason</p><p className="text-sm font-medium text-gray-655 mt-1">{requestDetail.reason}</p></div>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Requested By</p><p className="text-sm font-semibold text-gray-700 mt-1">{requestDetail.requestedByName}</p></div>
                      <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Request Date</p><p className="text-sm font-semibold text-gray-700 mt-1">{new Date(requestDetail.createdAt).toLocaleString('en-IN')}</p></div>
                      {requestDetail.assignedToName && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Assigned To</p><p className="text-sm font-extrabold text-green-700 mt-1">{requestDetail.assignedToName}</p></div>}
                      {requestDetail.approvedByName && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Approved By</p><p className="text-sm font-semibold text-gray-700 mt-1">{requestDetail.approvedByName}</p></div>}
                      {requestDetail.rejectedByName && <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Rejected By</p><p className="text-sm font-semibold text-gray-700 mt-1">{requestDetail.rejectedByName}</p></div>}
                      {requestDetail.rejectionReason && <div className="col-span-2"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Rejection Reason</p><p className="text-sm font-bold text-red-655 mt-1">{requestDetail.rejectionReason}</p></div>}
                    </div>
                  </div>

                  {/* Available Staff (for PENDING requests) */}
                  {requestDetail.status === 'PENDING' && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdPeople className="text-[#0077B6] w-4.5 h-4.5" /> Actions</h4>
                      <div className="flex flex-wrap gap-2.5">
                        <button type="button" onClick={() => { openAssignModal(); }}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition shadow-sm active:scale-95">
                          <MdThumbUp className="w-4 h-4" /> Approve & Assign
                        </button>
                        <button type="button" onClick={() => handleApprove(null)}
                          disabled={approving}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-[#0077B6] border border-blue-100 hover:bg-blue-100 transition shadow-sm disabled:opacity-50 active:scale-95">
                          <MdCheckCircle className="w-4 h-4" /> {approving ? 'Processing…' : 'Approve (No Staff)'}
                        </button>
                        <button type="button" onClick={() => setRejectModalOpen(true)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 transition shadow-sm active:scale-95">
                          <MdThumbDown className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Assigned Staff Info */}
                  {requestDetail.assignedToName && (
                    <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdPerson className="text-green-700 w-4.5 h-4.5" /> Assigned Staff</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Employee</p><p className="text-sm font-bold text-gray-900 mt-1">{requestDetail.assignedToName}</p></div>
                        <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Assigned By</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.assignedByName || '—'}</p></div>
                        <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Date</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.assignedAt ? new Date(requestDetail.assignedAt).toLocaleString('en-IN') : '—'}</p></div>
                        <div><p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Remarks</p><p className="text-sm font-bold text-gray-700 mt-1">{requestDetail.remarks || '—'}</p></div>
                      </div>
                      {requestDetail.status === 'APPROVED' && (
                        <button type="button" onClick={() => { openAssignModal(); }}
                          className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition active:scale-95">
                          <MdSwapHoriz className="w-4 h-4" /> Reassign Staff
                        </button>
                      )}
                    </div>
                  )}

                  {/* Allocation History */}
                  {requestDetail.history?.length > 0 && (
                    <div className="bg-white border border-gray-150 rounded-2xl p-5">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5"><MdHistory className="text-purple-600 w-4.5 h-4.5" /> Allocation History</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {requestDetail.history.map((h) => (
                          <div key={h.id} className="flex items-start gap-3 text-xs bg-slate-50 border border-slate-100 rounded-xl p-3">
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                              style={{
                                background: h.action === 'REQUEST_CREATED' ? '#eff6ff' : h.action === 'REQUEST_APPROVED' ? '#f0fdf4' : h.action === 'REQUEST_REJECTED' ? '#fef2f2' : '#fffbeb',
                                color: h.action === 'REQUEST_CREATED' ? '#0077B6' : h.action === 'REQUEST_APPROVED' ? '#16a34a' : h.action === 'REQUEST_REJECTED' ? '#dc2626' : '#d97706',
                              }}>
                              {h.action === 'REQUEST_CREATED' ? <MdAssignment className="w-3.5 h-3.5" /> : h.action === 'REQUEST_APPROVED' ? <MdCheckCircle className="w-3.5 h-3.5" /> : h.action === 'REQUEST_REJECTED' ? <MdCancel className="w-3.5 h-3.5" /> : <MdSwapHoriz className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800">{h.action.replace(/_/g, ' ')}</p>
                              <p className="text-gray-400 font-semibold mt-0.5">by {h.userName} — {new Date(h.createdAt).toLocaleString('en-IN')}</p>
                              {h.details && <p className="text-gray-500 font-semibold mt-1 bg-white border border-gray-100 rounded-lg p-2">{h.details}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : <div className="text-center py-8 text-gray-450 font-bold">Could not load details.</div>}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button type="button" onClick={() => setSelectedRequest(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Staff Modal */}
      {assignModalOpen && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => { if (!assigning) setAssignModalOpen(false); }}>
          <div className="pl-modal pl-modalAnimate max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdPeople className="text-white w-5 h-5" /> Assign Staff
              </h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Request: <span className="text-[#0077B6] font-extrabold">{selectedRequest?.requestNumber}</span> &middot; Staff Type: <span className="text-[#0077B6] font-extrabold">{selectedRequest?.requestedStaffType?.replace(/_/g, ' ')}</span>
              </p>
              {selectedRequest?.department && <p className="text-xs font-semibold text-gray-400">Department: {selectedRequest.department}</p>}
              {requestDetail?.admission?.ward?.name && (
                <div className="px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl text-sm text-[#0077B6] font-bold flex items-center gap-1.5">
                  <MdLocalHospital className="w-4.5 h-4.5" /> Ward: {requestDetail.admission.ward.name}
                </div>
              )}

              {/* Available Staff */}
              <h4 className="text-xs font-bold text-gray-450 uppercase tracking-wider block">Available Staff</h4>
              {staffLoading ? (
                <div className="text-center py-6 text-gray-405 font-bold">Loading staff…</div>
              ) : availableStaff.length === 0 ? (
                <div className="text-center py-6 text-gray-405 font-bold">No available staff found.</div>
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
                        {s.currentDuty && (
                          <p className="text-xs text-[#0077B6] font-bold mt-0.5 flex items-center gap-1">
                            <MdLocalHospital className="w-3.5 h-3.5" /> Duty: {s.currentDuty.wardName} ({s.currentDuty.shift?.replace(/_/g, ' ')})
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={availabilityVariant(s.availabilityStatus)}>{s.availabilityStatus}</Badge>
                        <p className="text-xs text-gray-450 font-semibold mt-1">{s.assignedPatients} patients &middot; {s.assignedOtCases} OT</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Shift & Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Shift</label>
                  <select value={assignShift} onChange={(e) => setAssignShift(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
                    <option value="">Select shift</option>
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                    <option value="NIGHT">Night</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Remarks</label>
                  <input value={assignRemarks} onChange={(e) => setAssignRemarks(e.target.value)}
                    placeholder="Optional remarks..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setAssignModalOpen(false)} disabled={assigning}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">Cancel</button>
                <button type="button" onClick={handleAssign} disabled={!selectedStaffId || assigning}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#0077B6] text-white hover:bg-[#0077B6]/90 disabled:opacity-50 active:scale-95 transition flex items-center gap-1.5 shadow-sm">
                  {assigning ? 'Assigning…' : <><MdCheckCircle /> Confirm Assignment</>}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Modal */}
      {rejectModalOpen && createPortal(
        <div className="pl-modalOverlay bg-slate-900/40 backdrop-blur-sm" onClick={() => { if (!rejecting) setRejectModalOpen(false); }}>
          <div className="pl-modal pl-modalAnimate max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <MdCancel className="text-white w-5 h-5" /> Reject Request
              </h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Provide a reason for rejecting <strong>{selectedRequest?.requestNumber}</strong>.</p>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Rejection reason (required)..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm min-h-[80px] focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold" />
              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setRejectModalOpen(false)} disabled={rejecting}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-250 transition">Cancel</button>
                <button type="button" onClick={handleReject} disabled={!rejectionReason.trim() || rejecting}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 active:scale-95 transition">
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
