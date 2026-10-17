import { useEffect, useMemo, useState } from 'react';
import { MdVisibility, MdVisibilityOff, MdPerson, MdEmail, MdPhone, MdWork, MdSchool, MdLock } from 'react-icons/md';
import Badge from './Badge';
import { DEPARTMENTS } from '../constants/departments';

const GENDERS = [
  { value: 'MALE',   label: 'Male'   },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER',  label: 'Other'  },
];

const SPECIALIZATIONS = DEPARTMENTS;

const Field = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
    {children}
    {error && <p className="text-[10px] text-rose-500 font-medium">{error}</p>}
  </div>
);

export default function DoctorForm({
  initialValue,
  loading = false,
  mode = 'create', // create | edit
  onSubmit,
  onCancel,
}) {
  const defaults = useMemo(
    () => ({
      name: '',
      email: '',
      phone: '',
      gender: 'MALE',
      specialization: '',
      qualification: '',
      experienceYears: 0,
      password: '',
      isActive: true,
      ...(initialValue || {}),
    }),
    [initialValue]
  );

  const [form, setForm]               = useState(defaults);
  const [touched, setTouched]         = useState({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setForm(defaults);
    setTouched({});
    setShowPassword(false);
  }, [defaults]);

  const setField    = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const markTouched = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errors = useMemo(() => {
    const e = {};
    if (!form.name          || String(form.name).trim().length  < 2) e.name          = 'Full name is required';
    if (!form.email         || !String(form.email).includes('@'))    e.email         = 'Valid email is required';
    if (!form.phone         || String(form.phone).trim().length < 5) e.phone         = 'Phone is required';
    if (!form.gender)                                                 e.gender        = 'Gender is required';
    if (!form.specialization || String(form.specialization).trim().length < 2) e.specialization = 'Specialization is required';
    if (!form.qualification  || String(form.qualification).trim().length  < 2) e.qualification  = 'Qualification is required';
    if (Number.isNaN(Number(form.experienceYears)) || Number(form.experienceYears) < 0) e.experienceYears = 'Experience must be 0 or higher';
    if (mode === 'create' && (!form.password || String(form.password).length < 8)) e.password = 'Min 8 characters required';
    return e;
  }, [form, mode]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  const inputBase = 'w-full rounded-xl border text-sm outline-none transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white text-gray-800 placeholder-gray-400';
  const inputCls  = (key, padding = 'px-4') =>
    `${inputBase} ${padding} py-3 ${
      touched[key] && errors[key]
        ? 'border-rose-300 focus:ring-2 focus:ring-rose-200 focus:border-rose-400'
        : 'border-gray-200 focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6]'
    }`;


  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">Doctor Profile</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {mode === 'create' ? 'Create a doctor account + profile for appointments' : 'Edit doctor account and professional details'}
          </p>
        </div>
        <Badge variant="blue">Admin</Badge>
      </div>

      <form
        className="p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({ name: true, email: true, phone: true, gender: true, specialization: true, qualification: true, experienceYears: true, password: true });
          if (!canSubmit) return;
          onSubmit?.(form);
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Basic Info ─────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100 pb-2">Basic Info</p>

            <Field label="Full Name *" error={touched.name && errors.name}>
              <div className="relative">
                <MdPerson className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none animate-none" />
                <input
                  value={form.name}
                  onChange={setField('name')}
                  onBlur={markTouched('name')}
                  className={inputCls('name', 'pl-10 pr-4')}
                  placeholder="e.g. Dr. Asha Verma"
                />
              </div>
            </Field>

            <Field label="Email *" error={touched.email && errors.email}>
              <div className="relative">
                <MdEmail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none animate-none" />
                <input
                  type="email"
                  value={form.email}
                  onChange={setField('email')}
                  onBlur={markTouched('email')}
                  className={inputCls('email', 'pl-10 pr-4')}
                  placeholder="doctor@hospital.com"
                />
              </div>
            </Field>

            <Field label="Phone *" error={touched.phone && errors.phone}>
              <div className="relative">
                <MdPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none animate-none" />
                <input
                  value={form.phone}
                  onChange={setField('phone')}
                  onBlur={markTouched('phone')}
                  className={inputCls('phone', 'pl-10 pr-4')}
                  placeholder="e.g. 98XXXXXXXX"
                />
              </div>
            </Field>

            <Field label="Gender *" error={touched.gender && errors.gender}>
              <select
                value={form.gender}
                onChange={setField('gender')}
                onBlur={markTouched('gender')}
                className={`${inputCls('gender', 'px-4')} cursor-pointer`}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── Right: Professional Info ──────────────────── */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100 pb-2">Professional Info</p>

            <Field label="Specialization *" error={touched.specialization && errors.specialization}>
              <div className="relative">
                <MdWork className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none animate-none" />
                <select
                  value={form.specialization}
                  onChange={setField('specialization')}
                  onBlur={markTouched('specialization')}
                  className={`${inputCls('specialization', 'pl-10 pr-4')} cursor-pointer`}
                >
                  <option value="">Select specialization</option>
                  {SPECIALIZATIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Qualification *" error={touched.qualification && errors.qualification}>
              <div className="relative">
                <MdSchool className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none animate-none" />
                <input
                  value={form.qualification}
                  onChange={setField('qualification')}
                  onBlur={markTouched('qualification')}
                  className={inputCls('qualification', 'pl-10 pr-4')}
                  placeholder="e.g. MBBS, MD"
                />
              </div>
            </Field>

            <Field label="Experience (years) *" error={touched.experienceYears && errors.experienceYears}>
              <input
                type="number"
                min={0}
                value={form.experienceYears}
                onChange={setField('experienceYears')}
                onBlur={markTouched('experienceYears')}
                className={inputCls('experienceYears', 'px-4')}
              />
            </Field>

            {/* Password + Status Active — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={`Password ${mode === 'create' ? '*' : '(unchanged)'}`}
                error={mode === 'create' && touched.password && errors.password}
              >
                <div className="relative">
                  <MdLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none animate-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={setField('password')}
                    onBlur={markTouched('password')}
                    className={inputCls('password', 'pl-10 pr-10')}
                    placeholder={mode === 'create' ? 'Min 8 chars' : '—'}
                    disabled={mode !== 'create'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700 transition disabled:opacity-40 cursor-pointer"
                    disabled={mode !== 'create'}
                    aria-label={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? <MdVisibilityOff className="w-4 h-4" /> : <MdVisibility className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field label="Status">
                <label className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 cursor-pointer hover:bg-white transition">
                  <span className="text-xs font-semibold text-gray-700">Active</span>
                  <input
                    type="checkbox"
                    checked={Boolean(form.isActive)}
                    onChange={setField('isActive')}
                    className="h-4 w-4 accent-[#0077B6] cursor-pointer"
                  />
                </label>
              </Field>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-5 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onCancel?.()}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0077B6] hover:bg-[#005f92] active:bg-[#001B48] transition-all duration-200 shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Doctor'}
          </button>
        </div>
      </form>
    </div>
  );
}
