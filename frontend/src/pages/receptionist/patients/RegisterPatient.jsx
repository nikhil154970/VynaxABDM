import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MdArrowBack,
  MdBadge,
  MdCalendarToday,
  MdCheckCircle,
  MdLocalHospital,
  MdPerson,
  MdPhone,
  MdRefresh,
  MdSave,
  MdTimer,
  MdVpnKey,
  MdPayments,
} from 'react-icons/md';
import './RegisterPatient.css';
import api from '../../../utils/api';
import { isAyushmanSponsor, AYUSHMAN_PAYMENT_LABEL } from '../../../utils/ayushmanBilling';
import { DEPARTMENTS } from '../../../constants/departments';
import AbhaVerificationModal from '../../../components/abdm/AbhaVerificationModal';
import {
  abdmLinkUserMessage,
  getAbdmErrorMessage,
  getHipPatientStatus,
  linkHipPatient,
  readAbdmLinkState,
  shouldStopAbdmPoll,
} from '../../../services/abdm/abhaService';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
const VISIT_TYPES = ['OPD', 'IPD'];
const PATIENT_STATUSES = ['Waiting', 'Admitted', 'Active', 'Discharged'];
const SPONSOR_OPTIONS = ['GENERAL', 'AYUSHMAN', 'TPA'];
const SPONSOR_LABEL = { GENERAL: 'General Patient', AYUSHMAN: 'Ayushman', TPA: 'TPA' };
const DOCTORS_BY_DEPT = {
  'General Medicine': ['Dr. Sharma', 'Dr. Khan', 'Dr. Verma'],
  Orthopedics: ['Dr. Mehta', 'Dr. Yadav'],
  Gynecology: ['Dr. Singh', 'Dr. Gupta'],
  Pediatrics: ['Dr. Roy', 'Dr. Patel'],
  Cardiology: ['Dr. Joshi', 'Dr. Kapoor'],
  Dermatology: ['Dr. Jain', 'Dr. Das'],
  ENT: ['Dr. Chatterjee', 'Dr. Iyer'],
};

const Field = ({ label, required, hint, children }) => (
  <div className="rp-field">
    <label className="rp-label">
      {label} {required && <span className="rp-required">*</span>}
    </label>
    {children}
    {hint ? <p className="rp-hint">{hint}</p> : null}
  </div>
);

const inputCls =
  'rp-input';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeGender(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'male' || v === 'm') return 'Male';
  if (v === 'female' || v === 'f') return 'Female';
  if (v === 'other' || v === 'o' || v === 'transgender') return 'Other';
  return '';
}

function normalizeDob(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // ABDM often returns DD-MM-YYYY
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return toISODate(parsed);
}

