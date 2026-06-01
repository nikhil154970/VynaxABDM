import { useEffect, useMemo, useState } from 'react';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import Badge from './Badge';
import { DEPARTMENTS } from '../constants/departments';

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const SPECIALIZATIONS = DEPARTMENTS;

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

  const [form, setForm] = useState(defaults);
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // When edit data arrives async, sync it into the form.
  useEffect(() => {
    setForm(defaults);
    setTouched({});
    setShowPassword(false);
  }, [defaults]);

  const setField = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const markTouched = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errors = useMemo(() => {
    const e = {};
    if (!form.name || String(form.name).trim().length < 2) e.name = 'Full name is required';
    if (!form.email || !String(form.email).includes('@')) e.email = 'Valid email is required';
    if (!form.phone || String(form.phone).trim().length < 5) e.phone = 'Phone is required';
    if (!form.gender) e.gender = 'Gender is required';
    if (!form.specialization || String(form.specialization).trim().length < 2) e.specialization = 'Specialization is required';
    if (!form.qualification || String(form.qualification).trim().length < 2) e.qualification = 'Qualification is required';
    if (Number.isNaN(Number(form.experienceYears)) || Number(form.experienceYears) < 0) e.experienceYears = 'Experience must be 0 or higher';
    if (mode === 'create' && (!form.password || String(form.password).length < 8)) e.password = 'Password must be at least 8 characters';
    return e;
  }, [form, mode]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  const inputClass = (key) =>
    `w-full px-4 py-3.5 rounded-2xl ring-1 outline-none transition bg-white ${
      touched[key] && errors[key]
        ? 'ring-rose-200 focus:ring-2 focus:ring-rose-400'
        : 'ring-gray-200 focus:ring-2 focus:ring-[#00AEEF]'
    }`;

  const sectionTitle = (title, sub) => (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-extrabold text-[#2D2A6E]">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
      <Badge variant="blue">Admin</Badge>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)] overflow-hidden">
      <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
        {sectionTitle('Doctor Profile', 'Create a doctor account + profile for appointments')}
      </div>

      <form
        className="px-6 sm:px-8 py-7"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({
            name: true,
            email: true,
            phone: true,
            gender: true,
            specialization: true,
            qualification: true,
            experienceYears: true,
            password: true,
          });
          if (!canSubmit) return;
          onSubmit?.(form);
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">Basic Info</p>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Full Name *</label>
              <input
                value={form.name}
                onChange={setField('name')}
                onBlur={markTouched('name')}
                className={inputClass('name')}
                placeholder="e.g. Dr. Asha Verma"
              />
              {touched.name && errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={setField('email')}
                onBlur={markTouched('email')}
                className={inputClass('email')}
                placeholder="doctor@hospital.com"
              />
              {touched.email && errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Phone *</label>
              <input
                value={form.phone}
                onChange={setField('phone')}
                onBlur={markTouched('phone')}
                className={inputClass('phone')}
                placeholder="e.g. 98XXXXXXXX"
              />
              {touched.phone && errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Gender *</label>
              <select
                value={form.gender}
                onChange={setField('gender')}
                onBlur={markTouched('gender')}
                className={inputClass('gender')}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              {touched.gender && errors.gender && <p className="text-xs text-rose-600 mt-1">{errors.gender}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">Professional Info</p>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Specialization *</label>
              <select
                value={form.specialization}
                onChange={setField('specialization')}
                onBlur={markTouched('specialization')}
                className={inputClass('specialization')}
              >
                <option value="">Select specialization</option>
                {SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {touched.specialization && errors.specialization && (
                <p className="text-xs text-rose-600 mt-1">{errors.specialization}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Qualification *</label>
              <input
                value={form.qualification}
                onChange={setField('qualification')}
                onBlur={markTouched('qualification')}
                className={inputClass('qualification')}
                placeholder="e.g. MBBS, MD"
              />
              {touched.qualification && errors.qualification && (
                <p className="text-xs text-rose-600 mt-1">{errors.qualification}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Experience (years) *</label>
              <input
                type="number"
                min={0}
                value={form.experienceYears}
                onChange={setField('experienceYears')}
                onBlur={markTouched('experienceYears')}
                className={inputClass('experienceYears')}
              />
              {touched.experienceYears && errors.experienceYears && (
                <p className="text-xs text-rose-600 mt-1">{errors.experienceYears}</p>
              )}
            </div>

            

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  Password {mode === 'create' ? '*' : '(unchanged)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={setField('password')}
                    onBlur={markTouched('password')}
                    className={`${inputClass('password')} pr-16`}
                    placeholder={mode === 'create' ? 'Min 8 characters' : '—'}
                    disabled={mode !== 'create'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                    disabled={mode !== 'create'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <MdVisibilityOff className="w-5 h-5" /> : <MdVisibility className="w-5 h-5" />}
                  </button>
                </div>
                {mode === 'create' && touched.password && errors.password && (
                  <p className="text-xs text-rose-600 mt-1">{errors.password}</p>
                )}
              </div>

              <div className="flex items-end">
                <label className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl ring-1 ring-gray-200 bg-white">
                  <span className="text-sm font-bold text-gray-800">Status</span>
                  <input
                    type="checkbox"
                    checked={Boolean(form.isActive)}
                    onChange={setField('isActive')}
                    className="h-5 w-5 accent-[#00AEEF]"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 transition"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`px-5 py-2.5 rounded-2xl text-sm font-extrabold text-white transition shadow-sm disabled:opacity-60 ${
              mode === 'edit'
                ? 'bg-[#2D2A6E] hover:bg-[#25225e]'
                : 'bg-[#00AEEF] hover:bg-[#009ad6]'
            }`}
            disabled={!canSubmit}
          >
            {loading ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Doctor'}
          </button>
        </div>
      </form>
    </div>
  );
}

