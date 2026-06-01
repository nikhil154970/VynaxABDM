import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdSearch,
  MdFilterList,
  MdCalendarToday,
  MdAccessTime,
  MdPerson,
  MdPlayArrow,
  MdVisibility,
  MdPrint,
  MdEdit,
  MdClose,
  MdHourglassEmpty,
  MdDoneAll,
} from 'react-icons/md';
import { createPortal } from 'react-dom';
import '../patients/PatientList.css';
import api from '../../../utils/api';
import { DEPARTMENTS_WITH_ALL } from '../../../constants/departments';
import { printOpdSlip } from '../../../utils/printOpdSlip';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatISO(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function safeText(v) {
  const s = v == null ? '' : String(v);
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'));
}

const STATUS_LABEL = {
  WAITING: 'Waiting',
  IN_PROGRESS: 'In Consultation',
  COMPLETED: 'Completed',
};

const STATUS_META = {
  Waiting: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  'In Consultation': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  Completed: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  Cancelled: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

export default function AppointmentList() {
  const navigate = useNavigate();
  const todayISO = toISODate(new Date());

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('Today'); // Today | Custom Date
  const [customDate, setCustomDate] = useState(todayISO);
  const [department, setDepartment] = useState('All');
  const [doctor, setDoctor] = useState('All');
  const [status, setStatus] = useState('All'); // Waiting | In Consultation | Completed | Cancelled

  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const DEPARTMENTS = DEPARTMENTS_WITH_ALL;

  const DOCTORS = useMemo(() => {
    const base = (appointments || []).filter((a) => department === 'All' || a.department === department);
    const uniq = Array.from(new Set(base.map((a) => a.doctor).filter(Boolean))).sort();
    return ['All', ...uniq];
  }, [appointments, department]);

  const STATUS_OPTIONS = ['All', 'Waiting', 'In Consultation', 'Completed', 'Cancelled'];
  const DATE_OPTIONS = ['Today', 'Custom Date'];

  const fetchAppointments = async () => {
    const date = dateFilter === 'Today' ? todayISO : dateFilter === 'Custom Date' ? customDate : '';
    setLoading(true);
    try {
      const params = {
        q: searchQuery || undefined,
        date: date || undefined,
        department: department !== 'All' ? department : undefined,
        status: status !== 'All' ? status.toUpperCase().replace(/\s+/g, '_') : undefined,
      };
      if (doctor !== 'All') params.q = params.q ? params.q : doctor;
      const res = await api.get('/receptionist/appointments', { params });
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setAppointments(
        items.map((a) => ({
          id: a.id,
          opdNumber: a.opdNumber,
          token: a.token,
          patientName: a.patientName,
          registrationNumber: a.registrationNumber,
          uhid: a.uhid,
          mobile: a.mobile,
          doctor: a.doctorName,
          doctorId: a.doctorId,
          department: a.department,
          timeSlot: a.time,
          status: STATUS_LABEL[a.status] || a.status,
          fee: a.fee,
          paymentMode: a.paymentMode,
          paymentStatusRaw: a.paymentStatus,
          paymentStatus: (a.paymentStatus || '').toUpperCase() === 'PAID' ? 'Paid' : (a.paymentStatus || '').toUpperCase() === 'PENDING' ? 'Pending' : (a.paymentStatus || '—'),
          date: a.date ? String(a.date).slice(0, 10) : '',
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      const date = dateFilter === 'Today' ? todayISO : dateFilter === 'Custom Date' ? customDate : '';
      setLoading(true);
      try {
        const params = {
          q: searchQuery || undefined,
          date: date || undefined,
          department: department !== 'All' ? department : undefined,
          status: status !== 'All' ? status.toUpperCase().replace(/\s+/g, '_') : undefined,
        };
        const res = await api.get('/receptionist/appointments', { params });
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!active) return;
        setAppointments(
          items.map((a) => ({
            id: a.id,
            opdNumber: a.opdNumber,
            token: a.token,
            patientName: a.patientName,
            registrationNumber: a.registrationNumber,
            uhid: a.uhid,
            mobile: a.mobile,
            doctor: a.doctorName,
            doctorId: a.doctorId,
            department: a.department,
            timeSlot: a.time,
            status: STATUS_LABEL[a.status] || a.status,
            fee: a.fee,
            paymentMode: a.paymentMode,
            paymentStatusRaw: a.paymentStatus,
            paymentStatus: (a.paymentStatus || '').toUpperCase() === 'PAID' ? 'Paid' : (a.paymentStatus || '').toUpperCase() === 'PENDING' ? 'Pending' : (a.paymentStatus || '—'),
            date: a.date ? String(a.date).slice(0, 10) : '',
          }))
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, dateFilter, customDate, department, doctor, status, todayISO]);

  const handleSearch = (value) => {
    setSearchQuery(value);
  };

  const handleFilter = (key, value) => {
    if (key === 'dateFilter') setDateFilter(value);
    if (key === 'customDate') setCustomDate(value);
    if (key === 'department') {
      setDepartment(value);
      setDoctor('All');
    }
    if (key === 'doctor') setDoctor(value);
    if (key === 'status') setStatus(value);
  };

  const handleViewDetails = (appt) => {
    setSelected(appt);
    setIsModalOpen(true);
  };

  const cancelAppointment = async (appointmentId) => {
    await api.delete(`/receptionist/appointments/${appointmentId}`);
    setAppointments((prev) => prev.filter((x) => x.id !== appointmentId));
  };
const printSlip = async (a) => printOpdSlip(a);
  const tokenNumber = (t) => {
    const n = Number(String(t || '').replace(/\D+/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const stats = useMemo(() => {
    const date = todayISO;
    const today = appointments.filter((a) => a.date === date);
    const total = today.length;
    const waiting = today.filter((a) => a.status === 'Waiting').length;
    const consulting = today.filter((a) => a.status === 'In Consultation').length;
    const completed = today.filter((a) => a.status === 'Completed').length;
    return { total, waiting, consulting, completed };
  }, [appointments, todayISO]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Appointments Today', value: stats.total, icon: MdCalendarToday, bg: '#0f2d5e', light: '#dbeafe' },
            { label: 'Waiting Patients', value: stats.waiting, icon: MdHourglassEmpty, bg: '#854d0e', light: '#fef3c7' },
            { label: 'In Consultation', value: stats.consulting, icon: MdPlayArrow, bg: '#1d4ed8', light: '#dbeafe' },
            { label: 'Completed Appointments', value: stats.completed, icon: MdDoneAll, bg: '#14532d', light: '#dcfce7' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.light }}>
                    <Icon className="w-5 h-5" style={{ color: s.bg }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-extrabold text-gray-900 leading-tight">{s.value}</p>
                    <p className="text-xs font-semibold text-gray-600 mt-0.5 truncate">{s.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative w-full lg:w-[460px]">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by Name / UHID / Mobile"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap lg:ml-auto lg:justify-end">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <MdFilterList className="w-4 h-4" /> Filters
              </div>

              <select value={dateFilter} onChange={(e) => handleFilter('dateFilter', e.target.value)} className="pl-select">
                {DATE_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {dateFilter === 'Custom Date' ? (
                <input type="date" value={customDate} onChange={(e) => handleFilter('customDate', e.target.value)} className="pl-select" />
              ) : null}

              <select value={department} onChange={(e) => handleFilter('department', e.target.value)} className="pl-select">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d === 'All' ? 'All departments' : d}</option>
                ))}
              </select>

              <select value={doctor} onChange={(e) => handleFilter('doctor', e.target.value)} className="pl-select">
                {DOCTORS.map((d) => (
                  <option key={d} value={d}>{d === 'All' ? 'All doctors' : d}</option>
                ))}
              </select>

              <select value={status} onChange={(e) => handleFilter('status', e.target.value)} className="pl-select">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s === 'All' ? 'All status' : s}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchAppointments}
                className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                disabled={loading}
                title="Refresh"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm table-fixed">
                <thead>
                  <tr style={{ background: '#f8faff', position: 'sticky', top: 0, zIndex: 1 }}>
                    {[
                      'OPD No',
                      'Patient Name',
                      'Reg No',
                      'Doctor',
                      'Department',
                      'Time Slot',
                      'Status',
                      'Payment Status',
                      'Actions',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                        Loading appointments…
                      </td>
                    </tr>
                  ) : appointments.map((a) => {
                    const s = STATUS_META[a.status] || STATUS_META.Waiting;
                    const isDone = a.status === 'Completed';
                    const isCancelled = a.status === 'Cancelled';
                    const canStart = a.status === 'Waiting';
                    const canComplete = a.status === 'In Consultation';
                    const canEdit = !isDone && !isCancelled;
                    const canCancel = !isDone && !isCancelled;

                    return (
                      <tr key={a.id} className="hover:bg-blue-50/30 transition">
                        <td className="px-3 py-3 align-top">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {a.opdNumber || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <MdPerson className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{a.patientName}</p>
                              <p className="text-xs text-gray-400 truncate">{formatISO(a.date)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md whitespace-nowrap"
                            title={a.uhid ? `UHID: ${a.uhid}` : ''}
                          >
                            {a.registrationNumber || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 align-top">{a.doctor}</td>
                        <td className="px-3 py-3 text-xs text-gray-500 align-top">{a.department}</td>
                        <td className="px-3 py-3 align-top">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MdAccessTime className="w-3 h-3" /> {a.timeSlot}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="pl-status" style={{ background: s.bg, color: s.text }}>
                            <span className="pl-dot" style={{ background: s.dot }} />
                            {a.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className="text-xs font-extrabold px-2.5 py-1 rounded-full"
                            style={{
                              background: a.paymentStatus === 'Paid' ? '#dcfce7' : a.paymentStatus === 'Refunded' ? '#fee2e2' : '#fef9c3',
                              color: a.paymentStatus === 'Paid' ? '#14532d' : a.paymentStatus === 'Refunded' ? '#991b1b' : '#854d0e',
                            }}
                          >
                            {a.paymentStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(a)}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                              title="View"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => printSlip(a)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition"
                              title="Print"
                            >
                              <MdPrint className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
          </table>

          {!loading && appointments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MdCalendarToday className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No appointments found</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Patient Detail Modal */}
      {isModalOpen && selected
        ? createPortal(
          <div className="pl-modalOverlay" role="dialog" aria-modal="true">
            <div className="pl-modal pl-modalAnimate">
              <div className="pl-modalHeader">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="pl-avatar" aria-hidden>
                    <MdPerson className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-gray-900 truncate">{selected.patientName}</p>
                    <div className="pl-headerMeta">
                      <span className="pl-chip pl-chipMono">OPD {selected.opdNumber || '—'}</span>
                      <span className="pl-chip pl-chipMono">Token {selected.token || '—'}</span>
                      <span className="pl-chip pl-chipMono">Reg {selected.registrationNumber || '—'}</span>
                      <span className="pl-chip">
                        <span
                          className="pl-chipDot"
                          style={{ background: selected.status === 'Completed' ? '#22c55e' : selected.status === 'Cancelled' ? '#ef4444' : '#eab308' }}
                        />
                        {selected.status}
                      </span>
                      <span className="pl-chip">{selected.paymentStatus || '—'}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="pl-modalClose"
                  title="Close"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>

              <div className="pl-modalBody">
                <div className="pl-modalGrid">
                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Patient Basic Info</p>
                    <div className="pl-kv">
                      <div><p className="k">Patient Name</p><p className="v">{selected.patientName}</p></div>
                      <div><p className="k">Reg No</p><p className="v font-mono">{selected.registrationNumber || '—'}</p></div>
                      <div><p className="k">Token</p><p className="v font-mono">{selected.token}</p></div>
                      <div><p className="k">Payment Status</p><p className="v">{selected.paymentStatus}</p></div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Appointment Details</p>
                    <div className="pl-kv">
                      <div><p className="k">Date</p><p className="v">{formatISO(selected.date)}</p></div>
                      <div><p className="k">Time Slot</p><p className="v">{selected.timeSlot}</p></div>
                      <div><p className="k">Department</p><p className="v">{selected.department}</p></div>
                      <div><p className="k">Status</p><p className="v">{selected.status}</p></div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Doctor Info</p>
                    <div className="pl-kv">
                      <div className="colspan2"><p className="k">Doctor</p><p className="v">{selected.doctor}</p></div>
                    </div>
                  </div>
                </div>

                <div className="pl-modalActions">
                  <button
                    type="button"
                    className="pl-actionBtn pl-actionBtnPrimary"
                    onClick={() => navigate('/dashboard/reception/appointments/book', { state: { mode: 'edit', appointment: selected } })}
                    disabled={selected.status === 'Completed' || selected.status === 'Cancelled'}
                    title="Edit Appointment"
                  >
                    <MdEdit className="w-4 h-4" /> Edit
                  </button>
                  <button
                    type="button"
                    className="pl-actionBtn pl-actionBtnDanger"
                    onClick={async () => {
                      // eslint-disable-next-line no-alert
                      const ok = window.confirm('Cancel this appointment?');
                      if (!ok) return;
                      await cancelAppointment(selected.id);
                      setIsModalOpen(false);
                      setSelected(null);
                    }}
                    disabled={selected.status === 'Completed' || selected.status === 'Cancelled'}
                    title="Cancel Appointment"
                  >
                    <MdClose className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    type="button"
                    className="pl-actionBtn"
                    onClick={() => printSlip(selected)}
                    title="Print OPD Slip"
                  >
                    <MdPrint className="w-4 h-4" /> Print
                  </button>
                  <button
                    type="button"  
                    className="pl-actionBtn"
                    onClick={() => setIsModalOpen(false)}
                  >
                    <MdVisibility className="w-4 h-4" /> Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}