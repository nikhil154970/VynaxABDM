import { useEffect, useMemo, useState } from 'react';
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
} from 'react-icons/md';
import './RegisterPatient.css';
import api from '../../../utils/api';
import { isAyushmanSponsor, AYUSHMAN_PAYMENT_LABEL } from '../../../utils/ayushmanBilling';
import { DEPARTMENTS } from '../../../constants/departments';

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

const DEFAULT_REG_FEE = 200;

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

export default function RegisterPatient() {
  const navigate = useNavigate();
  const location = useLocation();

  const editPatient = location?.state?.mode === 'edit' ? location?.state?.patient : null;
  const isEditMode = Boolean(editPatient?.uhid);

  const [success, setSuccess] = useState(null); // { uhid, token, queuePosition }
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [statusTouched, setStatusTouched] = useState(false);
  const [appointmentPrompt, setAppointmentPrompt] = useState(null); // { patient, uhid, token }

  const [form, setForm] = useState({
    // Patient Information
    fullName: '',
    phone: '',
    dob: '',
    age: '',
    gender: '',
    aadhaarId: '',
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

    // Billing
    registrationFee: String(DEFAULT_REG_FEE), // UI removed (kept backend-ready)
    paymentMode: 'Cash',
    paymentStatus: 'Paid',
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

        setForm((prev) => ({
          ...prev,
          fullName: p?.name || editPatient?.name || '',
          phone: p?.phone || editPatient?.phone || '',
          dob: p?.dob ? String(p.dob).slice(0, 10) : (editPatient?.dob || ''),
          age: p?.age != null ? String(p.age) : (editPatient?.age != null ? String(editPatient.age) : calculateAge(p?.dob || editPatient?.dob)),
          gender: p?.gender || editPatient?.gender || '',
          aadhaarId: p?.aadhaarId || '',
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
          registrationFee: p?.registrationFee ? String(p.registrationFee) : (editPatient?.registrationFee ? String(editPatient.registrationFee) : String(DEFAULT_REG_FEE)),
          paymentMode: p?.paymentMode || editPatient?.paymentMode || 'Cash',
          paymentStatus: p?.paymentStatus || editPatient?.paymentStatus || 'Paid',
        }));
        setStatusTouched(Boolean(p?.status || editPatient?.status));
      } catch {
        // If details endpoint fails, fallback to minimal edit state already present.
        setForm((prev) => ({
          ...prev,
          fullName: editPatient?.name || '',
          phone: editPatient?.phone || '',
          dob: editPatient?.dob || '',
          age: editPatient?.age != null ? String(editPatient.age) : calculateAge(editPatient?.dob),
          gender: editPatient?.gender || '',
          address: editPatient?.address || '',
          heightCm: '',
          weightKg: '',
          visitType: editPatient?.visitType || 'OPD',
          status:
            editPatient?.status ||
            (editPatient?.visitType === 'IPD' ? 'Admitted' : editPatient?.visitType === 'OPD' ? 'Waiting' : 'Waiting'),
          department: editPatient?.department || '',
          doctor: editPatient?.doctor || '',
          visitDate: editPatient?.visitDate || toISODate(new Date()),
          tokenPreview: editPatient?.token || '',
          queuePositionPreview: '',
          registrationFee: editPatient?.registrationFee ? String(editPatient.registrationFee) : String(DEFAULT_REG_FEE),
          paymentMode: editPatient?.paymentMode || 'Cash',
          paymentStatus: editPatient?.paymentStatus || 'Paid',
        }));
        setStatusTouched(Boolean(editPatient?.status));
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
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);
    setSubmitError('');

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

    if (isEditMode) {
      setSuccess({ uhid, token, queuePosition: 0, mode: 'edit' });
      navigate('/dashboard/reception/patients');
      return;
    }

    setSuccess({ uhid, token, queuePosition, patient: res?.data?.visit || null });
    setAppointmentPrompt({ uhid, token, registrationNumber, patient: res?.data?.visit || null });
    setStatusTouched(false);
    setForm((prev) => ({
      ...prev,
      fullName: '',
      phone: '',
      dob: '',
      age: '',
      gender: '',
      aadhaarId: '',
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
      registrationFee: String(DEFAULT_REG_FEE),
      paymentMode: 'Cash',
      paymentStatus: 'Paid',
      visitType: 'OPD',
      visitDate: toISODate(new Date()),
    }));
  };

  const resetForm = () => {
    setErrors({});
    setSuccess(null);
    setAppointmentPrompt(null);
    setStatusTouched(false);
    setForm({
      fullName: '',
      phone: '',
      dob: '',
      age: '',
      gender: '',
      aadhaarId: '',
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
      registrationFee: String(DEFAULT_REG_FEE),
      paymentMode: 'Cash',
      paymentStatus: 'Paid',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="p-6 max-w-6xl mx-auto space-y-6">
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {/* Patient Information */}
            <section className="rp-card">
              <header className="rp-cardHeader">
                <div className="rp-cardTitle">
                  <span className="rp-cardIcon"><MdPerson className="w-5 h-5" /></span>
                  <div>
                    <h2>Patient Information</h2>
                    <p>Basic identity and contact details</p>
                  </div>
                </div>
              </header>

              <div className="rp-cardBody">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <Field label="Mobile Number" required>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className={inputCls}
                      placeholder="10-digit mobile"
                      inputMode="numeric"
                      maxLength={10}
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

                  <div className="md:col-span-2">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="space-y-6">
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
                <div className="space-y-4">
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
