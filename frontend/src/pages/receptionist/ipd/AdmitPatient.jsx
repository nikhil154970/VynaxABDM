import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  MdArrowBack,
  MdSearch,
  MdBed,
  MdPerson,
  MdPhone,
  MdSave,
  MdCheckCircle,
  MdAdd,
  MdRefresh,
  MdLocalHospital,
  MdPayments,
  MdAssignment,
  MdMedicalServices,
  MdChevronRight,
} from 'react-icons/md';
import '../patients/PatientList.css';
import { DEPARTMENTS } from '../../../constants/departments';
import api from '../../../utils/api';
import {
  isAyushmanSponsor,
  AYUSHMAN_BILLING_NOTICE,
  AYUSHMAN_PAYMENT_LABEL,
  sponsorDisplayLabel,
} from '../../../utils/ayushmanBilling';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const MOCK_PATIENTS = [
  { patientId: 'PAT-001', uhid: 'UH202604180123', name: 'Ravi Kumar', mobile: '9876543210', age: '34', gender: 'Male' },
  { patientId: 'PAT-002', uhid: 'UH202604180124', name: 'Priya Singh', mobile: '9123456780', age: '28', gender: 'Female' },
  { patientId: 'PAT-003', uhid: 'UH202604170987', name: 'Mohan Das', mobile: '9988776655', age: '52', gender: 'Male' },
  { patientId: 'PAT-004', uhid: 'UH202604160555', name: 'Sunita Gupta', mobile: '8877665544', age: '45', gender: 'Female' },
];

const DOCTORS_BY_DEPT = {
  'General Medicine': [
    { id: 'D001', name: 'Dr. Sharma' },
    { id: 'D002', name: 'Dr. Khan' },
  ],
  Orthopedics: [
    { id: 'D004', name: 'Dr. Mehta' },
    { id: 'D005', name: 'Dr. Yadav' },
  ],
  Gynecology: [
    { id: 'D006', name: 'Dr. Singh' },
    { id: 'D007', name: 'Dr. Gupta' },
  ],
  Pediatrics: [
    { id: 'D008', name: 'Dr. Roy' },
  ],
  Cardiology: [
    { id: 'D010', name: 'Dr. Joshi' },
    { id: 'D011', name: 'Dr. Kapoor' },
  ],
  ENT: [
    { id: 'D014', name: 'Dr. Chatterjee' },
  ],
};

const INITIAL_WARDS = [];

/** Room charge hint by admission type (mock — backend will return real tariffs) */
const ROOM_CHARGE_BY_TYPE = {
  'General Ward': 1200,
  ICU: 8500,
  'Private Room': 4500,
};

/** Not a DB id: loads all available beds; on submit the real wardId comes from the selected bed. */
const UNIVERSAL_DUMMY_WARD_ID = '__universal_default_ward__';
const ALL_BEDS_OPTION_LABEL = 'All beds';

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-xs font-extrabold text-gray-600 mb-1.5">
      {label}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
    {children}
    {hint ? <p className="text-[11px] text-gray-400 mt-1">{hint}</p> : null}
  </div>
);

const selectCls = 'pl-select w-full';

function AdmitSection({ icon: Icon, title, subtitle, headerRight, children, noBodyPadding, hideHeader }) {
  return (
    <div className="overflow-visible rounded-none border-x-0 border-y border-gray-100 bg-white shadow-sm sm:rounded-2xl sm:border sm:border-gray-100">
      {!hideHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-[#f8faff] via-white to-slate-50/40 px-3 py-3.5 sm:px-5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-50 text-blue-700 border border-blue-100/90 shadow-sm">
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">{title}</h3>
              {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
            </div>
          </div>
          {headerRight}
        </div>
      ) : null}
      <div className={noBodyPadding ? '' : 'px-3 py-4 sm:px-4 sm:py-5'}>{children}</div>
    </div>
  );
}

function AdmitWorkflowStrip({ patientSelected }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 via-white to-slate-50/50 px-3 py-3 sm:px-4 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700/80 mb-1">Standard workflow</p>
      <p className="text-xs sm:text-sm text-gray-700 font-medium leading-snug">
        <span className="text-gray-900 font-extrabold">Patient lookup</span>
        <span className="mx-1.5 text-gray-300">→</span>
        <span className="text-gray-800">Admission</span>
        <span className="mx-1.5 text-gray-300">→</span>
        <span className="text-gray-800">Bed</span>
        <span className="mx-1.5 text-gray-300">→</span>
        <span className="text-gray-800">Clinical</span>
        <span className="mx-1.5 text-gray-300">→</span>
        <span className="text-gray-800">Billing</span>
      </p>
      <p className={`text-[11px] mt-2 font-semibold ${patientSelected ? 'text-emerald-700' : 'text-gray-500'}`}>
        {patientSelected
          ? 'Patient selected — complete the sections below.'
          : 'Search any patient, or pick one from “Doctor referred for IPD” below.'}
      </p>
    </div>
  );
}