function ageFromDob(isoDob) {
  if (!isoDob || !/^\d{4}-\d{2}-\d{2}$/.test(isoDob)) return '';
  const dob = new Date(`${isoDob}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

function buildDobFromAccount(account = {}) {
  const y = String(account.yearOfBirth || account.year || '').trim();
  const m = String(account.monthOfBirth || account.month || '').padStart(2, '0');
  const d = String(account.dayOfBirth || account.day || '').padStart(2, '0');
  if (/^\d{4}$/.test(y) && m !== '00' && d !== '00') return normalizeDob(`${d}-${m}-${y}`);
  if (/^\d{4}$/.test(y) && m !== '00') return normalizeDob(`01-${m}-${y}`);
  return '';
}

export default function RegisterPatient() {
  const navigate = useNavigate();
  const location = useLocation();

  const editPatient = location?.state?.mode === 'edit' ? { ...(location?.state?.patient || {}) } : null;
  const isEditMode = Boolean(editPatient?.uhid);

  const [success, setSuccess] = useState(null); // { uhid, token, queuePosition }
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [statusTouched, setStatusTouched] = useState(false);
  const [appointmentPrompt, setAppointmentPrompt] = useState(null); // { patient, uhid, token }
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [abhaModalOpen, setAbhaModalOpen] = useState(false);
  const [abhaModalFlow, setAbhaModalFlow] = useState('create');
  const [abhaTxnId, setAbhaTxnId] = useState('');
  const [abdmProfile, setAbdmProfile] = useState(null);
  const [patientDbId, setPatientDbId] = useState('');
  const [hipTestLoading, setHipTestLoading] = useState(false);
  const [abdmNotice, setAbdmNotice] = useState(null);
  const abdmPollRef = useRef(null);

  const stopAbdmPoll = () => {
    if (abdmPollRef.current) {
      clearInterval(abdmPollRef.current);
      abdmPollRef.current = null;
    }
  };

  const applyAbdmStatus = (patientId, data) => {
    const state = readAbdmLinkState(data);
    setAbdmNotice({
      patientId,
      state,
      message: abdmLinkUserMessage(data),
      careContextStatus: data?.careContextStatus || data?.patient?.careContextStatus || '',
    });
    return state;
  };

  const startAbdmPoll = (patientId) => {
    stopAbdmPoll();
    let ticks = 0;
    abdmPollRef.current = setInterval(async () => {
      ticks += 1;
      if (ticks > 12) {
        stopAbdmPoll();
        return;
      }
      try {
        const status = await getHipPatientStatus(patientId);
        applyAbdmStatus(patientId, status);
        if (shouldStopAbdmPoll(status)) stopAbdmPoll();
      } catch {
        if (ticks > 12) stopAbdmPoll();
      }
    }, 8000);
  };

  useEffect(() => () => stopAbdmPoll(), []);
  const [hipTestResult, setHipTestResult] = useState(null);
  const [hipTestError, setHipTestError] = useState('');

  const [form, setForm] = useState({
    // Patient Information
    fullName: '',
    phone: '',
    dob: '',
    age: '',
    gender: '',
    aadhaarId: '',
    abhaNumber: '',
    abhaAddress: '',
    abhaStatus: '',
    phrAddress: [],
    healthIdNumber: '',
    isAbhaVerified: false,
    mobileVerified: false,
    aadhaarVerified: false,
    abdmVerifiedAt: '',
    hipLinked: false,
    careContextId: '',
    careContextStatus: '',
    linkedAt: '',
    syncStatus: '',
    address: '',

    // Visit Details
    visitType: 'OPD', // kept for token/queue logic (UI removed)
    status: 'Waiting',
    department: '',
    doctor: '',
    visitDate: toISODate(new Date()),

    // Token & Queue (derived on submit, shown live)
    tokenPreview: '',
    queuePositionPreview: '',

    // Emergency Contact
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',

    // Other
    referBy: '',
    sponsor: 'GENERAL',

    // Medical Info
    bloodGroup: '',
    allergies: '',
    heightCm: '',
    weightKg: '',

    // Patient Portal
    enablePortal: false,
    portalPassword: '',
    portalConfirmPassword: '',

    // Billing — empty until receptionist enters fee / marks paid
    registrationFee: '',
    paymentMode: 'Cash',
    paymentStatus: 'Pending',
  });

  useEffect(() => {
    if (!isEditMode) return;
    let mounted = true;

    (async () => {
      try {
        const uhid = editPatient?.uhid;
        if (!uhid) return;
        const res = await api.get(`/receptionist/patients/${uhid}/details`);
        const p = res?.data || {};
        if (!mounted) return;

        setPatientDbId(p?.id || '');
        setForm((prev) => ({
          ...prev,
          fullName: p?.name || editPatient?.name || '',
          phone: p?.phone || editPatient?.phone || '',
          dob: p?.dob ? String(p.dob).slice(0, 10) : (editPatient?.dob || ''),
          age: p?.age != null ? String(p.age) : (editPatient?.age != null ? String(editPatient.age) : calculateAge(p?.dob || editPatient?.dob)),
          gender: p?.gender || editPatient?.gender || '',
          aadhaarId: p?.aadhaarId || '',
          abhaNumber: p?.abhaNumber || p?.healthIdNumber || '',
          abhaAddress: p?.abhaAddress || p?.healthId || '',
          abhaStatus: p?.abhaStatus || '',
          phrAddress: Array.isArray(p?.phrAddress) ? p.phrAddress : [],
          healthIdNumber: p?.healthIdNumber || p?.abhaNumber || p?.healthId || '',
          isAbhaVerified: Boolean(p?.isAbhaVerified || p?.abhaNumber || p?.healthIdNumber),
          mobileVerified: Boolean(p?.mobileVerified),
          aadhaarVerified: Boolean(p?.aadhaarVerified),
          abdmVerifiedAt: p?.abdmVerifiedAt ? String(p.abdmVerifiedAt) : '',
          hipLinked: Boolean(p?.hipLinked),
          careContextId: p?.careContextId || '',
          careContextStatus: p?.careContextStatus || '',
          linkedAt: p?.linkedAt ? String(p.linkedAt) : '',
          syncStatus: p?.syncStatus || '',
          address: p?.address || editPatient?.address || '',
          bloodGroup: p?.bloodGroup || '',
          allergies: p?.allergies || '',
          heightCm: p?.heightCm != null ? String(p.heightCm) : '',
          weightKg: p?.weightKg != null ? String(p.weightKg) : '',
          emergencyName: p?.emergencyName || '',
          emergencyPhone: p?.emergencyPhone || '',
          emergencyRelation: p?.emergencyRelation || '',
          referBy: p?.referBy || '',
          sponsor: p?.sponsor || 'GENERAL',
          visitType: p?.visitType || editPatient?.visitType || 'OPD',
          status:
            p?.status ||
            editPatient?.status ||
            (editPatient?.visitType === 'IPD' ? 'Admitted' : editPatient?.visitType === 'OPD' ? 'Waiting' : 'Waiting'),
          department: p?.department || editPatient?.department || '',
          doctor: p?.doctor || editPatient?.doctor || '',
          visitDate: p?.visitDate ? String(p.visitDate).slice(0, 10) : (editPatient?.visitDate || toISODate(new Date())),
          tokenPreview: p?.token || editPatient?.token || '',
          queuePositionPreview: '',
          registrationFee: p?.registrationFee != null ? String(p.registrationFee) : (editPatient?.registrationFee != null ? String(editPatient.registrationFee) : ''),
          paymentMode: p?.paymentMode || editPatient?.paymentMode || 'Cash',
          paymentStatus: p?.paymentStatus || editPatient?.paymentStatus || 'Pending',
        }));
        setStatusTouched(Boolean(p?.status || editPatient?.status));
      } catch {
        // If details endpoint fails, fallback to minimal edit state already present.
        const ep = editPatient || {};
        setPatientDbId(ep?.id || ep?.patientId || '');
        setForm((prev) => ({
          ...prev,
          fullName: ep?.name || '',
          phone: ep?.phone || '',
          dob: ep?.dob || '',
          age: ep?.age != null ? String(ep.age) : calculateAge(ep?.dob),
          gender: ep?.gender || '',
          address: ep?.address || '',
          aadhaarId: ep?.aadhaarId || '',
          abhaNumber: ep?.abhaNumber || ep?.healthIdNumber || '',
          abhaAddress: ep?.abhaAddress || ep?.healthId || '',
          abhaStatus: ep?.abhaStatus || '',
          phrAddress: Array.isArray(ep?.phrAddress) ? ep.phrAddress : [],
          healthIdNumber: ep?.healthIdNumber || ep?.abhaNumber || ep?.healthId || '',
          isAbhaVerified: Boolean(ep?.isAbhaVerified || ep?.abhaNumber || ep?.healthIdNumber),
          mobileVerified: Boolean(ep?.mobileVerified),
          aadhaarVerified: Boolean(ep?.aadhaarVerified),
          abdmVerifiedAt: ep?.abdmVerifiedAt ? String(ep.abdmVerifiedAt) : '',
          hipLinked: Boolean(ep?.hipLinked),
          careContextId: ep?.careContextId || '',
          careContextStatus: ep?.careContextStatus || '',
          linkedAt: ep?.linkedAt ? String(ep.linkedAt) : '',
          syncStatus: ep?.syncStatus || '',
          bloodGroup: ep?.bloodGroup || '',
          allergies: ep?.allergies || '',
          heightCm: ep?.heightCm != null ? String(ep.heightCm) : '',
          weightKg: ep?.weightKg != null ? String(ep.weightKg) : '',
          emergencyName: ep?.emergencyName || '',
          emergencyPhone: ep?.emergencyPhone || '',
          emergencyRelation: ep?.emergencyRelation || '',
          referBy: ep?.referBy || '',
          sponsor: ep?.sponsor || 'GENERAL',
          visitType: ep?.visitType || 'OPD',
          status: ep?.status || (ep?.visitType === 'IPD' ? 'Admitted' : ep?.visitType === 'OPD' ? 'Waiting' : 'Waiting'),
          department: ep?.department || '',
          doctor: ep?.doctor || '',
          visitDate: ep?.visitDate || toISODate(new Date()),
          tokenPreview: ep?.token || '',
          queuePositionPreview: '',
          registrationFee: ep?.registrationFee != null ? String(ep.registrationFee) : '',
          paymentMode: ep?.paymentMode || 'Cash',
          paymentStatus: ep?.paymentStatus || 'Pending',
        }));
        setStatusTouched(Boolean(ep?.status));
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  const doctorsForSelectedDept = useMemo(() => {
    const list = DOCTORS_BY_DEPT[form.department] || [];
    return list;
  }, [form.department]);

  const calculateAge = (dob) => {
    if (!dob) return '';
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age < 0 ? '' : String(age);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm((prev) => ({ ...prev, phone: String(value).replace(/\D/g, '').slice(0, 10) }));
      setErrors((prev) => ({ ...prev, phone: undefined }));
      return;
    }
    if (name === 'sponsor' && isAyushmanSponsor(value)) {
      setForm((prev) => ({
        ...prev,
        sponsor: value,
        paymentStatus: 'Paid',
        paymentMode: AYUSHMAN_PAYMENT_LABEL,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  useEffect(() => {
    if (isEditMode) return;
    if (statusTouched) return;
    const nextStatus = form.visitType === 'IPD' ? 'Admitted' : 'Waiting';
    setForm((prev) => ({ ...prev, status: nextStatus }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.visitType, isEditMode, statusTouched]);

  useEffect(() => {
    const nextAge = calculateAge(form.dob);
    if (!nextAge) return;
    setForm((prev) => ({ ...prev, age: nextAge }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dob]);

  useEffect(() => {
    if (!form.department) {
      setForm((prev) => ({ ...prev, doctor: '' }));
      return;
    }
    if (doctorsForSelectedDept.length && !doctorsForSelectedDept.includes(form.doctor)) {
      setForm((prev) => ({ ...prev, doctor: '' }));
    }
  }, [form.department, doctorsForSelectedDept, form.doctor]);

  const validate = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = 'Full name is required';
    if (!/^\d{10}$/.test(String(form.phone).trim())) nextErrors.phone = 'Enter a valid 10-digit mobile number';
    if (!form.dob && (!String(form.age || '').trim() || Number(form.age) < 0)) {
      nextErrors.age = 'Age is required when DOB is not provided';
    }
    if (!form.gender) nextErrors.gender = 'Gender is required';
    if (!form.address.trim()) nextErrors.address = 'Address is required';
    if (form.enablePortal) {
      if (!form.portalPassword || form.portalPassword.length < 6) nextErrors.portalPassword = 'Password must be at least 6 characters';
      if (form.portalPassword !== form.portalConfirmPassword) nextErrors.portalConfirmPassword = 'Passwords do not match';
    }
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);
    setSubmitError('');
    setAbdmNotice(null);
    stopAbdmPoll();

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      uhid: isEditMode ? editPatient.uhid : undefined,
      visitId: isEditMode ? editPatient?.visitId : undefined,
      fullName: form.fullName.trim(),
      phone: String(form.phone).trim(),
      dob: form.dob || undefined,
      age: form.dob ? calculateAge(form.dob) : String(form.age || '').trim(),
      gender: form.gender,
      aadhaarId: form.aadhaarId,
      abhaNumber: form.abhaNumber,
      abhaAddress: form.abhaAddress,
      abhaStatus: form.abhaStatus,
      phrAddress: form.phrAddress,
      healthIdNumber: form.healthIdNumber || form.abhaNumber,
      isAbhaVerified: Boolean(form.isAbhaVerified && (form.abhaNumber || form.abhaAddress)),
      mobileVerified: Boolean(form.mobileVerified),
      aadhaarVerified: Boolean(form.aadhaarVerified),
      abdmVerifiedAt: form.abdmVerifiedAt || undefined,
      address: form.address.trim(),
      bloodGroup: form.bloodGroup,
      allergies: form.allergies,
      heightCm: String(form.heightCm || '').trim(),
      weightKg: String(form.weightKg || '').trim(),
      emergencyName: form.emergencyName,
      emergencyPhone: form.emergencyPhone,
      emergencyRelation: form.emergencyRelation,
      referBy: form.referBy,
      sponsor: form.sponsor,
      visitType: form.visitType,
      status: form.status,
      department: form.department,
      doctor: form.doctor,
      visitDate: form.visitDate,
      registrationFee: form.registrationFee,
      paymentMode: form.paymentMode,
      paymentStatus: form.paymentStatus,
      enablePortal: form.enablePortal,
      portalPassword: form.enablePortal ? form.portalPassword : undefined,
    };

    let res;
    try {
      res = await api.post('/receptionist/patients/register', payload);
    } catch (err) {
      const data = err?.response?.data;
      const validationMsg =
        Array.isArray(data?.errors) && data.errors.length > 0
          ? data.errors[0]?.message
          : null;
      const serverMsg = typeof data?.message === 'string' ? data.message : null;
      const authMsg =
        err?.response?.status === 401
          ? 'Session expired. Please login again.'
          : err?.response?.status === 403
            ? 'Access denied. Please login as Receptionist/Super Admin.'
            : null;
      const networkMsg =
        !err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error')
          ? 'Server not reachable. Please start backend on port 5000.'
          : null;

      setSubmitError(validationMsg || serverMsg || authMsg || networkMsg || 'Failed to register patient. Please try again.');
      return;
    }

    const uhid = res?.data?.visit?.uhid || res?.data?.patient?.uhid || payload.uhid;
    const registrationNumber = res?.data?.patient?.registrationNumber || '';
    const token = res?.data?.visit?.token || '';
    const queuePosition = res?.data?.visit?.queueNumber || 0;
    const savedPatientId = res?.data?.patient?.id || '';
    const hipLink = res?.data?.hipLink || null;
    const shouldLinkAbdm = Boolean(
      !isEditMode &&
      savedPatientId &&
      form.isAbhaVerified &&
      (form.abhaNumber || form.abhaAddress)
    );

    if (savedPatientId) setPatientDbId(savedPatientId);
    if (hipLink) {
      setHipTestResult(hipLink);
      setHipTestError('');
      setForm((prev) => ({
        ...prev,
        hipLinked: Boolean(hipLink.hipLinked || hipLink.patient?.hipLinked),
        careContextId: hipLink.careContextId || hipLink.patient?.careContextId || prev.careContextId,
        careContextStatus: hipLink.careContextStatus || hipLink.patient?.careContextStatus || prev.careContextStatus,
        linkedAt: hipLink.linkedAt || hipLink.patient?.linkedAt || prev.linkedAt,
        syncStatus: hipLink.syncStatus || hipLink.patient?.syncStatus || prev.syncStatus,
      }));
    }

    if (isEditMode) {
      setSuccess({ uhid, token, queuePosition: 0, mode: 'edit' });
      navigate('/dashboard/reception/patients');
      return;
    }

    setSuccess({ uhid, token, queuePosition, patient: res?.data?.visit || null });
    setAppointmentPrompt({ uhid, token, registrationNumber, patient: res?.data?.visit || null });
    if (shouldLinkAbdm) {
      setAbdmNotice({
        patientId: savedPatientId,
        state: 'TOKEN_PENDING',
        message: 'ABDM linking request sent. Waiting for confirmation.',
        careContextStatus: 'PENDING',
      });
      linkHipPatient({ patientId: savedPatientId })
        .then((data) => {
          const state = applyAbdmStatus(savedPatientId, data);
          if (state === 'TOKEN_PENDING' || state === 'CARE_LINKING') startAbdmPoll(savedPatientId);
        })
        .catch((err) => {
          const data = err?.response?.data || {};
          stopAbdmPoll();
          setAbdmNotice({
            patientId: savedPatientId,
            state: readAbdmLinkState(data),
            message: abdmLinkUserMessage(data, err),
            careContextStatus: data?.careContextStatus || 'FAILED',
          });
        });
    } else {
      setAbdmNotice(null);
    }
    setStatusTouched(false);
    setForm((prev) => ({
      ...prev,
      fullName: '',
      phone: '',
      dob: '',
      age: '',
      gender: '',
      aadhaarId: '',
      abhaNumber: '',
      abhaAddress: '',
      abhaStatus: '',
      phrAddress: [],
      healthIdNumber: '',
      isAbhaVerified: false,
      mobileVerified: false,
      aadhaarVerified: false,
      abdmVerifiedAt: '',
      hipLinked: Boolean(hipLink?.hipLinked || hipLink?.patient?.hipLinked) || false,
      careContextId: hipLink?.careContextId || hipLink?.patient?.careContextId || '',
      careContextStatus: hipLink?.careContextStatus || hipLink?.patient?.careContextStatus || '',
      linkedAt: hipLink?.linkedAt || hipLink?.patient?.linkedAt || '',
      syncStatus: hipLink?.syncStatus || hipLink?.patient?.syncStatus || '',
      address: '',
      status: prev.visitType === 'IPD' ? 'Admitted' : 'Waiting',
      department: '',
      doctor: '',
      tokenPreview: '',
      queuePositionPreview: '',
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
      referBy: '',
      sponsor: 'GENERAL',
      bloodGroup: '',
      allergies: '',
      heightCm: '',
      weightKg: '',
      registrationFee: '',
      paymentMode: 'Cash',
      paymentStatus: 'Pending',
      visitType: 'OPD',
      visitDate: toISODate(new Date()),
    }));
  };

  const resetForm = () => {
    setErrors({});
    setSuccess(null);
    setAppointmentPrompt(null);
    setStatusTouched(false);
    setAbhaTxnId('');
    setAbdmProfile(null);
    setPatientDbId('');
    setHipTestResult(null);
    setHipTestError('');
    setAbdmNotice(null);
    stopAbdmPoll();
    setForm({
      fullName: '',
      phone: '',
      dob: '',
      age: '',
      gender: '',
      aadhaarId: '',
      abhaNumber: '',
      abhaAddress: '',
      abhaStatus: '',
      phrAddress: [],
      healthIdNumber: '',
      isAbhaVerified: false,
      mobileVerified: false,
      aadhaarVerified: false,
      abdmVerifiedAt: '',
      hipLinked: false,
      careContextId: '',
      careContextStatus: '',
      linkedAt: '',
      syncStatus: '',
      address: '',
      visitType: 'OPD',
      status: 'Waiting',
      department: '',
      doctor: '',
      visitDate: toISODate(new Date()),
      tokenPreview: '',
      queuePositionPreview: '',
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
      referBy: '',
      sponsor: 'GENERAL',
      bloodGroup: '',
      allergies: '',
      heightCm: '',
      weightKg: '',
      enablePortal: false,
      portalPassword: '',
      portalConfirmPassword: '',
      registrationFee: '',
      paymentMode: 'Cash',
      paymentStatus: 'Pending',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AbhaVerificationModal
        open={abhaModalOpen}
        onClose={() => setAbhaModalOpen(false)}
        flow={abhaModalFlow}
        initialAadhaar={form.aadhaarId}
        initialMobile={form.phone}
        onOtpSent={({ txnId, mobile }) => {
          // Keep modal open; only persist government txnId. Do not update
          // aadhaarId here — that previously re-triggered modal reset.
          setAbhaTxnId(txnId || '');
          if (mobile && /^\d{10}$/.test(String(mobile))) {
            setForm((prev) => ({ ...prev, phone: mobile }));
          }
        }}
        onAbhaCreated={(profile, context) => {
          const account = profile?.raw?.account || profile?.raw?.ABHAProfile || profile?.ABHAProfile || {};
          const dob = normalizeDob(profile?.dob || account?.dob || buildDobFromAccount(account));
          const gender = normalizeGender(profile?.gender || account?.gender);
          const mobile = String(profile?.mobile || account?.mobile || '')
            .replace(/\D/g, '')
            .slice(0, 10);
          const fallbackName =
            profile?.fullName ||
            account?.name ||
            [account?.firstName, account?.middleName, account?.lastName].filter(Boolean).join(' ').trim() ||
            profile?.raw?.accounts?.[0]?.name ||
            '';
          const fallbackAddress =
            profile?.abhaAddress ||
            account?.preferredAbhaAddress ||
            (Array.isArray(account?.phrAddress) ? account.phrAddress[0] : '') ||
            profile?.raw?.accounts?.[0]?.preferredAbhaAddress ||
            '';
          const fallbackStatus = profile?.abhaStatus || account?.abhaStatus || account?.status || profile?.raw?.accounts?.[0]?.status || '';
          const addressFromProfile =
            profile?.address ||
            account?.address ||
            [account?.address, account?.districtName, account?.stateName, account?.pincode || account?.pinCode]
              .filter(Boolean)
              .join(', ');
          const verifiedAt = new Date().toISOString();
          const isCreateFlow = context?.flow === 'create';
          const isLinkFlow = context?.flow === 'link';

          setAbhaTxnId(context?.txnId || profile?.txnId || '');
          setAbdmProfile(profile?.raw || profile || null);
          setForm((prev) => ({
            ...prev,
            fullName: fallbackName || prev.fullName,
            gender: gender || prev.gender,
            dob: dob || prev.dob,
            age: dob ? (ageFromDob(dob) || prev.age) : prev.age,
            phone: (/^\d{10}$/.test(mobile) ? mobile : '') || prev.phone,
            aadhaarId: isCreateFlow ? (context?.aadhaar || prev.aadhaarId) : prev.aadhaarId,
            abhaNumber: profile?.abhaNumber || account?.ABHANumber || account?.abhaNumber || prev.abhaNumber,
            abhaAddress: fallbackAddress || prev.abhaAddress,
            abhaStatus: fallbackStatus || prev.abhaStatus,
            phrAddress: Array.isArray(profile?.phrAddress)
              ? profile.phrAddress
              : Array.isArray(account?.phrAddress)
                ? account.phrAddress
                : Array.isArray(profile?.raw?.ABHAProfile?.phrAddress)
                  ? profile.raw.ABHAProfile.phrAddress
                  : Array.isArray(profile?.raw?.phrAddress)
                    ? profile.raw.phrAddress
                    : prev.phrAddress,
            healthIdNumber: profile?.healthIdNumber || profile?.abhaNumber || account?.ABHANumber || prev.healthIdNumber || prev.abhaNumber,
            isAbhaVerified: Boolean(profile?.abhaNumber || profile?.abhaAddress || account?.ABHANumber),
            aadhaarVerified: isCreateFlow ? true : prev.aadhaarVerified,
            mobileVerified: isLinkFlow || Boolean(mobile) || prev.mobileVerified,
            abdmVerifiedAt: verifiedAt,
            address: addressFromProfile || prev.address,
          }));
          setErrors((prev) => ({
            ...prev,
            fullName: undefined,
            gender: undefined,
            age: undefined,
            phone: undefined,
            address: undefined,
          }));
        }}
      />
      <form onSubmit={handleSubmit} className="rp-registerForm space-y-6">
        {submitError ? (
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}
          >
            {submitError}
          </div>
        ) : null}
        {appointmentPrompt ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setAppointmentPrompt(null)}
              role="button"
              tabIndex={-1}
              aria-label="Close"
            />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div
                className="px-5 py-4 text-white"
                style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1a4a8a 60%, #1d4ed8 100%)' }}
              >
                <p className="text-sm font-extrabold">Patient registered successfully</p>
                <p className="text-xs text-blue-100 mt-0.5">
                  Do you want to book an appointment now?
                </p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-gray-500">UHID</p>
                    <p className="text-sm font-extrabold text-gray-800 font-mono">{appointmentPrompt.uhid}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-gray-500">Registration No</p>
                    <p className="text-sm font-extrabold text-gray-800 font-mono">{appointmentPrompt.registrationNumber || '—'}</p>
                  </div>
                </div>
                {abdmNotice?.message ? (
                  <p className="mt-3 text-xs font-semibold text-slate-600">{abdmNotice.message}</p>
                ) : null}

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAppointmentPrompt(null);
                      navigate('/dashboard/reception/patients');
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                  >
                    No, later
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = appointmentPrompt.patient;
                      setAppointmentPrompt(null);
                      navigate('/dashboard/reception/appointments/book', {
                        state: {
                          prefillPatient: {
                            patientId: p?.uhid || appointmentPrompt.uhid || '',
                            uhid: p?.uhid || appointmentPrompt.uhid || '',
                            name: p?.name || '',
                            mobile: p?.phone || '',
                            age: p?.age || '',
                            gender: p?.gender || '',
                            sponsor: p?.sponsor || form.sponsor || '',
                          },
                        },
                      });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:-translate-y-0.5 shadow hover:shadow-md"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #0d6ebd)' }}
                  >
                    <MdCalendarToday className="w-4 h-4" /> Yes, book appointment
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rp-registerGrid">
          <div className="rp-mainColumn space-y-6">
            {/* Patient Information */}
            <section className="rp-card">
              <header className="rp-cardHeader">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="rp-cardTitle">
                    <span className="rp-cardIcon"><MdPerson className="w-5 h-5" /></span>
                    <div>
                      <h2>Patient Information</h2>
                      <p>Basic identity and contact details</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.isAbhaVerified || form.abhaNumber || form.abhaAddress ? (
                      <>
                        <span className="rp-pill rp-pillAbhaVerified">
                          <MdBadge className="w-4 h-4" />
                          ABHA Verified ✓
                        </span>
                        {form.hipLinked ? (
                          <span className="rp-pill rp-pillHipLinked">
                            <MdBadge className="w-4 h-4" />
                            HIP Linked ✓
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="rp-ghostBtn !py-2"
                          onClick={() => {
                            setAbhaModalFlow('link');
                            setAbhaModalOpen(true);
                          }}
                          title="Re-verify ABHA with OTP"
                        >
                          Re-verify ABHA
                        </button>
                        <button
                          type="button"
                          className="rp-secondaryBtn"
                          disabled={Boolean(form.hipLinked) || hipTestLoading || !patientDbId}
                          title={form.hipLinked ? 'Already HIP linked' : (!patientDbId ? 'Save patient first' : 'Link HIP care context')}
                          onClick={async () => {
                            if (form.hipLinked || !patientDbId) return;
                            setHipTestLoading(true);
                            setHipTestError('');
                            try {
                              const data = await linkHipPatient({ patientId: patientDbId });
                              setHipTestResult(data);
                              setForm((prev) => ({
                                ...prev,
                                hipLinked: Boolean(data?.hipLinked || data?.patient?.hipLinked),
                                careContextId: data?.careContextId || data?.patient?.careContextId || prev.careContextId,
                                careContextStatus: data?.careContextStatus || data?.patient?.careContextStatus || prev.careContextStatus,
                                linkedAt: data?.linkedAt || data?.patient?.linkedAt || prev.linkedAt,
                                syncStatus: data?.syncStatus || data?.patient?.syncStatus || prev.syncStatus,
                              }));
                            } catch (err) {
                              setHipTestError(getAbdmErrorMessage(err, 'HIP link failed'));
                              setHipTestResult(err?.response?.data || null);
                            } finally {
                              setHipTestLoading(false);
                            }
                          }}
                        >
                          {form.hipLinked ? 'HIP Linked' : (hipTestLoading ? 'Linking…' : 'Link HIP')}
                        </button>
                        <button
                          type="button"
                          className="rp-ghostBtn !py-2"
                          disabled={hipTestLoading || !patientDbId}
                          onClick={async () => {
                            if (!patientDbId) {
                              setHipTestError('Save / open a patient first so patientId is available.');
                              return;
                            }
                            setHipTestLoading(true);
                            setHipTestError('');
                            try {
                              // force=false still hits API; duplicates return graceful response
                              const data = await linkHipPatient({
                                patientId: patientDbId,
                                force: false,
                              });
                              // Also refresh status
                              let status = null;
                              try {
                                status = await getHipPatientStatus(patientDbId);
                              } catch {
                                status = null;
                              }
                              setHipTestResult({ ...data, statusApi: status });
                              setForm((prev) => ({
                                ...prev,
                                hipLinked: Boolean(data?.hipLinked || status?.hipLinked || data?.patient?.hipLinked),
                                careContextId: data?.careContextId || status?.careContextId || prev.careContextId,
                                careContextStatus: data?.careContextStatus || status?.careContextStatus || prev.careContextStatus,
                                linkedAt: data?.linkedAt || status?.linkedAt || status?.syncTime || prev.linkedAt,
                                syncStatus: data?.syncStatus || status?.syncStatus || prev.syncStatus,
                              }));
                            } catch (err) {
                              setHipTestError(getAbdmErrorMessage(err, 'Test ABDM Care Context failed'));
                              setHipTestResult(err?.response?.data || null);
                            } finally {
                              setHipTestLoading(false);
                            }
                          }}
                        >
                          {hipTestLoading ? 'Testing…' : 'Test ABDM Care Context'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rp-secondaryBtn"
                          onClick={() => {
                            setAbhaModalFlow('create');
                            setAbhaModalOpen(true);
                          }}
                        >
                          <MdBadge className="w-4 h-4" />
                          Create ABHA
                        </button>
                        <button
                          type="button"
                          className="rp-secondaryBtn"
                          onClick={() => {
                            setAbhaModalFlow('link');
                            setAbhaModalOpen(true);
                          }}
                        >
                          <MdBadge className="w-4 h-4" />
                          Link Existing ABHA
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </header>

              {(form.careContextId || form.syncStatus || hipTestResult || hipTestError) ? (
                <div className="px-5 pt-3 space-y-2">
                  {form.careContextId ? (
                    <p className="text-xs text-slate-600">
                      Care Context ID: <span className="font-mono font-semibold">{form.careContextId}</span>
                      {form.syncStatus ? ` · Sync Status: ${form.syncStatus}` : ''}
                      {form.linkedAt ? ` · Sync Time: ${new Date(form.linkedAt).toLocaleString()}` : ''}
                    </p>
                  ) : null}
                  {hipTestError ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {hipTestError}
                    </div>
                  ) : null}
                  {hipTestResult ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-1">
                      <p className="font-bold text-slate-800">Test ABDM Care Context Result</p>
                      <p>HIP Link Status: {String(hipTestResult.careContextStatus || hipTestResult.patient?.careContextStatus || 'PENDING')}</p>
                      <p>Care Context ID: {hipTestResult.careContextId || form.careContextId || '—'}</p>
                      <p>Sync Time: {(hipTestResult.linkedAt || hipTestResult.statusApi?.syncTime || form.linkedAt) ? new Date(hipTestResult.linkedAt || hipTestResult.statusApi?.syncTime || form.linkedAt).toLocaleString() : '—'}</p>
                      <p className="font-semibold mt-1">Government Response:</p>
                      <pre className="overflow-auto max-h-48 whitespace-pre-wrap break-all bg-white border border-slate-100 rounded-lg p-2">
                        {JSON.stringify(hipTestResult.governmentResponse || hipTestResult, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rp-cardBody">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  <Field label="Full Name" required>
                    <input
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="e.g. Ravi Kumar"
                    />
                    {errors.fullName ? <p className="rp-error">{errors.fullName}</p> : null}
                  </Field>

                  <Field label="Mobile Number (from ABHA popup)" required hint="Use Create ABHA popup to enter mobile; it will auto-fill here.">
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="rp-input rp-inputReadOnly"
                      placeholder="Auto-filled after ABHA OTP flow"
                      inputMode="numeric"
                      maxLength={10}
                      readOnly
                    />
                    {errors.phone ? <p className="rp-error">{errors.phone}</p> : null}
                  </Field>

                  <Field label="Date of Birth">
                    <input
                      name="dob"
                      type="date"
                      value={form.dob}
                      onChange={handleChange}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Age" required={!form.dob} hint={form.dob ? 'Auto-calculated from DOB' : 'Required if DOB is not provided'}>
                    <input
                      name="age"
                      value={form.age}
                      onChange={handleChange}
                      readOnly={Boolean(form.dob)}
                      className={form.dob ? 'rp-input rp-inputReadOnly' : inputCls}
                      inputMode="numeric"
                      placeholder="—"
                    />
                    {errors.age ? <p className="rp-error">{errors.age}</p> : null}
                  </Field>

                  <Field label="Gender" required>
                    <select name="gender" value={form.gender} onChange={handleChange} className={inputCls}>
                      <option value="">Select gender</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    {errors.gender ? <p className="rp-error">{errors.gender}</p> : null}
                  </Field>

                  <Field label="Aadhaar / ID">
                    <input
                      name="aadhaarId"
                      value={form.aadhaarId}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="Aadhaar / Hospital ID / Other"
                    />
                  </Field>

                  <Field label="ABHA Number">
                    <input
                      name="abhaNumber"
                      value={form.abhaNumber}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="Auto-filled after ABHA verification"
                    />
                  </Field>

                  <Field label="ABHA Address">
                    <input
                      name="abhaAddress"
                      value={form.abhaAddress}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="Auto-filled after ABHA verification"
                    />
                  </Field>

                  <div className="md:col-span-2 2xl:col-span-3">
                    <Field label="Address" required>
                      <textarea
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        className={inputCls}
                        rows={3}
                        placeholder="House no., street, area, city"
                      />
                      {errors.address ? <p className="rp-error">{errors.address}</p> : null}
                    </Field>
                    {abhaTxnId ? (
                      <p className="rp-hint">
                        ABHA txnId: {abhaTxnId}
                        {form.abhaNumber ? ` · ABHA: ${form.abhaNumber}` : ''}
                      </p>
                    ) : null}
                    {abdmProfile ? (
                      <p className="rp-hint">
                        ABDM response captured for this registration.
                      </p>
                    ) : null}
                  </div>

                  {/* Visit/Status/Dept/Doctor removed from UI per request */}
                </div>
              </div>
            </section>

            {/* Medical Info */}
            <section className="rp-card">
              <header className="rp-cardHeader">
                <div className="rp-cardTitle">
                  <span className="rp-cardIcon"><MdLocalHospital className="w-5 h-5" /></span>
                  <div>
                    <h2>Medical Info</h2>
                    <p>Quick clinical context for the visit</p>
                  </div>
                </div>
              </header>
              <div className="rp-cardBody">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Field label="Blood Group">
                    <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className={inputCls}>
                      <option value="">Select blood group</option>
                      {BLOOD_GROUPS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Allergies">
                    <input
                      name="allergies"
                      value={form.allergies}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="e.g. Penicillin, Dust"
                    />
                  </Field>
                  <Field label="Height (cm)">
                    <input
                      name="heightCm"
                      value={form.heightCm}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="e.g. 170"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="Weight (kg)">
                    <input
                      name="weightKg"
                      value={form.weightKg}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="e.g. 65"
                      inputMode="numeric"
                    />
                  </Field>
                </div>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="rp-sideColumn space-y-6">
            {/* Emergency Contact */}
            <section className="rp-card rp-cardCompact">
              <header className="rp-cardHeader">
                <div className="rp-cardTitle">
                  <span className="rp-cardIcon"><MdPhone className="w-5 h-5" /></span>
                  <div>
                    <h2>Emergency Contact</h2>
                    <p>Optional but recommended</p>
                  </div>
                </div>
              </header>
              <div className="rp-cardBody">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4">
                  <Field label="Name">
                    <input
                      name="emergencyName"
                      value={form.emergencyName}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="Contact name"
                    />
                  </Field>
                  <Field label="Relation">
                    <input
                      name="emergencyRelation"
                      value={form.emergencyRelation}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="e.g. Father, Mother, Spouse"
                    />
                  </Field>
                  <Field label="Phone Number">
                    <input
                      name="emergencyPhone"
                      value={form.emergencyPhone}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="Phone number"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </Field>
                  <Field label="Refer By">
                    <input
                      name="referBy"
                      value={form.referBy}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="Doctor / Person / Hospital"
                    />
                  </Field>
                  <Field label="Sponsor">
                    <select name="sponsor" value={form.sponsor} onChange={handleChange} className={inputCls}>
                      {SPONSOR_OPTIONS.map((s) => (
                        <option key={s} value={s}>{SPONSOR_LABEL[s] || s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </section>

            {/* Billing */}
            <section className="rp-card rp-cardCompact">
              <header className="rp-cardHeader">
                <div className="rp-cardTitle">
                  <span className="rp-cardIcon"><MdPayments className="w-5 h-5" /></span>
                  <div>
                    <h2>Billing</h2>
                    <p>Registration fee and payment</p>
                  </div>
                </div>
              </header>
              <div className="rp-cardBody">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Registration Fee (₹)" hint="Leave blank if not collected now; enter amount when taking payment">
                    <input name="registrationFee" type="number" value={form.registrationFee} onChange={handleChange} className={inputCls} min="0" placeholder="200" />
                  </Field>
                  <Field label="Payment Mode">
                    <select name="paymentMode" value={form.paymentMode} onChange={handleChange} className={inputCls}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                    </select>
                  </Field>
                  <Field label="Payment Status">
                    <select name="paymentStatus" value={form.paymentStatus} onChange={handleChange} className={inputCls}>
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </Field>
                </div>
              </div>
            </section>

            {/* Patient Portal */}
            <section className="rp-card rp-cardCompact">
              <header className="rp-cardHeader">
                <div className="rp-cardTitle">
                  <span className="rp-cardIcon"><MdVpnKey className="w-5 h-5" /></span>
                  <div>
                    <h2>Patient Portal</h2>
                    <p>Enable online access for this patient</p>
                  </div>
                </div>
              </header>
              <div className="rp-cardBody">
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="enablePortal" checked={form.enablePortal}
                           onChange={(e) => setForm(p => ({ ...p, enablePortal: e.target.checked }))}
                           className="w-4 h-4" />
                    <span className="text-sm font-medium text-gray-700">Enable Patient Portal</span>
                  </label>

                  {form.enablePortal && (
                    <>
                      <Field label="Portal Password">
                        <div className="relative">
                          <input name="portalPassword" type={showPortalPassword ? 'text' : 'password'}
                                 value={form.portalPassword}
                                 onChange={handleChange}
                                 className={`${inputCls} pr-10`}
                                 placeholder="Min 6 characters" />
                          <button type="button" onClick={() => setShowPortalPassword(!showPortalPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPortalPassword ? (
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </Field>
                      <Field label="Confirm Password">
                        <div className="relative">
                          <input name="portalConfirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                                 value={form.portalConfirmPassword}
                                 onChange={handleChange}
                                 className={`${inputCls} pr-10`}
                                 placeholder="Re-enter password" />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showConfirmPassword ? (
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </Field>
                    </>
                  )}
                </div>
              </div>
            </section>

          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <button type="button" onClick={() => navigate(-1)} className="rp-iconBtn" title="Back">
            <MdArrowBack className="w-5 h-5" />
          </button>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={resetForm} className="rp-ghostBtn">
              <MdRefresh className="w-4 h-4" /> Reset Form
            </button>
            <button type="submit" className="rp-primaryBtn">
              <MdSave className="w-4 h-4" /> {isEditMode ? 'Update Patient' : 'Register Patient'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
