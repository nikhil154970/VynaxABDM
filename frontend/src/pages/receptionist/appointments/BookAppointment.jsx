import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MdSearch,
  MdPerson,
  MdPhone,
  MdBadge,
  MdCalendarToday,
  MdAccessTime,
  MdLocalHospital,
  MdPayments,
  MdSave,
  MdRefresh,
  MdAdd,
  MdCheckCircle,
  MdClose,
} from 'react-icons/md';
import api from '../../../utils/api';
import { DEPARTMENTS } from '../../../constants/departments';
import { printOpdSlip } from '../../../utils/printOpdSlip';
import { isAyushmanSponsor, AYUSHMAN_BILLING_NOTICE, AYUSHMAN_PAYMENT_LABEL } from '../../../utils/ayushmanBilling';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const DEFAULT_FEE = 300;

export default function BookAppointment() {
  const location = useLocation();
  const navigate = useNavigate();
  const today = toISODate(new Date());
  const editAppt = location?.state?.mode === 'edit' ? location?.state?.appointment : null;
  const isEditMode = Boolean(editAppt?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);

  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [doctors, setDoctors] = useState([]);

  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]); // [{ label, available, past, booked }]
  const [slotsMessage, setSlotsMessage] = useState('');

  const [success, setSuccess] = useState(null); // { token, opdNumber }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    department: '',
    doctorId: '',
    doctorName: '',
    date: today,
    timeSlot: '',
    visitType: 'OPD',
    reason: '',
    fee: String(DEFAULT_FEE),
    paymentMode: 'Cash',
    paymentStatus: 'Paid',
  });

  const [isPrefillingEdit, setIsPrefillingEdit] = useState(false);
  const [isPrefillingReferral, setIsPrefillingReferral] = useState(
    () => !!location?.state?.prefillPatient?.uhid
  );

  const resetForm = () => {
    setErrors({});
    setSuccess(null);
    setSubmitError('');
    setConfirmOpen(false);
    setSearchQuery('');
    setPatientSuggestions([]);
    setSelectedPatient(null);
    setPatientSearchOpen(false);
    setDoctors([]);
    setTimeSlots([]);
    setSlotsMessage('');
    setForm({
      department: '',
      doctorId: '',
      doctorName: '',
      date: today,
      timeSlot: '',
      visitType: 'OPD',
      reason: '',
      fee: String(DEFAULT_FEE),
      paymentMode: 'Cash',
      paymentStatus: 'Paid',
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (selectedPatient?.isAyushman && (name === 'paymentStatus' || name === 'paymentMode')) {
      setForm((prev) => ({
        ...prev,
        paymentStatus: 'Paid',
        paymentMode: AYUSHMAN_PAYMENT_LABEL,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const canFetchSlots = Boolean(form.doctorId && form.date);

  const safeParseArray = (raw) => {
    try {
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  const fetchPatientSuggestions = async (query) => {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const res = await api.get('/receptionist/patients/search', { params: { q } });
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    return items.slice(0, 8).map((p) => ({
      patientId: p?.uhid || '',
      uhid: p?.uhid || '',
      name: p?.name || '',
      mobile: p?.phone || '',
      age: p?.age ?? '',
      gender: p?.gender || '',
      sponsor: p?.sponsor || '',
      isAyushman: isAyushmanSponsor(p?.sponsor),
    }));
  };

  const fetchDoctors = async (department) => {
    const dept = String(department || '').trim();
    if (!dept) return [];
    const res = await api.get('/doctors/lookup', { params: { q: dept } });
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    // Filter specialization match client-side to keep UI consistent
    return items
      .filter((d) => String(d.specialization || '').toLowerCase().includes(dept.toLowerCase()))
      .map((d) => ({ id: d.id, name: d.name }));
  };

  const fetchTimeSlots = async (doctorId, date) => {
    if (!doctorId || !date) return { slots: [], message: '' };
    try {
      const res = await api.get(`/doctors/${doctorId}/slots`, { params: { date } });
      return { slots: res.data?.slots || [], message: res.data?.message || '' };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch slots';
      setSubmitError(`Time slots error: ${msg}`);
      return { slots: [], message: '' };
    }
  };

  const [tokenPreview, setTokenPreview] = useState('—');
  const [queuePosition, setQueuePosition] = useState('—');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!form.doctorId || !form.date) {
        if (!active) return;
        setTokenPreview('—');
        setQueuePosition('—');
        return;
      }
      // In edit mode show existing token/queue preview as-is.
      if (isEditMode && editAppt?.token) {
        if (!active) return;
        setTokenPreview(editAppt.token);
        setQueuePosition('—');
        return;
      }
      setPreviewLoading(true);
      try {
        const res = await api.get('/receptionist/appointments/next-token', {
          params: { doctorId: form.doctorId, date: form.date },
        });
        if (!active) return;
        setTokenPreview(res?.data?.nextToken || '—');
        setQueuePosition(res?.data?.queuePosition != null ? String(res.data.queuePosition) : '—');
      } finally {
        if (active) setPreviewLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [form.doctorId, form.date, isEditMode, editAppt]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setIsSearchingPatients(true);
      try {
        const list = await fetchPatientSuggestions(searchQuery);
        if (!active) return;
        setPatientSuggestions(list);
        setPatientSearchOpen(Boolean(String(searchQuery || '').trim().length >= 2));
      } finally {
        if (active) setIsSearchingPatients(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [searchQuery]);

  const applyAyushmanPatient = (p) => {
    const ayushman = p?.isAyushman === true || isAyushmanSponsor(p?.sponsor);
    const next = { ...p, isAyushman: ayushman, sponsor: p?.sponsor || (ayushman ? 'AYUSHMAN' : '') };
    setSelectedPatient(next);
    setForm((prev) => ({
      ...prev,
      department: p?.department || prev.department,
      doctorId: p?.doctorId || prev.doctorId || '',
      doctorName: p?.doctorName || prev.doctorName || '',
      ...(ayushman ? { paymentStatus: 'Paid', paymentMode: AYUSHMAN_PAYMENT_LABEL } : {})
    }));
    return next;
  };

  useEffect(() => {
    const p = location?.state?.prefillPatient;
    if (!p?.uhid) return;
    applyAyushmanPatient(p);
    setSearchQuery(`${p.name || ''} • ${p.uhid}`.trim());
    setPatientSearchOpen(false);
    setErrors((prev) => ({ ...prev, patient: undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edit mode prefill (from Appointment List -> Edit)
  useEffect(() => {
    if (!isEditMode) return;
    setIsPrefillingEdit(true);
    const p = {
      patientId: editAppt.uhid || '',
      uhid: editAppt.uhid || '',
      name: editAppt.patientName || '',
      mobile: editAppt.mobile || '',
      age: '',
      gender: '',
    };
    setSelectedPatient(p);
    setSearchQuery(`${p.name || ''} • ${p.uhid}`.trim());
    setPatientSearchOpen(false);
    setErrors({});
    setSuccess(null);
    setForm((prev) => ({
      ...prev,
      department: editAppt.department || '',
      doctorId: editAppt.doctorId || '',
      doctorName: editAppt.doctor || editAppt.doctorName || '',
      date: editAppt.date || prev.date,
      timeSlot: editAppt.timeSlot || '',
      fee: String(editAppt.fee ?? prev.fee ?? DEFAULT_FEE),
      paymentMode: editAppt.paymentMode || prev.paymentMode,
      paymentStatus: editAppt.paymentStatus || prev.paymentStatus,
    }));
  }, [isEditMode, editAppt]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setIsLoadingDoctors(true);
      try {
        const list = await fetchDoctors(form.department);
        if (!active) return;
        setDoctors(list);
      } finally {
        if (active) setIsLoadingDoctors(false);
      }
    };

    // Don't wipe selections while prefilling edit or referral.
    if (!isPrefillingEdit && !isPrefillingReferral && !isEditMode) {
      setForm((prev) => ({ ...prev, doctorId: '', doctorName: '', timeSlot: '' }));
      setTimeSlots([]);
    }

    if (!form.department) {
      setDoctors([]);
      return () => {
        active = false;
      };
    }

    run().finally(() => {
      // allow normal resets after initial prefill
      if (active) {
        setIsPrefillingEdit(false);
        setIsPrefillingReferral(false);
      }
    });
    return () => {
      active = false;
    };
  }, [form.department, isPrefillingEdit, isPrefillingReferral]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setIsLoadingSlots(true);
      try {
        const { slots, message } = await fetchTimeSlots(form.doctorId, form.date);
        if (!active) return;
        setTimeSlots(slots);
        setSlotsMessage(message);
      } finally {
        if (active) setIsLoadingSlots(false);
      }
    };

    // Keep time slot in edit mode on first load; clear only when user changes doctor/date.
    const keepExistingTimeSlot =
      isEditMode &&
      Boolean(editAppt?.timeSlot) &&
      String(form.doctorId || '') === String(editAppt?.doctorId || '') &&
      String(form.date || '') === String(editAppt?.date || '');

    if (!keepExistingTimeSlot) {
      setForm((prev) => ({ ...prev, timeSlot: '' }));
    }
    setTimeSlots([]);
    setSlotsMessage('');

    if (!canFetchSlots) return () => {
      active = false;
    };

    run();
    return () => {
      active = false;
    };
  }, [form.doctorId, form.date, canFetchSlots]);

  const validate = () => {
    const next = {};
    if (!selectedPatient?.patientId) next.patient = 'Select a patient';
    if (!form.department) next.department = 'Department is required';
    if (!form.doctorId) next.doctorId = 'Doctor is required';
    if (!form.date) next.date = 'Appointment date is required';
    if (!form.timeSlot) next.timeSlot = 'Select a time slot';
    if (!form.paymentStatus) next.paymentStatus = 'Payment status is required';
    return next;
  };

  const buildPayload = () => ({
    uhid: selectedPatient.uhid,
    doctorId: form.doctorId,
    department: form.department,
    date: form.date,
    timeSlot: form.timeSlot,
    fee: form.fee === '' || form.fee == null ? DEFAULT_FEE : Number(form.fee),
    paymentMode: selectedPatient?.isAyushman ? AYUSHMAN_PAYMENT_LABEL : form.paymentMode,
    paymentStatus: String(form.paymentStatus || '').toUpperCase(),
  });

  const openConfirm = () => {
    setSuccess(null);
    setSubmitError('');
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setConfirmOpen(true);
  };

  const submitAppointment = async () => {
    setSubmitLoading(true);
    setSubmitError('');
    try {
      const payload = buildPayload();
      const res = isEditMode
        ? await api.put(`/receptionist/appointments/${editAppt.id}`, payload)
        : await api.post('/receptionist/appointments', payload);
      const appt = res?.data?.appointment;
      setSuccess({ token: appt?.token, opdNumber: appt?.opdNumber, appointment: appt });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to book appointment. Please try again.';
      setSubmitError(String(msg));
    } finally {
      setSubmitLoading(false);
    }
  };

  const printSlip = async () => {
    if (!success?.appointment?.id) return;
    await printOpdSlip(success.appointment);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-none px-4 py-5 sm:px-6 xl:px-8 space-y-5">

        <div className="grid grid-cols-1 gap-5">
          {/* Left / Main */}
          <div className="space-y-5">
            {/* Patient selection */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Patient Search</p>
                  <p className="text-xs text-gray-500 mt-0.5">Search by Name / UHID / Mobile</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/reception/patients/register')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow hover:shadow-md transition hover:-translate-y-0.5"
                  style={{ backgroundColor: '#0077B6' }}
                >
                  <MdAdd className="w-4 h-4" /> New Patient
                </button>
              </div>

              <div className="mt-4 relative">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setPatientSearchOpen(true)}
                  placeholder="Type at least 2 characters..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {patientSearchOpen ? (
                  <div className="absolute z-10 left-0 right-0 mt-2 bg-white border border-gray-100 shadow-lg rounded-2xl overflow-hidden">
                    <div className="px-4 py-2 text-[11px] font-semibold text-gray-500 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span>{isSearchingPatients ? 'Searching…' : 'Suggestions'}</span>
                      <button
                        type="button"
                        onClick={() => setPatientSearchOpen(false)}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                      >
                        Close
                      </button>
                    </div>
                    {String(searchQuery || '').trim().length < 2 ? (
                      <div className="px-4 py-3 text-xs text-gray-500">Start typing to see patients.</div>
                    ) : patientSuggestions.length ? (
                      <div className="max-h-72 overflow-auto">
                        {patientSuggestions.map((p) => (
                          <button
                            key={p.patientId}
                            type="button"
                            onClick={async () => {
                              let row = { ...p };
                              if (!row.sponsor && row.uhid) {
                                try {
                                  const res = await api.get(
                                    `/receptionist/patients/${encodeURIComponent(row.uhid)}/details`,
                                  );
                                  row.sponsor = res.data?.sponsor || '';
                                  row.isAyushman = res.data?.isAyushman === true || isAyushmanSponsor(row.sponsor);
                                } catch {
                                  /* keep search row */
                                }
                              }
                              applyAyushmanPatient(row);
                              setPatientSearchOpen(false);
                              setSearchQuery(`${row.name} • ${row.uhid}`);
                              setErrors((prev) => ({ ...prev, patient: undefined }));
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50/40 transition flex items-center gap-3 border-b border-gray-50 last:border-0"
                          >
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <MdPerson className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {p.uhid} · <MdPhone className="inline-block w-3 h-3 -mt-0.5" /> {p.mobile} · {p.age} / {p.gender}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-xs text-gray-500">No matches found.</div>
                    )}
                  </div>
                ) : null}

                {errors.patient ? <p className="text-xs text-red-600 font-semibold mt-2">{errors.patient}</p> : null}
              </div>
            </div>

            {/* Patient info card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <MdBadge className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Patient Information</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { k: 'Name', v: selectedPatient?.name || '—' },
                  { k: 'UHID', v: selectedPatient?.uhid || '—', mono: true },
                  { k: 'Mobile', v: selectedPatient?.mobile || '—' },
                  { k: 'Age / Gender', v: selectedPatient ? `${selectedPatient.age || '—'} / ${selectedPatient.gender || '—'}` : '—' },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-gray-500">{x.k}</p>
                    <p className={`text-sm font-extrabold text-gray-800 ${x.mono ? 'font-mono' : ''}`}>{x.v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Appointment details */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                  <MdLocalHospital className="w-5 h-5 text-orange-700" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Appointment Details</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Department</label>
                  <select name="department" value={form.department} onChange={handleChange} className={inputCls}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.filter(d => d !== 'Emergency & Trauma Care' && d !== 'Critical Care (ICU)').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {errors.department ? <p className="text-xs text-red-600 font-semibold mt-1.5">{errors.department}</p> : null}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Doctor</label>
                  <select
                    name="doctorId"
                    value={form.doctorId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const d = doctors.find((x) => x.id === id);
                      setForm((prev) => ({ ...prev, doctorId: id, doctorName: d?.name || '' }));
                      setErrors((prev) => ({ ...prev, doctorId: undefined }));
                    }}
                    className={inputCls}
                    disabled={!form.department || isLoadingDoctors}
                  >
                    <option value="">
                      {!form.department ? 'Select department first' : isLoadingDoctors ? 'Loading doctors…' : 'Select doctor'}
                    </option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {errors.doctorId ? <p className="text-xs text-red-600 font-semibold mt-1.5">{errors.doctorId}</p> : null}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Appointment Date</label>
                  <input
                    type="date"
                    name="date"
                    min={today}
                    value={form.date}
                    onChange={handleChange}
                    className={inputCls}
                  />
                  {errors.date ? <p className="text-xs text-red-600 font-semibold mt-1.5">{errors.date}</p> : null}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Visit Type</label>
                  <select name="visitType" value={form.visitType} onChange={handleChange} className={inputCls}>
                    {['OPD', 'Emergency'].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs font-semibold text-gray-600">Time Slot</p>
                  <p className="text-[11px] text-gray-400">
                    {isLoadingSlots ? 'Fetching availability…' : form.doctorId ? 'Pick an available slot' : 'Select a doctor first'}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {timeSlots
                    // Hide slots whose time has already passed today; keep the
                    // currently selected one visible (e.g. while editing).
                    .filter((s) => !s.past || s.label === form.timeSlot)
                    .map((s) => {
                      const selected = form.timeSlot === s.label;
                      const disabled = !s.available || isLoadingSlots;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => {
                            if (disabled) return;
                            setForm((prev) => ({ ...prev, timeSlot: s.label }));
                            setErrors((prev) => ({ ...prev, timeSlot: undefined }));
                          }}
                          disabled={disabled}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            borderColor: selected ? '#1d4ed8' : '#e5e7eb',
                            background: selected ? '#dbeafe' : '#f9fafb',
                            color: selected ? '#1d4ed8' : '#64748b',
                            textDecoration: !s.available ? 'line-through' : 'none',
                          }}
                          title={s.booked ? 'Already booked' : !s.available ? 'Unavailable' : 'Available'}
                        >
                          <MdAccessTime className="w-3.5 h-3.5" /> {s.label}
                        </button>
                      );
                    })}
                  {!isLoadingSlots &&
                  form.doctorId &&
                  timeSlots.filter((s) => !s.past || s.label === form.timeSlot).length === 0 ? (
                    <p className="text-xs text-gray-500">{slotsMessage || 'No slots available.'}</p>
                  ) : null}
                </div>
                {errors.timeSlot ? <p className="text-xs text-red-600 font-semibold mt-2">{errors.timeSlot}</p> : null}
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Reason / Symptoms (optional)</label>
                <textarea
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Short notes for doctor..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Token / Queue */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <MdBadge className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Token / Queue</p>
                  <p className="text-xs text-gray-500 mt-0.5">Auto-generated for the visit</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-500">Token Number</p>
                  <p className="text-sm font-extrabold text-gray-800 font-mono">{tokenPreview}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-500">Queue Position</p>
                  <p className="text-sm font-extrabold text-gray-800 font-mono">{queuePosition}</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
              </p>
            </div>

            {/* Billing */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <MdPayments className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Billing</p>
                  <p className="text-xs text-gray-500 mt-0.5">Consultation payment snapshot</p>
                </div>
              </div>

              {selectedPatient?.isAyushman ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                  {AYUSHMAN_BILLING_NOTICE}
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Consultation Fee</label>
                  <input
                    name="fee"
                    value={form.fee}
                    onChange={handleChange}
                    className={inputCls}
                    inputMode="numeric"
                    placeholder="e.g. 500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Payment Mode</label>
                  {selectedPatient?.isAyushman ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-extrabold text-emerald-900">
                      {AYUSHMAN_PAYMENT_LABEL}
                    </p>
                  ) : (
                    <select name="paymentMode" value={form.paymentMode} onChange={handleChange} className={inputCls}>
                      {['Cash', 'UPI', 'Card'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Payment Status</label>
                  {selectedPatient?.isAyushman ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-extrabold text-emerald-900">Paid</p>
                  ) : (
                  <select
                    name="paymentStatus"
                    value={form.paymentStatus}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    {['Paid', 'Pending'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  )}
                  {errors.paymentStatus ? <p className="text-xs text-red-600 font-semibold mt-1.5">{errors.paymentStatus}</p> : null}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={openConfirm}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:-translate-y-0.5 shadow hover:shadow-md disabled:opacity-50"
                  style={{ backgroundColor: '#0077B6' }}
                  disabled={isLoadingDoctors || isLoadingSlots}
                >
                  <MdSave className="w-4 h-4" /> Confirm Appointment
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  <MdRefresh className="w-4 h-4" /> Reset Form
                </button>
              </div>

              {selectedPatient ? (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/reception/appointments')}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  View All Appointments
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </form>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Appointment confirmation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (submitLoading) return;
              setConfirmOpen(false);
              setSuccess(null);
              setSubmitError('');
            }}
            aria-label="Close"
          />

          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">
                  {success ? 'Appointment booked' : isEditMode ? 'Confirm update' : 'Confirm booking'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {success ? 'Success details are below.' : 'Please verify the details before confirming.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (submitLoading) return;
                  setConfirmOpen(false);
                  setSuccess(null);
                  setSubmitError('');
                }}
                className="p-2 rounded-xl hover:bg-gray-50 transition text-gray-600"
                title="Close"
              >
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {success ? (
                <div
                  className="rounded-2xl p-4 text-white shadow-sm border border-blue-900/10"
                  style={{ backgroundColor: '#0f2d5e' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <MdCheckCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-extrabold">Success</p>
                      <p className="text-xs text-blue-100 mt-0.5">
                        Token generated. Please guide the patient to the waiting area.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="bg-white/10 rounded-xl px-3 py-2">
                          <p className="text-[10px] font-semibold text-blue-100">Token</p>
                          <p className="font-mono font-extrabold">{success.token || '—'}</p>
                        </div>
                        <div className="bg-white/10 rounded-xl px-3 py-2">
                          <p className="text-[10px] font-semibold text-blue-100">OPD No</p>
                          <p className="font-mono font-extrabold">{success.opdNumber || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { k: 'Patient', v: selectedPatient?.name || '—' },
                      { k: 'UHID', v: selectedPatient?.uhid || '—', mono: true },
                      { k: 'Department', v: form.department || '—' },
                      { k: 'Doctor', v: form.doctorName || '—' },
                      { k: 'Date', v: form.date || '—', mono: true },
                      { k: 'Time Slot', v: form.timeSlot || '—' },
                      { k: 'Fee', v: form.fee || String(DEFAULT_FEE), mono: true },
                      { k: 'Payment', v: `${form.paymentMode || '—'} • ${form.paymentStatus || '—'}` },
                    ].map((x) => (
                      <div key={x.k} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-gray-500">{x.k}</p>
                        <p className={`text-sm font-extrabold text-gray-800 ${x.mono ? 'font-mono' : ''}`}>{x.v}</p>
                      </div>
                    ))}
                  </div>

                  {submitError ? (
                    <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                      <p className="text-xs font-semibold text-red-700">{submitError}</p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end">
              {success ? (
                <>
                  <button
                    type="button"
                    onClick={printSlip}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 text-sm font-extrabold text-blue-800 bg-blue-50 hover:bg-blue-100 transition"
                    title="Print OPD slip"
                  >
                    Print Slip
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmOpen(false);
                      resetForm();
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow hover:shadow-md transition"
                    style={{ backgroundColor: '#0077B6' }}
                  >
                    Book Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-extrabold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (submitLoading) return;
                      setConfirmOpen(false);
                      setSubmitError('');
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-extrabold text-gray-700 hover:bg-gray-50 transition"
                    disabled={submitLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitAppointment}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow hover:shadow-md transition disabled:opacity-60"
                    style={{ backgroundColor: '#0077B6' }}
                    disabled={submitLoading}
                  >
                    {submitLoading ? 'Saving…' : isEditMode ? 'Confirm Update' : 'Confirm Booking'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