function enrichPatientRow(p) {
  const sponsor = p?.sponsor || '';
  const isAyushman = p?.isAyushman === true || isAyushmanSponsor(sponsor);
  return {
    patientId: p?.patientId || p?.id || null,
    uhid: p?.uhid || '',
    name: p?.name || '',
    mobile: p?.mobile || p?.phone || '',
    age: p?.age ?? '',
    gender: p?.gender || '',
    sponsor,
    isAyushman,
  };
}

async function resolvePatientWithSponsor(p) {
  let row = enrichPatientRow(p);
  if (!row.uhid) return row;
  try {
    const res = await api.get(`/receptionist/patients/${encodeURIComponent(row.uhid)}/details`);
    const d = res?.data || {};
    const sponsor = d.sponsor || row.sponsor || '';
    return enrichPatientRow({
      ...row,
      sponsor,
      isAyushman: d.isAyushman === true || isAyushmanSponsor(sponsor),
    });
  } catch {
    return row;
  }
}

function applyAyushmanAdmitBilling(prev) {
  return {
    ...prev,
    paymentMode: AYUSHMAN_PAYMENT_LABEL,
    paymentStatus: 'Paid',
  };
}

const apiClient = {
  async fetchPatientSuggestions(query) {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    const res = await api.get('/receptionist/patients/search', { params: { q } });
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    return items.slice(0, 8).map((p) => enrichPatientRow(p));
  },
  async fetchDoctors() {
    const res = await api.get('/doctors/lookup');
    const items = Array.isArray(res?.data?.items) ? res.data.items : Array.isArray(res?.data) ? res.data : [];
    return items
      .map((d) => ({ id: d.id, name: d.name || d.user?.name || '', specialization: d.specialization || '' }))
      .filter((d) => d.id && d.name);
  },
  async fetchNurses() {
    const res = await api.get('/receptionist/ipd/nurses');
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    return items
      .map((n) => ({ id: n.id, name: n.name || n.email || 'Nurse' }))
      .filter((n) => n.id);
  },
  async fetchWards() {
    const res = await api.get('/receptionist/ipd/wards');
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    return items.map((w) => ({
      id: w.id,
      name: w.name,
      admissionType: w.type === 'ICU' ? 'ICU' : w.type === 'PRIVATE' ? 'Private Room' : 'General Ward',
      type: w.type,
    }));
  },
  async fetchBeds(wardId) {
    const params = { status: 'AVAILABLE' };
    if (wardId && wardId !== UNIVERSAL_DUMMY_WARD_ID) params.wardId = wardId;
    const res = await api.get('/receptionist/ipd/beds', { params });
    const items = Array.isArray(res?.data?.items) ? res.data.items : [];
    return items.map((b) => ({
      id: b.id,
      code: b.code,
      status: String(b.status || '').toLowerCase() === 'available' ? 'available' : 'occupied',
      wardId: b.wardId || '',
      wardName: b.wardName || '',
    }));
  },
  async createAdmission(payload) {
    const res = await api.post('/receptionist/ipd/admissions', payload);
    return res?.data?.admission;
  },
  async fetchPendingReferrals() {
    const res = await api.get('/receptionist/ipd/referrals/pending-admit');
    return Array.isArray(res?.data?.items) ? res.data.items : [];
  },
  async markReferralFulfilled() {
    return { ok: true };
  },
};

