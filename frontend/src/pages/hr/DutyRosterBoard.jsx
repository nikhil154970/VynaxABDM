import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MdAssignment, MdPeople, MdMedicalServices, MdLocalHospital, MdWarning, MdSearch, MdClose, MdAdd, MdEdit, MdDelete, MdToday, MdViewWeek, MdViewModule, MdRefresh, MdCalendarMonth, MdSchedule, MdWork, MdPerson, MdBusiness, MdCheckCircle, MdAccessTime, MdDoneAll, MdBlock, MdInfo, MdDownload, MdFilterList, MdClear } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import '../ot/SurgeryScheduling.css';

const dutyTypeVariant = (t) => {
  if (t === 'GENERAL_WARD' || t === 'PRIVATE_WARD' || t === 'WARD') return 'blue';
  if (t === 'RECOVERY') return 'green';
  if (t === 'OT') return 'purple';
  if (t === 'ICU') return 'rose';
  return 'gray';
};

const statusVariant = (s) => {
  if (s === 'ON_DUTY') return 'green';
  if (s === 'UPCOMING') return 'blue';
  if (s === 'COMPLETED') return 'gray';
  if (s === 'OFF_DUTY') return 'amber';
  return 'gray';
};

const shiftVariant = (s) => {
  if (s === 'MORNING') return 'amber';
  if (s === 'EVENING') return 'purple';
  if (s === 'NIGHT') return 'indigo';
  return 'gray';
};

const WORKLOAD_LIMITS = { GENERAL: 8, PRIVATE: 4, ICU: 2, RECOVERY: 3, OT: 1 };

const getLocalDateString = (dateVal) => {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(dateVal).slice(0, 10);
};

const formatDate = getLocalDateString;

