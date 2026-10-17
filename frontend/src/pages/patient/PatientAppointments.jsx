import { useState, useEffect, useCallback } from 'react';
import patientApi from '../../utils/patientApi';
import { printPatientOpdSlip } from '../../utils/printPatientOpdSlip';

const STATUS_LABELS = {
  WAITING: 'Waiting',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const STATUS_BADGES = {
  WAITING: 'bg-amber-50 text-amber-600 border-amber-100',
  IN_PROGRESS: 'bg-blue-50 text-blue-600 border-blue-100',
  COMPLETED: 'bg-green-50 text-green-600 border-green-100',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

const STAT_CARDS = [
  { key: 'upcoming', label: 'Upcoming', color: 'text-blue-600' },
  { key: 'completed', label: 'Completed', color: 'text-emerald-600' },
  { key: 'today', label: "Today's", color: 'text-violet-600' },
  { key: 'waiting', label: 'Waiting', color: 'text-amber-600' },
];

export default function PatientAppointments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      setError(false);
      const params = { filter };
      if (debouncedSearch) params.search = debouncedSearch;
      const r = await patientApi.get('/patient/portal/appointments', { params });
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const r = await patientApi.get(`/patient/portal/appointments/${id}`);
      setDetail(r.data.appointment);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
  };

  if (loading && !data) return <Skeleton />;

  const appointments = data?.appointments || [];
  const stats = data?.stats || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Appointments</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track your OPD visits and consultation history</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {STAT_CARDS.map((c) => (
          <div key={c.key} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl md:text-3xl font-extrabold ${c.color}`}>{stats[c.key] ?? 0}</p>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filter === f.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by doctor, department, OPD..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
          />
        </div>
      </div>

      {error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-400 mt-1">Could not load appointments</p>
          <button onClick={fetchAppointments} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">
            Retry
          </button>
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-400 font-medium">No appointments found</p>
          <p className="text-xs text-gray-300 mt-1">Appointments will appear here once booked</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a, i) => (
            <AppointmentCard key={a.id} appointment={a} index={i} onClick={() => openDetail(a.id)} />
          ))}
        </div>
      )}

      {detailOpen && (
        <DetailDrawer detail={detail} loading={detailLoading} onClose={closeDetail} />
      )}
    </div>
  );
}

function AppointmentCard({ appointment: a, index, onClick }) {
  const dateStr = a.date
    ? new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const isToday = a.date && new Date(a.date).toDateString() === new Date().toDateString();

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-sm font-bold text-gray-400 border border-gray-200 shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-800 truncate">{a.doctor || 'Doctor'}</p>
              {isToday && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Today
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{a.specialization || a.department || ''}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              <span>{dateStr}</span>
              {a.time && <span>{a.time}</span>}
              {a.token && <span className="font-medium text-gray-600">Token: {a.token}</span>}
              {a.opdNumber && <span className="text-gray-400">{a.opdNumber}</span>}
            </div>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border shrink-0 ${STATUS_BADGES[a.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
          {STATUS_LABELS[a.status] || a.status}
        </span>
      </div>
    </div>
  );
}

function DetailDrawer({ detail, loading, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-800">Appointment Details</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-50 transition text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-16 bg-gray-100 rounded-xl" />
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-40 bg-gray-100 rounded-xl" />
          </div>
        ) : !detail ? (
          <div className="p-6 text-center text-gray-400 py-20">Appointment not found</div>
        ) : (
          <div className="p-6 space-y-6">

            {/* Date header + status */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 font-bold shrink-0 border border-blue-100">
                {detail.date ? String(new Date(detail.date).getDate()).padStart(2, '0') : '?'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-800 truncate">
                  {detail.date
                    ? new Date(detail.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    : '—'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_BADGES[detail.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {STATUS_LABELS[detail.status] || detail.status}
                  </span>
                  {detail.token && <span className="text-xs text-gray-400">Token #{detail.token}</span>}
                </div>
              </div>
            </div>

            {/* Appointment Info */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Appointment Info</p>
              <div className="grid grid-cols-2 gap-4">
                <Info label="OPD Number" value={detail.opdNumber || '—'} />
                <Info label="UHID" value={detail.uhid || '—'} />
                <Info label="Date" value={detail.date ? new Date(detail.date).toLocaleDateString('en-IN') : '—'} />
                <Info label="Time" value={detail.time || '—'} />
                <Info label="Department" value={detail.department || '—'} />
                <Info label="Fee" value={detail.fee ? `₹${detail.fee?.toLocaleString('en-IN')}` : '—'} />
                <Info label="Payment" value={detail.paymentStatus || '—'} />
                <Info label="Status" value={STATUS_LABELS[detail.status] || detail.status} />
              </div>
            </div>

            {/* Doctor Info */}
            <div className="border-t border-gray-50 pt-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Doctor Information</p>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                    {detail.doctor?.name?.charAt(0) || 'D'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{detail.doctor?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{detail.doctor?.specialization || ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Info label="Qualification" value={detail.doctor?.qualification || '—'} />
                  <Info label="Experience" value={detail.doctor?.experienceYears ? `${detail.doctor.experienceYears} years` : '—'} />
                  <Info label="Contact" value={detail.doctor?.phone || '—'} />
                </div>
              </div>
            </div>

            {/* Consultation */}
            {detail.consultation && (
              <div className="border-t border-gray-50 pt-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Consultation Details</p>
                <div className="space-y-3">
                  <Info label="Diagnosis" value={detail.consultation.diagnosis || '—'} />
                  <Info label="Symptoms" value={detail.consultation.symptoms || '—'} />
                  {detail.consultation.followUpDate && (
                    <Info label="Follow-up Date" value={new Date(detail.consultation.followUpDate).toLocaleDateString('en-IN')} />
                  )}
                  {detail.consultation.prescription?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-2">Prescribed Medicines</p>
                      <div className="space-y-1.5">
                        {detail.consultation.prescription.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span className="font-medium">{m.medicine || m.name || m}</span>
                            {m.dosage && <span className="text-gray-400">{m.dosage}</span>}
                            {m.frequency && <span className="text-gray-400">{m.frequency}</span>}
                            {m.duration && <span className="text-gray-400">× {m.duration}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-gray-50 pt-5 flex flex-col gap-3">
              <button
                onClick={() => printPatientOpdSlip(detail.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Slip
              </button>
              {detail.consultation?.prescription?.length > 0 && (
                <button
                  onClick={() => { window.location.href = '/patient/portal/prescriptions'; }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Prescription
                </button>
              )}
              {detail.bill && (
                <button
                  onClick={() => { window.location.href = '/patient/portal/bills'; }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                  View Bill
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-700 mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 w-24 bg-gray-100 rounded-lg" />)}
      </div>
      {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
    </div>
  );
}