export default function AdmitPatient() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const todayISO = toISODate(new Date());
  const prefillDoctorIdRef = useRef(null);
  const detailsRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [nurses, setNurses] = useState([]);
  const [loadingNurses, setLoadingNurses] = useState(false);

  const [beds, setBeds] = useState([]);
  const [wards, setWards] = useState(INITIAL_WARDS);
  const [loadingBeds, setLoadingBeds] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(null);

  const [pendingReferrals, setPendingReferrals] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  /** Set when user picks a row from doctor-referral queue (cleared on reset / after admit) */
  const [activeReferralId, setActiveReferralId] = useState(null);

  const [form, setForm] = useState({
    admissionType: 'General Ward',
    department: '',
    doctorId: '',
    doctorName: '',
    nurseId: '',
    admissionDate: todayISO,
    expectedStay: '',
    wardId: UNIVERSAL_DUMMY_WARD_ID,
    bedId: '',
    diagnosis: '',
    notes: '',
    emergencyName: '',
    emergencyPhone: '',
    admissionCharge: '2500',
    roomCharge: String(ROOM_CHARGE_BY_TYPE['General Ward']),
    advance: '',
    paymentMode: 'Cash',
    paymentStatus: 'Pending',
    status: 'Admitted',
  });

  const fetchPatientSuggestions = useCallback(async (q) => {
    setLoadingSuggestions(true);
    try {
      const list = await apiClient.fetchPatientSuggestions(q);
      setSuggestions(list);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const fetchDoctors = useCallback(async (department) => {
    setLoadingDoctors(true);
    try {
      const list = await apiClient.fetchDoctors();
      const dept = String(department || '').trim();
      setDoctors(dept ? list.filter((d) => String(d.specialization || '').trim() === dept) : list);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  const fetchNurses = useCallback(async () => {
    setLoadingNurses(true);
    try {
      const list = await apiClient.fetchNurses();
      setNurses(list);
    } finally {
      setLoadingNurses(false);
    }
  }, []);

  const fetchBeds = useCallback(async (wardId) => {
    if (!wardId) {
      setBeds([]);
      return;
    }
    setLoadingBeds(true);
    try {
      const list = await apiClient.fetchBeds(wardId);
      setBeds(list);
    } finally {
      setLoadingBeds(false);
    }
  }, []);

  const fetchPendingReferrals = useCallback(async () => {
    setLoadingPending(true);
    try {
      const list = await apiClient.fetchPendingReferrals();
      setPendingReferrals(list);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingReferrals();
  }, [fetchPendingReferrals]);

  useEffect(() => {
    fetchNurses();
  }, [fetchNurses]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await apiClient.fetchWards();
        if (alive && Array.isArray(list) && list.length) setWards(list);
      } catch {
        // keep empty list fallback; use only real Bed Management wards
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => fetchPatientSuggestions(q), 250);
    return () => clearTimeout(t);
  }, [searchQuery, fetchPatientSuggestions]);

  useEffect(() => {
    if (!selectedPatient) return;
    const el = detailsRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => clearTimeout(t);
  }, [selectedPatient]);

  const selectPatient = useCallback(async (p) => {
    if (!p?.uhid && !p?.name) return;
    const row = await resolvePatientWithSponsor(p);
    setSelectedPatient(row);
    setSearchQuery(`${row.name || ''} · ${row.uhid || ''}`.trim());
    setDropdownOpen(false);
    if (row.isAyushman) {
      setForm((prev) => applyAyushmanAdmitBilling(prev));
    }
  }, []);

  useEffect(() => {
    const applyPatient = async (p) => {
      if (!p?.uhid && !p?.name) return;
      await selectPatient(p);
    };

    const fromState = location?.state?.prefillPatient;
    const adm = location?.state?.prefillAdmission;
    if (fromState) void applyPatient(fromState);
    if (adm?.department) {
      prefillDoctorIdRef.current = adm.doctorId || null;
      setForm((prev) => ({ ...prev, department: adm.department }));
    }

    const uhidQ = searchParams.get('uhid');
    if (!fromState && uhidQ) {
      let cancelled = false;
      (async () => {
        try {
          const res = await api.get(`/receptionist/patients/${encodeURIComponent(uhidQ)}/details`);
          const d = res?.data;
          if (cancelled || !d) return;
          void applyPatient({
            id: d.id,
            patientId: d.id,
            uhid: d.uhid,
            name: d.name,
            mobile: d.phone || '',
            age: d.age ?? '',
            gender: d.gender || '',
            sponsor: d.sponsor || '',
            isAyushman: d.isAyushman,
          });
          if (d.department) {
            prefillDoctorIdRef.current = null;
            setForm((prev) => ({ ...prev, department: d.department }));
          }
        } catch {
          // leave form empty if lookup fails
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.department) {
      setDoctors([]);
      setForm((prev) => ({ ...prev, doctorId: '', doctorName: '' }));
      return;
    }
    let active = true;
    (async () => {
      const all = await apiClient.fetchDoctors();
      if (!active) return;
      const dept = String(form.department || '').trim();
      const list = dept ? all.filter((d) => String(d.specialization || '').trim() === dept) : all;
      setDoctors(list);
      const preId = prefillDoctorIdRef.current;
      if (preId && list.some((d) => d.id === preId)) {
        const doc = list.find((d) => d.id === preId);
        setForm((prev) => ({ ...prev, doctorId: preId, doctorName: doc?.name || '' }));
        prefillDoctorIdRef.current = null;
      } else {
        setForm((prev) => ({ ...prev, doctorId: '', doctorName: '' }));
      }
    })();
    return () => {
      active = false;
    };
  }, [form.department]);

  useEffect(() => {
    if (!form.wardId) {
      setBeds([]);
      setForm((prev) => ({ ...prev, bedId: '' }));
      return;
    }
    let active = true;
    (async () => {
      await fetchBeds(form.wardId);
      if (!active) return;
      setForm((prev) => ({ ...prev, bedId: '' }));
    })();
    return () => {
      active = false;
    };
  }, [form.wardId, fetchBeds]);

  const wardsForAdmissionType = useMemo(() => {
    const universal = {
      id: UNIVERSAL_DUMMY_WARD_ID,
      name: ALL_BEDS_OPTION_LABEL,
      admissionType: form.admissionType,
    };
    // Match Bed Management behavior: keep an "All beds" option and show every active ward.
    return [universal, ...wards];
  }, [wards, form.admissionType]);

  useEffect(() => {
    const rc = ROOM_CHARGE_BY_TYPE[form.admissionType] ?? ROOM_CHARGE_BY_TYPE['General Ward'];
    setForm((prev) => {
      let next = { ...prev, roomCharge: String(rc), wardId: UNIVERSAL_DUMMY_WARD_ID, bedId: '' };
      if (selectedPatient?.isAyushman) next = applyAyushmanAdmitBilling(next);
      return next;
    });
  }, [form.admissionType, selectedPatient?.isAyushman]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (selectedPatient?.isAyushman && (name === 'paymentMode' || name === 'paymentStatus')) {
      setForm((prev) => applyAyushmanAdmitBilling(prev));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSelectPendingReferral = async (row) => {
    prefillDoctorIdRef.current = row.doctorId || null;
    const types = ['General Ward', 'ICU', 'Private Room'];
    const at =
      row.suggestedAdmissionType && types.includes(row.suggestedAdmissionType) ? row.suggestedAdmissionType : 'General Ward';
    const rc = ROOM_CHARGE_BY_TYPE[at] ?? ROOM_CHARGE_BY_TYPE['General Ward'];

    const patientRow = await resolvePatientWithSponsor(row);

    setForm((prev) => {
      const base = {
        ...prev,
        admissionType: at,
        department: row.department || '',
        diagnosis: row.provisionalDiagnosis || '',
        notes: row.clinicalNote || prev.notes,
        roomCharge: String(rc),
        wardId: UNIVERSAL_DUMMY_WARD_ID,
        bedId: '',
        admissionDate: prev.admissionDate || todayISO,
      };
      return patientRow.isAyushman ? applyAyushmanAdmitBilling(base) : base;
    });

    setSelectedPatient(patientRow);
    setSearchQuery(`${row.name} · ${row.uhid}`);
    setDropdownOpen(false);
    setActiveReferralId(row.referralId);
    setErrors((e) => ({ ...e, patient: undefined }));
  };

  const handleAdmitFromReferral = (row) => {
    handleSelectPendingReferral(row);
  };

  const validate = () => {
    const next = {};
    if (!selectedPatient?.uhid) next.patient = 'Select a patient';
    if (!form.admissionType) next.admissionType = 'Required';
    if (!form.department) next.department = 'Required';
    if (!form.doctorId) next.doctorId = 'Required';
    if (!form.nurseId) next.nurseId = 'Required';
    if (!form.admissionDate) next.admissionDate = 'Required';
    if (!form.wardId) next.wardId = 'Required';
    if (!form.bedId) next.bedId = 'Select a bed';
    if (!form.diagnosis?.trim()) next.diagnosis = 'Required';
    if (!form.emergencyName?.trim()) next.emergencyName = 'Required';
    if (!form.emergencyPhone?.trim() || String(form.emergencyPhone).length < 10) next.emergencyPhone = 'Valid phone required';
    if (!form.admissionCharge?.trim() && form.admissionCharge !== '0') next.admissionCharge = 'Required';
    if (!selectedPatient?.isAyushman && !form.advance?.trim() && form.advance !== '0') next.advance = 'Required';
    return next;
  };

  const resetForm = () => {
    setErrors({});
    setSuccess(null);
    prefillDoctorIdRef.current = null;
    setActiveReferralId(null);
    setSelectedPatient(null);
    setSearchQuery('');
    setSuggestions([]);
    setDropdownOpen(false);
    setDoctors([]);
    setBeds([]);
    fetchPendingReferrals();
    setForm({
      admissionType: 'General Ward',
      department: '',
      doctorId: '',
      doctorName: '',
      nurseId: '',
      admissionDate: todayISO,
      expectedStay: '',
      wardId: UNIVERSAL_DUMMY_WARD_ID,
      bedId: '',
      diagnosis: '',
      notes: '',
      emergencyName: '',
      emergencyPhone: '',
      admissionCharge: '2500',
      roomCharge: String(ROOM_CHARGE_BY_TYPE['General Ward']),
      advance: '',
      paymentMode: 'Cash',
      paymentStatus: 'Pending',
      status: 'Admitted',
    });
  };

  const handleAdmitPatient = async (e) => {
    e.preventDefault();
    setErrors({});
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const doctor = doctors.find((d) => d.id === form.doctorId);
    const bed = beds.find((b) => b.id === form.bedId);
    const ward = wards.find((w) => w.id === form.wardId);
    const effectiveWardId =
      form.wardId === UNIVERSAL_DUMMY_WARD_ID ? String(bed?.wardId || '').trim() : form.wardId;

    setSubmitting(true);
    try {
      const admissionPayload = {
        uhid: selectedPatient.uhid,
        doctorId: form.doctorId,
        nurseId: form.nurseId,
        department: form.department,
        admissionType: form.admissionType,
        admissionDate: form.admissionDate,
        wardId: effectiveWardId,
        bedId: form.bedId,
        status: 'ADMITTED',
        billing: {
          admissionCharge: Number(form.admissionCharge || 0),
          roomChargePerDay: Number(form.roomCharge || 0),
          advance: Number(form.advance || 0),
          paymentMode: selectedPatient.isAyushman ? AYUSHMAN_PAYMENT_LABEL : form.paymentMode,
          paymentStatus: selectedPatient.isAyushman ? 'PAID' : form.paymentStatus || 'PENDING',
        },
      };

      const created = await apiClient.createAdmission(admissionPayload);

      if (activeReferralId) {
        await apiClient.markReferralFulfilled(activeReferralId);
        setPendingReferrals((prev) => prev.filter((r) => r.referralId !== activeReferralId));
        setActiveReferralId(null);
      }
      await fetchPendingReferrals();

      setSuccess({
        ipdId: created?.ipdNumber || created?.id,
        patientName: selectedPatient.name,
        ward: ward?.name || bed?.wardName || 'All active wards',
        bed: bed?.code,
        doctor: doctor?.name,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBed = beds.find((b) => b.id === form.bedId);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100/80 to-gray-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-slate-200/50">
          <div className="h-1.5 bg-gradient-to-r from-[#0f2d5e] via-[#1d4ed8] to-[#059669]" />
          <div className="px-6 sm:px-8 pt-8 pb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-green-50 ring-4 ring-emerald-100/50">
              <MdCheckCircle className="h-9 w-9 text-emerald-600" />
            </div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Admission successful</p>
            <h2 className="mt-1 text-xl font-extrabold text-gray-900">IPD record created</h2>
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{success.patientName}</span> is admitted.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-left">
              <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2 text-sm first:pt-0">
                <span className="text-gray-500">IPD ID</span>
                <span className="font-mono font-bold text-blue-700">{success.ipdId}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2 text-sm">
                <span className="text-gray-500">Ward</span>
                <span className="font-semibold text-gray-900">{success.ward}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-200/80 py-2 text-sm">
                <span className="text-gray-500">Bed</span>
                <span className="font-mono font-semibold text-gray-900">{success.bed}</span>
              </div>
              <div className="flex justify-between gap-4 py-2 text-sm last:pb-0">
                <span className="text-gray-500">Doctor</span>
                <span className="font-semibold text-gray-900">{success.doctor}</span>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/dashboard/reception/ipd')}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50"
              >
                View active IPD
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccess(null);
                  resetForm();
                }}
                className="flex-1 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1a4a8a 55%, #1d4ed8 100%)' }}
              >
                Admit another patient
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 bg-gradient-to-b from-slate-100/50 to-gray-50">
      <form
        onSubmit={handleAdmitPatient}
        className="w-full max-w-none min-w-0 space-y-4 py-4 sm:py-5 px-0 sm:px-2 lg:px-3 pb-28 sm:pb-14"
      >
        <AdmitSection
          icon={MdPerson}
          title="Patient selection"
          subtitle="Search manually, or choose a patient referred by doctor from the table below"
          headerRight={errors.patient ? <span className="text-xs font-extrabold text-red-600">{errors.patient}</span> : null}
          noBodyPadding
          hideHeader
        >
          <div className="w-full space-y-0">
          <div className="relative z-30 w-full px-3 pt-4 sm:px-4 sm:pt-5">
            <div className="flex items-center gap-3 w-full min-w-0">
              <div className="relative flex-1 min-w-0 max-w-3xl">
                <MdSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Search by Name / UHID / Mobile (min 2 chars)"
                  className="w-full min-w-0 pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={Boolean(selectedPatient)}
                />
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/reception/patients/register')}
                className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-sm transition hover:shadow-md whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #0d6ebd)' }}
                title="Register new patient"
              >
                <MdAdd className="h-4 w-4" /> New patient
              </button>
            </div>
            {dropdownOpen && !selectedPatient && searchQuery.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 z-[100] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-200/80 bg-white shadow-xl shadow-slate-200/40 ring-1 ring-black/5">
                <div className="flex justify-between border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-4 py-2 text-[11px] font-extrabold text-gray-500">
                  <span>{loadingSuggestions ? 'Searching…' : `${suggestions.length} match(es)`}</span>
                  <button type="button" className="font-extrabold text-blue-700 hover:text-blue-900" onClick={() => setDropdownOpen(false)}>
                    Close
                  </button>
                </div>
                {loadingSuggestions ? (
                  <div className="px-4 py-6 text-sm text-gray-400 text-center">Loading suggestions…</div>
                ) : suggestions.length ? (
                  suggestions.map((p) => (
                    <button
                      key={p.uhid}
                      type="button"
                      onClick={async () => {
                        prefillDoctorIdRef.current = null;
                        setActiveReferralId(null);
                        await selectPatient(p);
                        setErrors((e) => ({ ...e, patient: undefined }));
                      }}
                      className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-0 hover:bg-blue-50/60"
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <MdPerson className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 truncate font-mono font-bold text-blue-600">{p.uhid}</p>
                        <p className="text-xs text-gray-500">
                          <MdPhone className="inline w-3 h-3" /> {p.mobile} · {p.age} yrs · {p.gender}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-gray-500 text-center">No patients found</div>
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-6 w-full border-t border-gray-100">
            <div className="mb-3 flex w-full flex-wrap items-start justify-between gap-3 px-3 pt-4 sm:px-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <MdMedicalServices className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">Doctor referred for IPD</p>
                  <p className="text-xs text-gray-500">
                    
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchPendingReferrals()}
                disabled={loadingPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                <MdRefresh className={`h-4 w-4 ${loadingPending ? 'animate-spin' : ''}`} />
                Refresh list
              </button>
            </div>

            <div className="w-full overflow-x-auto border-y border-gray-200/90 bg-white shadow-inner sm:rounded-b-2xl sm:border-x sm:border-gray-200/90">
              <table className="w-full min-w-[1040px] table-auto text-left text-sm">
                <thead>
                  <tr className="sticky top-0 z-[1] border-b border-gray-200 bg-[#f8faff] text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3 lg:px-4">Patient</th>
                    <th className="px-3 py-3 lg:w-[140px]">UHID</th>
                    <th className="hidden px-3 py-3 sm:table-cell lg:w-[100px]">Age / Sex</th>
                    <th className="hidden px-3 py-3 md:table-cell lg:w-[120px]">Mobile</th>
                    <th className="px-3 py-3 lg:w-[140px]">Department</th>
                    <th className="hidden px-3 py-3 md:table-cell lg:w-[120px]">Suggested</th>
                    <th className="hidden px-3 py-3 lg:table-cell lg:w-[110px]">Referred by</th>
                    <th className="hidden px-3 py-3 lg:table-cell lg:w-[120px]">Consultant by</th>
                    <th className="px-3 py-3 lg:w-[100px]">Date</th>
                    <th className="px-3 py-3 text-right lg:w-[120px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingPending ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                        Loading doctor referrals…
                      </td>
                    </tr>
                  ) : pendingReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                        No pending referrals right now. Use search above or ask the doctor to mark “Admit” from their portal.
                      </td>
                    </tr>
                  ) : (
                    pendingReferrals.map((row) => {
                      const isActive = activeReferralId === row.referralId;
                      return (
                        <tr
                          key={row.referralId}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectPendingReferral(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectPendingReferral(row);
                            }
                          }}
                          className={`cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            isActive ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-200/60' : 'hover:bg-slate-50/90'
                          }`}
                        >
                          <td className="px-3 py-3 align-top lg:px-4">
                            <p className="font-extrabold text-gray-900">{row.name}</p>
                          </td>
                          <td className="px-3 py-3 align-top font-mono text-xs font-semibold text-gray-800">{row.uhid}</td>
                          <td className="hidden px-3 py-3 align-top text-xs text-gray-600 sm:table-cell">
                            {row.age} · {row.gender}
                          </td>
                          <td className="hidden px-3 py-3 align-top font-mono text-xs text-gray-600 md:table-cell">{row.mobile}</td>
                          <td className="px-3 py-3 align-top text-xs font-semibold text-gray-800">{row.department}</td>
                          <td className="hidden px-3 py-3 align-top text-xs md:table-cell">
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                              {row.suggestedAdmissionType || 'General Ward'}
                            </span>
                          </td>
                          <td className="hidden px-3 py-3 align-top text-xs text-gray-700 lg:table-cell">
                            {row.referBy?.trim() ? row.referBy : '—'}
                          </td>
                          <td className="hidden px-3 py-3 align-top text-xs font-semibold text-gray-800 lg:table-cell">
                            {row.consultantBy || row.referringDoctor || '—'}
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-gray-600">{formatShortDate(row.requestedAt)}</td>
                          <td className="px-3 py-3 align-middle text-right">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdmitFromReferral(row);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-extrabold text-blue-800 transition hover:bg-blue-100"
                              >
                                Admit
                                <MdChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
      
          </div>

          {selectedPatient ? (
            <div className="mx-3 mb-4 mt-4 rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/90 to-indigo-50/30 p-4 sm:mx-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-sm">
                    <MdPerson className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-extrabold text-gray-900">{selectedPatient.name}</p>
                      {selectedPatient.isAyushman ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                          Ayushman
                        </span>
                      ) : null}
                      {activeReferralId ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                          Doctor referral
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 font-mono text-xs font-bold text-blue-700">{selectedPatient.uhid}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {selectedPatient.age} yrs · {selectedPatient.gender} · <MdPhone className="inline h-3 w-3" />{' '}
                      {selectedPatient.mobile}
                    </p>
                    {selectedPatient.isAyushman ? (
                      <p className="mt-1 text-xs font-semibold text-emerald-800">
                        Patient Type: Ayushman · Sponsor: Ayushman — {AYUSHMAN_PAYMENT_LABEL}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    prefillDoctorIdRef.current = null;
                    setActiveReferralId(null);
                    setSelectedPatient(null);
                    setSearchQuery('');
                  }}
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-extrabold text-blue-800 shadow-sm transition hover:bg-blue-50"
                >
                  Change
                </button>
              </div>
            </div>
          ) : null}
          </div>
        </AdmitSection>

        {selectedPatient ? (
          <>
            <div ref={detailsRef} />
            <AdmitSection icon={MdLocalHospital} title="Admission details" subtitle="Type, department, consultant & dates">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Admission type" required>
                  <select name="admissionType" value={form.admissionType} onChange={handleChange} className={selectCls}>
                    {['General Ward', 'ICU', 'Private Room'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Department" required>
                  <select name="department" value={form.department} onChange={handleChange} className={selectCls}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {errors.department ? <p className="mt-1 text-xs font-bold text-red-600">{errors.department}</p> : null}
                </Field>
                <Field label="Doctor" required>
                  <select
                    name="doctorId"
                    value={form.doctorId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const d = doctors.find((x) => x.id === id);
                      setForm((prev) => ({ ...prev, doctorId: id, doctorName: d?.name || '' }));
                      setErrors((er) => ({ ...er, doctorId: undefined }));
                    }}
                    className={selectCls}
                    disabled={!form.department || loadingDoctors}
                  >
                    <option value="">{!form.department ? 'Select department first' : loadingDoctors ? 'Loading…' : 'Select doctor'}</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {errors.doctorId ? <p className="mt-1 text-xs font-bold text-red-600">{errors.doctorId}</p> : null}
                </Field>
                <Field label="Assigned nurse" required>
                  <select name="nurseId" value={form.nurseId} onChange={handleChange} className={selectCls} disabled={loadingNurses}>
                    <option value="">{loadingNurses ? 'Loading…' : 'Select nurse'}</option>
                    {nurses.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                  {errors.nurseId ? <p className="mt-1 text-xs font-bold text-red-600">{errors.nurseId}</p> : null}
                </Field>
                <Field label="Admission date" required>
                  <input name="admissionDate" type="date" value={form.admissionDate} onChange={handleChange} className={inputCls} />
                </Field>
                <Field label="Expected stay (days)" hint="Optional">
                  <input name="expectedStay" value={form.expectedStay} onChange={handleChange} className={inputCls} placeholder="e.g. 3" inputMode="numeric" />
                </Field>
              </div>
            </AdmitSection>

            <AdmitSection
              icon={MdBed}
              title="Bed allocation"
              subtitle="Choose ward, then an available bed"
              headerRight={
                <button
                  type="button"
                  onClick={() => form.wardId && fetchBeds(form.wardId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  disabled={!form.wardId || loadingBeds}
                >
                  <MdRefresh className={`h-4 w-4 ${loadingBeds ? 'animate-spin' : ''}`} /> Refresh
                </button>
              }
            >
              <div className="space-y-4">
                <Field label="Ward" required>
                  <select
                    name="wardId"
                    value={form.wardId}
                    onChange={(e) => {
                      handleChange(e);
                      setForm((prev) => ({ ...prev, bedId: '' }));
                    }}
                    className={selectCls}
                  >
                    <option value="">Select ward</option>
                    {wardsForAdmissionType.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  {errors.wardId ? <p className="mt-1 text-xs font-bold text-red-600">{errors.wardId}</p> : null}
                </Field>

                <div>
                  <p className="mb-2 text-xs font-extrabold text-gray-600">Select bed</p>
                  {loadingBeds ? (
                    <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">Loading bed map…</div>
                  ) : form.wardId ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {beds.map((b) => {
                        const disabled = b.status === 'occupied';
                        const selected = form.bedId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setForm((prev) => ({ ...prev, bedId: b.id }));
                              setErrors((er) => ({ ...er, bedId: undefined }));
                            }}
                            className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-extrabold transition ${
                              disabled
                                ? 'cursor-not-allowed border-red-200 bg-red-50/80 text-red-400 line-through'
                                : selected
                                  ? 'scale-[1.02] border-blue-600 bg-blue-600 text-white shadow-md'
                                  : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:border-emerald-400'
                            }`}
                            title={disabled ? 'Occupied' : 'Available'}
                          >
                            {b.code}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Select a ward to load beds.</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> Available
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded border border-red-200 bg-red-50" /> Occupied
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded bg-blue-600" /> Selected
                    </span>
                  </div>
                  {errors.bedId ? <p className="mt-2 text-xs font-bold text-red-600">{errors.bedId}</p> : null}
                  {selectedBed ? (
                    <p className="mt-2 text-xs text-gray-600">
                      Selected bed: <span className="font-mono font-extrabold text-gray-900">{selectedBed.code}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </AdmitSection>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <AdmitSection icon={MdAssignment} title="Case details" subtitle="Diagnosis and clinical notes">
                <div className="space-y-4">
                  <Field label="Diagnosis / reason for admission" required>
                    <textarea
                      name="diagnosis"
                      value={form.diagnosis}
                      onChange={handleChange}
                      rows={3}
                      className={inputCls}
                      placeholder="Clinical reason / provisional diagnosis"
                    />
                    {errors.diagnosis ? <p className="mt-1 text-xs font-bold text-red-600">{errors.diagnosis}</p> : null}
                  </Field>
                  <Field label="Notes / symptoms" hint="Optional">
                    <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={inputCls} placeholder="Additional notes" />
                  </Field>
                </div>
              </AdmitSection>
              <AdmitSection
                icon={MdPhone}
                title="Emergency contact"
                subtitle="Required for IPD admission"
                headerRight={<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">Important</span>}
              >
                <div className="space-y-4">
                  <Field label="Name" required>
                    <input name="emergencyName" value={form.emergencyName} onChange={handleChange} className={inputCls} />
                    {errors.emergencyName ? <p className="mt-1 text-xs font-bold text-red-600">{errors.emergencyName}</p> : null}
                  </Field>
                  <Field label="Phone" required>
                    <input name="emergencyPhone" value={form.emergencyPhone} onChange={handleChange} className={inputCls} inputMode="numeric" maxLength={10} />
                    {errors.emergencyPhone ? <p className="mt-1 text-xs font-bold text-red-600">{errors.emergencyPhone}</p> : null}
                  </Field>
                </div>
              </AdmitSection>
            </div>

            <AdmitSection icon={MdPayments} title="Billing setup" subtitle="Charges, advance & payment mode — IPD ID is issued on submit">
              {selectedPatient?.isAyushman ? (
                <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                  {AYUSHMAN_BILLING_NOTICE}
                  <span className="mt-1 block">Charges normal daalein; admit par slip/bill par {AYUSHMAN_PAYMENT_LABEL} — patient se due nahi.</span>
                </p>
              ) : null}
              <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Admission charges (₹)" required>
                    <input
                      name="admissionCharge"
                      value={form.admissionCharge}
                      onChange={handleChange}
                      className={inputCls}
                      inputMode="decimal"
                    />
                    {errors.admissionCharge ? <p className="mt-1 text-xs font-bold text-red-600">{errors.admissionCharge}</p> : null}
                  </Field>
                  <Field label="Room charges / day (₹)" hint="Auto from admission type (editable)">
                    <input
                      name="roomCharge"
                      value={form.roomCharge}
                      onChange={handleChange}
                      className={inputCls}
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="Advance payment (₹)" required={!selectedPatient?.isAyushman}>
                    <input
                      name="advance"
                      value={form.advance}
                      onChange={handleChange}
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="e.g. 5000"
                    />
                    {errors.advance ? <p className="mt-1 text-xs font-bold text-red-600">{errors.advance}</p> : null}
                  </Field>
                  <Field label="Payment mode">
                    {selectedPatient?.isAyushman ? (
                      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-extrabold text-emerald-900">
                        {AYUSHMAN_PAYMENT_LABEL}
                      </p>
                    ) : (
                    <select
                      name="paymentMode"
                      value={form.paymentMode}
                      onChange={handleChange}
                      className={selectCls}
                    >
                        {['Cash', 'UPI', 'Card'].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                    </select>
                    )}
                  </Field>
                </div>
                <p className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-gray-500">
                  Admission status: <span className="font-extrabold text-gray-800">{form.status}</span>
                  {selectedPatient?.isAyushman ? (
                    <>
                      {' '}
                      · <span className="font-extrabold text-emerald-700">{AYUSHMAN_PAYMENT_LABEL}</span>
                    </>
                  ) : null}{' '}
                  · IPD number is generated when you submit.
                </p>
              </div>
            </AdmitSection>

            <div className="sticky bottom-0 z-10 w-full border-t border-gray-200 bg-white/95 px-3 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:px-4">
              <div className="flex w-full max-w-none flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="order-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-extrabold text-gray-600 transition hover:bg-gray-50 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="order-3 rounded-xl border border-gray-200 px-5 py-3 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50 sm:order-2"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="order-1 flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition hover:shadow-lg disabled:opacity-60 sm:order-3 sm:min-w-[240px] sm:flex-none"
                  style={{ background: 'linear-gradient(135deg, #065f46, #059669)' }}
                >
                  <MdSave className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Admit patient'}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}