const renderMiniDutyBadge = (duty, onDetail) => {
  const getBorderClass = (type) => {
    if (type === 'WARD') return 'border-l-3 border-l-[#0077B6]';
    if (type === 'OT') return 'border-l-3 border-l-purple-600';
    if (type === 'RECOVERY') return 'border-l-3 border-l-emerald-600';
    if (type === 'EMERGENCY') return 'border-l-3 border-l-rose-600';
    return 'border-l-3 border-l-gray-400';
  };

  const getCircleColor = (type) => {
    if (type === 'WARD') return 'bg-[#0077B6]';
    if (type === 'OT') return 'bg-purple-600';
    if (type === 'RECOVERY') return 'bg-emerald-600';
    if (type === 'EMERGENCY') return 'bg-rose-600';
    return 'bg-gray-400';
  };

  return (
    <div
      key={duty.id}
      onClick={(e) => {
        e.stopPropagation();
        onDetail(duty);
      }}
      className={`text-xs p-1.5 pl-2 rounded-lg cursor-pointer bg-white border border-gray-100 hover:shadow-xs hover:border-gray-200 truncate font-semibold text-left text-gray-750 transition flex items-center gap-1.5 ${getBorderClass(duty.dutyType)}`}
    >
      <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-black text-white shrink-0 ${getCircleColor(duty.dutyType)}`}>
        {duty.dutyType[0]}
      </span>
      <span className="truncate">{duty.employeeName.split(' ')[0]}</span>
    </div>
  );
};

export default function DutyRosterBoard() {
  const [duties, setDuties] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterDutyType, setFilterDutyType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editDuty, setEditDuty] = useState(null);
  const [form, setForm] = useState({
    date: getLocalDateString(new Date()),
    shift: 'MORNING',
    employeeId: '', employeeName: '', department: '',
    dutyType: 'GENERAL_WARD', dutyLocation: '', startTime: '', endTime: '',
    remarks: '', wardType: 'GENERAL',
    patientCount: 0, assignedPatientIds: '', bedIds: '',
    otRoomName: '', surgeryId: '', surgeonName: '', timeSlot: '',
    recoveryRoomName: '',
  });
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const [detailModal, setDetailModal] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  // Auto-dismiss success message
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // ─── CSV Export ───
  const exportCSV = () => {
    if (duties.length === 0) { alert('No data to export'); return; }
    const headers = ['Date', 'Employee', 'Department', 'Shift', 'Duty Type', 'Location', 'Patient Count', 'Start Time', 'End Time', 'Status', 'Ward Type', 'OT Room', 'Surgeon', 'Recovery Room', 'Remarks'];
    const rows = duties.map((d) => [
      new Date(d.date).toLocaleDateString('en-IN'),
      d.employeeName,
      d.department || '',
      d.shift,
      d.dutyType,
      d.dutyLocation || d.otRoomName || d.recoveryRoomName || d.wardType || '',
      d.patientCount || 0,
      d.startTime || '',
      d.endTime || '',
      d.liveStatus || d.status || '',
      d.wardType || '',
      d.otRoomName || '',
      d.surgeonName || '',
      d.recoveryRoomName || '',
      (d.remarks || '').replace(/,/g, ';'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DutyRoster_${getLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchDuties = useCallback(async (isAutoRefresh) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const params = { page, limit: 50 };
      if (filterDate) params.startDate = filterDate;
      if (filterEndDate) params.endDate = filterEndDate;
      if (filterShift) params.shift = filterShift;
      if (filterDutyType) params.dutyType = filterDutyType;
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;

      const [dutyRes, statsRes] = await Promise.all([
        api.get('/hr/duty-rosters', { params }),
        api.get('/hr/duty-rosters/stats'),
      ]);
      setDuties(dutyRes.data.items || []);
      setTotalPages(dutyRes.data.totalPages || 1);
      setStats(statsRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('fetch duties error:', err);
    } finally {
      if (!isAutoRefresh) setLoading(false);
      setInitialLoad(false);
    }
  }, [page, filterDate, filterEndDate, filterShift, filterDutyType, filterStatus, search]);

  const fetchEmployees = useCallback(async (q) => {
    try {
      const res = await api.get('/hr/shifts/available-employees', { params: { search: q || undefined } });
      setEmployees(res.data.items || []);
    } catch { setEmployees([]); }
  }, []);

  useEffect(() => { fetchDuties(); }, [fetchDuties]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Auto-refresh every 5 minutes (silent background refresh)
  useEffect(() => {
    const interval = setInterval(() => fetchDuties(true), 300000);
    return () => clearInterval(interval);
  }, [fetchDuties]);

  // ─── Calendar helpers ───
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('day');

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  // ─── Form handlers ───
  const openCreateModal = () => {
    setEditDuty(null);
    setForm({
      date: filterDate || formatDate(new Date()),
      shift: 'MORNING', employeeId: '', employeeName: '', department: '',
      dutyType: 'GENERAL_WARD', dutyLocation: '', startTime: '', endTime: '',
      remarks: '', wardType: '',
      patientCount: 0, assignedPatientIds: '', bedIds: '',
      otRoomName: '', surgeryId: '', surgeonName: '', timeSlot: '',
      recoveryRoomName: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (duty) => {
    setEditDuty(duty);
    setForm({
      date: formatDate(duty.date),
      shift: duty.shift,
      employeeId: duty.employeeId,
      employeeName: duty.employeeName,
      department: duty.department || '',
      dutyType: duty.dutyType,
      dutyLocation: duty.dutyLocation || '',
      startTime: duty.startTime || '',
      endTime: duty.endTime || '',
      remarks: duty.remarks || '',
      wardType: duty.wardType || '',
      patientCount: duty.patientCount || 0,
      assignedPatientIds: duty.assignedPatientIds ? (() => { try { return JSON.parse(duty.assignedPatientIds).join(', '); } catch { return ''; } })() : '',
      bedIds: duty.bedIds ? (() => { try { return JSON.parse(duty.bedIds).join(', '); } catch { return ''; } })() : '',
      otRoomName: duty.otRoomName || '',
      surgeryId: duty.surgeryId || '',
      surgeonName: duty.surgeonName || '',
      timeSlot: duty.timeSlot || '',
      recoveryRoomName: duty.recoveryRoomName || '',
    });
    setModalOpen(true);
  };

  const handleFormChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const selectEmployee = (emp) => {
    setForm((f) => ({ ...f, employeeId: emp.id, employeeName: emp.name, department: emp.department || '' }));
    setShowEmployeeDropdown(false);
    setEmployeeSearch('');
  };

  const handleSave = async () => {
    if (!form.employeeId || !form.employeeName) {
      alert('Please select an employee');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: form.date,
        assignedPatientIds: [],
        bedIds: [],
        bedIds: form.bedIds ? form.bedIds.split(',').map((s) => s.trim()).filter(Boolean) : [],
        patientCount: parseInt(form.patientCount, 10) || 0,
      };

      if (editDuty) {
        await api.put(`/hr/duty-rosters/${editDuty.id}`, payload);
        setSuccessMsg(`Duty updated for ${form.employeeName}`);
      } else {
        await api.post('/hr/duty-rosters', payload);
        setSuccessMsg(`Duty assigned to ${form.employeeName}`);
      }
      setModalOpen(false);
      fetchDuties();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save duty';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    setConfirmDelete({ id, name });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { id, name } = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/hr/duty-rosters/${id}`);
      setSuccessMsg(`Duty removed for ${name}`);
      fetchDuties();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const openDetailModal = async (duty) => {
    try {
      const res = await api.get(`/hr/duty-rosters/${duty.id}`);
      setDetailModal(res.data);
    } catch {
      setDetailModal(duty);
    }
  };

  const getDutiesForDate = (dateStr) => duties.filter((d) => formatDate(new Date(d.date)) === dateStr);

  if (loading && duties.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdAssignment className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Duty Roster Management</h1>
              <p className="text-sm font-semibold text-gray-500 flex items-center gap-2 flex-wrap">
                Assign and coordinate daily clinical shifts and duty locations for hospital staff
                {lastUpdated && (
                  <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                    <MdAccessTime className="w-3.5 h-3.5" /> Last updated: {lastUpdated.toLocaleTimeString('en-IN')}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green-700 hover:bg-green-800 active:scale-95 transition shadow-sm"
            >
              <MdDownload className="w-4.5 h-4.5" /> Export CSV
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#0077B6]/90 active:scale-95 transition shadow-sm"
            >
              <MdAdd className="w-4.5 h-4.5" /> Assign Duty
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successMsg && (
          <div className="fixed top-4 right-4 z-[60] bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-slide-in">
            <MdCheckCircle className="w-4.5 h-4.5" /> {successMsg}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today Total</p>
              <p className="text-2xl font-extrabold text-[#001B48] mt-1">{stats.totalToday || 0}</p>
            </div>
            <div className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 border-l-4 border-l-green-500">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">On Duty</p>
              <p className="text-2xl font-extrabold text-green-600 mt-1">{stats.onDuty || 0}</p>
            </div>
            <div className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 border-l-4 border-l-blue-500">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Upcoming</p>
              <p className="text-2xl font-extrabold text-blue-600 mt-1">{stats.upcoming || 0}</p>
            </div>
            <div className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 border-l-4 border-l-gray-400">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-extrabold text-gray-600 mt-1">{stats.completed || 0}</p>
            </div>
            <div className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">By Type</p>
              <p className="text-sm font-bold text-[#001B48] mt-1 truncate">
                {Object.entries(stats.byType || {}).map(([k, v]) => `${k}:${v}`).join(', ')}
              </p>
            </div>
            <div className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">By Shift</p>
              <p className="text-sm font-bold text-[#001B48] mt-1 truncate">
                {Object.entries(stats.byShift || {}).map(([k, v]) => `${k}:${v}`).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
              <MdSearch className="text-gray-400 w-5 h-5 shrink-0" />
              <input
                type="text"
                placeholder="Search employee name, location..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="bg-transparent border-none outline-none text-sm w-full font-semibold focus:ring-0"
              />
              {search && <MdClose className="text-gray-400 hover:text-red-500 cursor-pointer shrink-0" onClick={() => { setSearch(''); setPage(1); }} />}
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">From:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition outline-none font-semibold bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase">To:</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition outline-none font-semibold bg-white"
              />
            </div>
            <select
              value={filterShift}
              onChange={(e) => { setFilterShift(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition font-semibold bg-white"
            >
              <option value="">All Shifts</option>
              <option value="MORNING">Morning</option>
              <option value="EVENING">Evening</option>
              <option value="NIGHT">Night</option>
            </select>
            <select
              value={filterDutyType}
              onChange={(e) => { setFilterDutyType(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition font-semibold bg-white"
            >
              <option value="">All Types</option>
              <option value="GENERAL_WARD">General Ward</option>
              <option value="PRIVATE_WARD">Private Ward</option>
              <option value="ICU">ICU</option>
              <option value="RECOVERY">Recovery</option>
              <option value="OT">OT</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition font-semibold bg-white"
            >
              <option value="">All Status</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="ON_DUTY">On Duty</option>
              <option value="COMPLETED">Completed</option>
              <option value="OFF_DUTY">Off Duty</option>
            </select>
            <div className="flex items-center gap-1 border-l pl-3 border-gray-200">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-xl transition ${viewMode === 'table' ? 'bg-blue-50 text-[#0077B6]' : 'text-gray-400 hover:text-gray-650'}`}
                title="Table View"
              >
                <MdViewModule className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`p-2 rounded-xl transition ${viewMode === 'day' ? 'bg-blue-50 text-[#0077B6]' : 'text-gray-400 hover:text-gray-650'}`}
                title="Day View"
              >
                <MdToday className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`p-2 rounded-xl transition ${viewMode === 'week' ? 'bg-blue-50 text-[#0077B6]' : 'text-gray-400 hover:text-gray-650'}`}
                title="Week View"
              >
                <MdViewWeek className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`p-2 rounded-xl transition ${viewMode === 'month' ? 'bg-blue-50 text-[#0077B6]' : 'text-gray-400 hover:text-gray-650'}`}
                title="Month View"
              >
                <MdCalendarMonth className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => fetchDuties()} className="p-2 text-gray-400 hover:text-[#0077B6] transition" title="Refresh"><MdRefresh className="w-5 h-5" /></button>
            <button onClick={() => { setFilterDate(''); setFilterEndDate(''); setFilterShift(''); setFilterDutyType(''); setFilterStatus(''); setSearch(''); setPage(1); }}
              className="p-2 text-gray-400 hover:text-red-500 transition" title="Clear Filters"><MdFilterList className="w-5 h-5" /></button>
          </div>
        </div>

        {/* ─── TABLE VIEW ─── */}
        {viewMode === 'table' && (
          <div className="border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="text-left px-3 py-2.5">Date</th>
                    <th className="text-left px-3 py-2.5">Employee</th>
                    <th className="text-left px-3 py-2.5">Role</th>
                    <th className="text-left px-3 py-2.5">Shift</th>
                    <th className="text-left px-3 py-2.5">Duty Type</th>
                    <th className="text-left px-3 py-2.5">Location</th>
                    <th className="text-center px-3 py-2.5">Patients</th>
                    <th className="text-left px-3 py-2.5">Time</th>
                    <th className="text-left px-3 py-2.5">Status</th>
                    <th className="text-center px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {duties.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-12 text-gray-400 font-semibold">No scheduled duties found.</td></tr>
                  )}
                  {duties.map((duty) => (
                    <tr key={duty.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => openDetailModal(duty)}>
                      <td className="px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">{formatDate(new Date(duty.date))}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-[#001B48]">{duty.employeeName}</div>
                        <div className="text-[10px] text-gray-400 font-bold mt-0.5">{duty.department || 'No department'}</div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-600">
                        {duty.employeeRole
                          ? duty.employeeRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                          : duty.employeeId ? 'Nurse Staff' : '—'}
                      </td>
                      <td className="px-3 py-2.5"><Badge variant={shiftVariant(duty.shift)}>{duty.shift}</Badge></td>
                      <td className="px-3 py-2.5"><Badge variant={dutyTypeVariant(duty.dutyType)}>{duty.dutyType}</Badge></td>
                      <td className="px-3 py-2.5 text-gray-650 font-semibold max-w-[140px] truncate">
                        {duty.dutyLocation || duty.otRoomName || duty.recoveryRoomName || duty.wardType || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-extrabold text-gray-700">
                          {duty.patientCount || 0}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                        {duty.startTime && duty.endTime ? `${duty.startTime} - ${duty.endTime}` : '—'}
                      </td>
                      <td className="px-3 py-2.5"><Badge variant={statusVariant(duty.liveStatus || duty.status)}>{(duty.liveStatus || duty.status).replace(/_/g, ' ')}</Badge></td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => openEditModal(duty)} className="p-1 text-[#0077B6] hover:bg-blue-50 rounded-lg transition" title="Edit"><MdEdit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(duty.id, duty.employeeName)} className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><MdDelete className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-150 text-gray-700 hover:bg-gray-250 disabled:opacity-50 active:scale-95 transition"
                >
                  Previous
                </button>
                <span className="text-sm font-bold text-gray-400">Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-150 text-gray-700 hover:bg-gray-250 disabled:opacity-50 active:scale-95 transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── DAY VIEW ─── */}
        {viewMode === 'day' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#001B48]">Schedule for {formatDate(calendarDate)}</h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 text-gray-750 rounded-lg hover:bg-gray-200 active:scale-95 transition"
                >
                  « Prev
                </button>
                <button
                  onClick={() => setCalendarDate(new Date())}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-[#0077B6] rounded-lg hover:bg-blue-100 active:scale-95 transition"
                >
                  Today
                </button>
                <button
                  onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 text-gray-750 rounded-lg hover:bg-gray-200 active:scale-95 transition"
                >
                  Next »
                </button>
              </div>
            </div>
            <DayView date={calendarDate} duties={duties} onEdit={openEditModal} onDelete={handleDelete} onDetail={openDetailModal} />
          </div>
        )}

        {/* ─── WEEK VIEW ─── */}
        {viewMode === 'week' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <WeekView
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              duties={duties}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDetail={openDetailModal}
            />
          </div>
        )}

        {/* ─── MONTH VIEW ─── */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <MonthView
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              duties={duties}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDetail={openDetailModal}
            />
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─── */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 bg-slate-900/40 backdrop-blur-sm overflow-y-auto" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <MdAssignment className="text-blue-200" /> {editDuty ? 'Edit Shift Duty assignment' : 'Assign Daily Shift Duty'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleFormChange('date', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  />
                </div>
                {/* Shift */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Shift *</label>
                  <select
                    value={form.shift}
                    onChange={(e) => handleFormChange('shift', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold bg-white"
                  >
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                    <option value="NIGHT">Night</option>
                  </select>
                </div>
                {/* Employee */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Staff Member *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search employee by name..."
                      value={employeeSearch || form.employeeName || ''}
                      onChange={(e) => {
                        setEmployeeSearch(e.target.value);
                        if (form.employeeName) {
                          setForm((f) => ({ ...f, employeeId: '', employeeName: '', department: '' }));
                        }
                        setShowEmployeeDropdown(true);
                        fetchEmployees(e.target.value);
                      }}
                      onFocus={() => { setShowEmployeeDropdown(true); fetchEmployees(); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                    />
                    {form.employeeName && !employeeSearch && (
                      <button
                        onClick={() => {
                          setForm((f) => ({ ...f, employeeId: '', employeeName: '', department: '' }));
                          setEmployeeSearch('');
                          setShowEmployeeDropdown(true);
                          fetchEmployees();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 transition"
                        title="Clear selection"
                      >
                        <MdClose className="w-4 h-4" />
                      </button>
                    )}
                    {showEmployeeDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {employees
                          .filter((e) => {
                            if (!employeeSearch && form.employeeName) {
                              return true;
                            }
                            return !employeeSearch || e.name.toLowerCase().includes(employeeSearch.toLowerCase());
                          })
                          .map((emp) => (
                            <button
                              key={emp.id}
                              onClick={() => selectEmployee(emp)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50/50 text-sm flex items-center gap-2 border-b border-gray-50 last:border-0 transition"
                            >
                              <MdPerson className="text-gray-450 shrink-0 w-4 h-4" />
                              <div>
                                <span className="font-bold text-gray-700">{emp.name}</span>
                                <span className="text-xs text-gray-400 font-semibold ml-2">{emp.department || '-'}</span>
                              </div>
                            </button>
                          ))}
                        {employees.length === 0 && <div className="px-4 py-3 text-sm text-gray-455 font-semibold">No staff found</div>}
                      </div>
                    )}
                  </div>
                </div>
                {/* Department */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => handleFormChange('department', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  />
                </div>
                {/* Duty Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Duty Type *</label>
                  <select
                    value={form.dutyType}
                    onChange={(e) => handleFormChange('dutyType', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold bg-white"
                  >
                    <option value="GENERAL_WARD">General Ward</option>
                    <option value="PRIVATE_WARD">Private Ward</option>
                    <option value="ICU">ICU</option>
                    <option value="RECOVERY">Recovery</option>
                    <option value="OT">OT</option>
                  </select>
                </div>
                {/* Duty Location */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Duty Location</label>
                  <input
                    type="text"
                    value={form.dutyLocation}
                    onChange={(e) => handleFormChange('dutyLocation', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                    placeholder="e.g., Ward A, ICU, etc."
                  />
                </div>
                {/* Start Time */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => handleFormChange('startTime', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  />
                </div>
                {/* End Time */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">End Time</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => handleFormChange('endTime', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  />
                </div>
                {/* Patient Count */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Patient Count</label>
                  <input
                    type="number"
                    min="0"
                    value={form.patientCount}
                    onChange={(e) => handleFormChange('patientCount', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                  />
                </div>
                {/* Patient assignments description */}
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-gray-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                    Patient-nurse assignments are created through <strong>HR → Allocation Requests</strong> and appear on the duty roster automatically after approval.
                  </p>
                </div>
              </div>

              {/* OT-specific fields */}
              {form.dutyType === 'OT' && (
                <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-100">
                  <p className="text-xs font-bold text-purple-700 mb-3 flex items-center gap-1"><MdMedicalServices className="w-4 h-4" /> OT Duty Specifics</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">OT Room</label>
                      <input
                        type="text"
                        value={form.otRoomName}
                        onChange={(e) => handleFormChange('otRoomName', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Surgery ID</label>
                      <input
                        type="text"
                        value={form.surgeryId}
                        onChange={(e) => handleFormChange('surgeryId', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Surgeon Name</label>
                      <input
                        type="text"
                        value={form.surgeonName}
                        onChange={(e) => handleFormChange('surgeonName', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Time Slot</label>
                      <input
                        type="text"
                        value={form.timeSlot}
                        onChange={(e) => handleFormChange('timeSlot', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                        placeholder="e.g., 09:00-11:00"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Recovery-specific fields */}
              {form.dutyType === 'RECOVERY' && (
                <div className="bg-green-50/50 rounded-2xl p-5 border border-green-100">
                  <p className="text-xs font-bold text-green-700 mb-3 flex items-center gap-1"><MdLocalHospital className="w-4 h-4" /> Recovery Duty Specifics</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Recovery Room</label>
                      <input
                        type="text"
                        value={form.recoveryRoomName}
                        onChange={(e) => handleFormChange('recoveryRoomName', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Workload Hint */}
              <div className="bg-amber-50/50 rounded-2xl p-3 border border-amber-100">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5"><MdInfo className="w-4 h-4 shrink-0" /> Workload limits: General Ward=8 patients, Private Ward=4 patients, ICU=2 patients, Recovery=3 patients, OT Nurse=1 surgery</p>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => handleFormChange('remarks', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-slate-50">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl active:scale-95 transition">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-[#0077B6] hover:bg-[#0077B6]/90 text-white rounded-xl active:scale-95 transition text-sm font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Saving…' : (editDuty ? 'Update Duty' : 'Assign Duty')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Detail Modal ─── */}
      {detailModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#001B48] to-[#0077B6] text-white flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MdInfo className="text-white w-5 h-5" /> Roster Duty Details
              </h2>
              <button onClick={() => setDetailModal(null)} className="text-white/80 hover:text-white transition"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-sm max-h-[80vh] overflow-y-auto bg-slate-50/50">
              
              {/* Staff Assignment Card */}
              <div className="bg-white rounded-2xl border border-gray-150 p-4 space-y-3.5 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><MdPerson className="text-[#0077B6] w-4.5 h-4.5" /> Staff Assignment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Employee</span><p className="font-extrabold text-[#001B48] mt-0.5">{detailModal.employeeName}</p></div>
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Department</span><p className="font-extrabold text-[#001B48] mt-0.5">{detailModal.department || '—'}</p></div>
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Assigned By</span><p className="font-semibold text-gray-600 mt-0.5">{detailModal.createdByName}</p></div>
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Status</span><p className="font-medium"><Badge variant={statusVariant(detailModal.liveStatus || detailModal.status)}>{(detailModal.liveStatus || detailModal.status).replace(/_/g, ' ')}</Badge></p></div>
                </div>
              </div>

              {/* Roster & Schedule Card */}
              <div className="bg-white rounded-2xl border border-gray-150 p-4 space-y-3.5 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><MdAssignment className="text-purple-600 w-4.5 h-4.5" /> Roster Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Date</span><p className="font-bold text-gray-700 mt-0.5">{formatDate(new Date(detailModal.date))}</p></div>
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Shift</span><p className="font-bold text-gray-700 mt-0.5">{detailModal.shift}</p></div>
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Duty Type</span><p className="font-semibold text-gray-700 mt-0.5">{detailModal.dutyType}</p></div>
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Scheduled Time</span><p className="font-semibold text-gray-700 mt-0.5">{detailModal.startTime && detailModal.endTime ? `${detailModal.startTime} - ${detailModal.endTime}` : '—'}</p></div>
                  <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Patient Count</span><p className="font-semibold text-gray-700 mt-0.5">{detailModal.patientCount || 0}</p></div>
                </div>
              </div>

              {/* Location Card - Full Width */}
              <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-sm">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Location / Duty description</span>
                <p className="font-bold text-[#0077B6] mt-1.5 text-sm leading-relaxed">{detailModal.dutyLocation || detailModal.otRoomName || detailModal.recoveryRoomName || detailModal.wardType || '—'}</p>
              </div>

              {detailModal.otRoomName && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mt-2">
                  <p className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1"><MdMedicalServices /> OT Detail Log</p>
                  <p className="text-xs font-semibold text-gray-650 mt-1">Room: {detailModal.otRoomName} | Surgery: {detailModal.surgeryId || '-'} | Surgeon: {detailModal.surgeonName || '-'} | Slot: {detailModal.timeSlot || '-'}</p>
                </div>
              )}
              {detailModal.recoveryRoomName && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 mt-2">
                  <p className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1"><MdLocalHospital /> Recovery Detail Log</p>
                  <p className="text-xs font-semibold text-gray-650 mt-1">Room: {detailModal.recoveryRoomName}</p>
                </div>
              )}
              {(detailModal.wardType || ['GENERAL_WARD','PRIVATE_WARD','ICU'].includes(detailModal.dutyType)) && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-2">
                  <p className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1"><MdLocalHospital /> Ward Assignment Log</p>
                  <p className="text-xs font-semibold text-gray-650 mt-1">Type: {detailModal.wardType || detailModal.dutyType.replace(/_/g, ' ')} | Location: {detailModal.dutyLocation || '-'} | Beds: {detailModal.bedIds || '-'}</p>
                </div>
              )}
              {detailModal.remarks && (
                <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Remarks</span><p className="text-xs font-semibold text-gray-700">{detailModal.remarks}</p></div>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-slate-50">
              <button onClick={() => setDetailModal(null)} className="px-4 py-2 text-sm font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl active:scale-95 transition shadow-xs">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <MdWarning className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-[#001B48]">Confirm Removal</h3>
              <p className="text-sm font-semibold text-gray-500 leading-relaxed">
                Remove {confirmDelete.name}'s duty assignment?
              </p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 text-sm font-bold text-white transition shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Day View Sub-component ─── */}
      {/* (Component definitions follow here) */}
    </div>
  );
}

/* ─── Day View Sub-component ─── */
function DayView({ date, duties, onEdit, onDelete, onDetail }) {
  const dateStr = formatDate(date);
  const dayDuties = duties.filter((d) => formatDate(d.date) === dateStr);
  const shifts = ['MORNING', 'EVENING', 'NIGHT'];

  if (dayDuties.length === 0) return <div className="text-center py-12 text-gray-400 font-semibold">No duties scheduled for this day</div>;

  return (
    <div className="space-y-4">
      {shifts.map((shift) => {
        const shiftDuties = dayDuties.filter((d) => d.shift === shift);
        if (shiftDuties.length === 0) return null;
        return (
          <div key={shift}>
            <h4 className="text-sm font-extrabold text-[#001B48] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Badge variant={shiftVariant(shift)}>{shift}</Badge>
              <span className="text-xs text-gray-400">({shiftDuties.length} duties)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shiftDuties.map((duty) => (
                <DutyCard key={duty.id} duty={duty} onEdit={onEdit} onDelete={onDelete} onDetail={onDetail} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Week View ─── */
function WeekView({ calendarDate, setCalendarDate, duties, onEdit, onDelete, onDetail }) {
  const weekStart = new Date(calendarDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
        <h3 className="text-base font-extrabold text-[#001B48]">Week Schedule Board</h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
            className="px-4 py-2 text-xs font-bold bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            « Prev
          </button>
          <button
            onClick={() => setCalendarDate(new Date())}
            className="px-4 py-2 text-xs font-bold bg-[#0077B6] text-white rounded-xl hover:bg-[#00B4D8] active:scale-95 transition-all shadow-sm"
          >
            Today
          </button>
          <button
            onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
            className="px-4 py-2 text-xs font-bold bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            Next »
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const dateStr = formatDate(d);
          const dayDuties = duties.filter((dd) => formatDate(dd.date) === dateStr);
          const isToday = dateStr === formatDate(new Date());
          return (
            <div key={dateStr} className={`border rounded-2xl p-3 min-h-[140px] flex flex-col justify-between transition ${isToday ? 'border-[#0077B6] bg-blue-50/20' : 'border-gray-200 bg-white hover:shadow-xs'}`}>
              <div>
                <p className={`text-xs font-bold mb-2 uppercase tracking-wider ${isToday ? 'text-[#0077B6]' : 'text-gray-450'}`}>
                  {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                {dayDuties.length === 0 && <p className="text-xs font-semibold text-gray-300 italic">No duties</p>}
                <div className="space-y-1">
                  {dayDuties.slice(0, 3).map((duty) => renderMiniDutyBadge(duty, onDetail))}
                </div>
              </div>
              {dayDuties.length > 3 && <p className="text-xs font-bold text-[#0077B6] mt-2">+{dayDuties.length - 3} more</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Month View ─── */
function MonthView({ calendarDate, setCalendarDate, duties, onEdit, onDelete, onDetail }) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = formatDate(new Date());

  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    cells.push(dateObj);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
        <h3 className="text-base font-extrabold text-[#001B48]">
          {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            className="px-4 py-2 text-xs font-bold bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            « Prev
          </button>
          <button
            onClick={() => setCalendarDate(new Date())}
            className="px-4 py-2 text-xs font-bold bg-[#0077B6] text-white rounded-xl hover:bg-[#00B4D8] active:scale-95 transition-all shadow-sm"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="px-4 py-2 text-xs font-bold bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            Next »
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-extrabold text-gray-500 py-2 uppercase tracking-widest">{day}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="bg-slate-50/40 border border-gray-100/50 min-h-[90px] rounded-xl" />;
          const dateStr = formatDate(cell);
          const dayDuties = duties.filter((d) => formatDate(d.date) === dateStr);
          const isToday = dateStr === today;
          return (
            <div key={dateStr} className={`border rounded-xl p-2 min-h-[90px] flex flex-col justify-between transition-all duration-200 ${isToday ? 'border-[#0077B6] bg-blue-50/10 ring-1 ring-[#0077B6]/20' : 'border-gray-150 bg-white hover:border-gray-300 hover:shadow-xs'}`}>
              <p className={`text-xs font-bold ${isToday ? 'text-[#0077B6]' : 'text-gray-500'}`}>{cell.getDate()}</p>
              {dayDuties.length > 0 && (
                <div className="mt-1 space-y-1">
                  {dayDuties.slice(0, 2).map((duty) => renderMiniDutyBadge(duty, onDetail))}
                  {dayDuties.length > 2 && <p className="text-xs font-bold text-[#0077B6]">+ {dayDuties.length - 2}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Duty Card ─── */
function DutyCard({ duty, onEdit, onDelete, onDetail }) {
  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
      onClick={() => onDetail(duty)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-[#001B48] text-sm">{duty.employeeName}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">{duty.department || 'No department'}</p>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onEdit(duty)} className="p-1.5 text-[#0077B6] hover:bg-blue-50 rounded-lg transition" title="Edit"><MdEdit className="w-4 h-4" /></button>
          <button onClick={() => onDelete(duty.id, duty.employeeName)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete"><MdDelete className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <Badge variant={shiftVariant(duty.shift)}>{duty.shift}</Badge>
        <Badge variant={dutyTypeVariant(duty.dutyType)}>{duty.dutyType}</Badge>
        <Badge variant={statusVariant(duty.liveStatus || duty.status)}>{(duty.liveStatus || duty.status).replace(/_/g, ' ')}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-550 border-t border-gray-50 pt-2.5">
        <span className="flex items-center gap-1 font-semibold"><MdAccessTime className="w-3.5 h-3.5 text-[#0077B6]" /> {duty.startTime && duty.endTime ? `${duty.startTime}-${duty.endTime}` : '—'}</span>
        <span className="flex items-center gap-1 font-bold text-gray-600"><MdPeople className="w-3.5 h-3.5 text-[#0077B6]" /> {duty.patientCount || 0} Patients</span>
      </div>
      <p className="text-xs font-semibold text-gray-400 mt-2 truncate bg-slate-50 rounded-lg px-2.5 py-1 border border-slate-100">{duty.dutyLocation || duty.otRoomName || duty.recoveryRoomName || duty.wardType || '—'}</p>
    </div>
  );
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay(); }
