import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import Badge from '../../../components/Badge';
import {
  MdVisibility, MdVisibilityOff, MdPerson, MdEmail, MdLock,
  MdAdminPanelSettings, MdArrowBack, MdCheckCircle, MdWarning,
  MdBiotech, MdLocalPharmacy, MdBadge,
  MdLocalHospital, MdPeople,
} from 'react-icons/md';

const ROLES = [
  { value: 'SUPER_ADMIN',    label: 'Super Admin',    Icon: MdAdminPanelSettings, color: '#7e22ce', bg: '#fdf4ff' },
  { value: 'RECEPTIONIST',   label: 'Receptionist',   Icon: MdPeople,             color: '#0ea5e9', bg: '#f0f9ff' },
  { value: 'NURSE',          label: 'Nurse',          Icon: MdLocalHospital,      color: '#f97316', bg: '#fff7ed' },
  { value: 'PHARMACIST',     label: 'Pharmacist',     Icon: MdLocalPharmacy,      color: '#22c55e', bg: '#f0fdf4' },
  { value: 'LAB_TECHNICIAN', label: 'Lab Technician', Icon: MdBiotech,            color: '#8b5cf6', bg: '#fdf4ff' },
  { value: 'HR_MANAGER',     label: 'HR Manager',     Icon: MdBadge,              color: '#f59e0b', bg: '#fffbeb' },
  { value: 'OT_TECHNICIAN',  label: 'OT Technician',  Icon: MdBiotech,            color: '#ef4444', bg: '#fef2f2' },
];

export default function CreateUser() {
  const navigate = useNavigate();
  const [form, setForm]               = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST' });
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [limits, setLimits]           = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setRole  = (v)   => setForm((f) => ({ ...f, role: v }));

  const loadLimits = async () => {
    setLimitsLoading(true);
    try {
      const res = await api.get('/users', { params: { page: 1, pageSize: 5 } });
      setLimits(res?.data?.limits || null);
    } catch {
      setLimits(null);
    } finally {
      setLimitsLoading(false);
    }
  };

  useEffect(() => { loadLimits(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/users', form);
      setSuccess('User created successfully.');
      setTimeout(() => navigate('/dashboard/admin/users'), 700);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create user');
      if (err?.response?.data?.code === 'MAX_STAFF_USERS_REACHED') {
        setLimits(err?.response?.data?.limits || limits);
      }
    } finally {
      setLoading(false);
    }
  };

  const max          = limits?.maxStaffUsers        ?? null;
  const staff        = limits?.staffUsers           ?? null;
  const remaining    = limits?.remainingStaffUsers  ?? null;
  const limitReached = max != null && remaining === 0 && form.role !== 'SUPER_ADMIN';

  const selectedRole = ROLES.find((r) => r.value === form.role) || ROLES[0];

  return (
    <div className="p-4 sm:p-6 bg-gray-50/50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* ── Page header ────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Create User
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Create a staff account with role-based access.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/users')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 cursor-pointer shadow-sm"
          >
            <MdArrowBack className="w-4 h-4" />
            Back to Users
          </button>
        </div>

        {/* ── Limit banner ───────────────────────────────── */}
        {!limitsLoading && max != null && (
          <div className={`rounded-2xl border px-4 py-2.5 flex items-center justify-between ${
            limitReached
              ? 'bg-amber-50 border-amber-100 text-amber-800'
              : 'bg-blue-50 border-blue-100 text-blue-700'
          }`}>
            <span className="text-xs font-semibold">
              {limitReached
                ? `⚠ Staff limit reached — Max ${max} users allowed`
                : `Staff accounts: ${staff ?? 0} of ${max} used`}
            </span>
            {!limitReached && (
              <span className="text-[10px] font-bold text-blue-500">{remaining} remaining</span>
            )}
          </div>
        )}

        {/* ── Alerts ─────────────────────────────────────── */}
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <MdWarning className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <MdCheckCircle className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* ── Form card ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Card header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">User Details</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Hospital staff onboarding (admin-controlled)</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="blue">Admin only</Badge>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-[#0077B6]">
                {limitsLoading ? '…' : max != null ? `Staff: ${staff ?? '—'} / ${max}` : 'Staff: Unlimited'}
              </span>
            </div>
          </div>

          <form onSubmit={submit} className="px-6 py-6 space-y-5">

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <MdPerson className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={form.name}
                  onChange={onChange('name')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition bg-gray-50/50 hover:bg-white focus:bg-white placeholder-gray-400"
                  placeholder="e.g. Ravi Kumar"
                  required
                  minLength={2}
                />
              </div>
            </div>

            {/* Email + Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <MdEmail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={onChange('email')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition bg-gray-50/50 hover:bg-white focus:bg-white placeholder-gray-400"
                    placeholder="name@hospital.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <MdLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={onChange('password')}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition bg-gray-50/50 hover:bg-white focus:bg-white placeholder-gray-400"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-700 transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <MdVisibilityOff className="w-4 h-4" /> : <MdVisibility className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Role selector — visual cards */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Role</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLES.map((r) => {
                  const selected = form.role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        selected
                          ? 'border-[#0077B6] bg-blue-50/60 shadow-sm'
                          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: r.bg }}
                      >
                        <r.Icon className="w-4 h-4" style={{ color: r.color }} />
                      </div>
                      <span
                        className="text-[10px] font-bold text-center leading-tight"
                        style={{ color: selected ? '#0077B6' : '#374151' }}
                      >
                        {r.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Only admins can create users. Access is enforced via JWT + role checks.</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate('/dashboard/admin/users')}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || limitReached}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition-all duration-200 shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
