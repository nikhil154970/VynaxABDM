import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import Badge from '../../../components/Badge';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'LAB_TECHNICIAN', label: 'Lab Technician' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
];

export default function CreateUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [limits, setLimits] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  const title = useMemo(() => 'Create User', []);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const loadLimits = async () => {
    setLimitsLoading(true);
    try {
      // listUsers already returns totals + limits; keep it lightweight
      const res = await api.get('/users', { params: { page: 1, pageSize: 5 } });
      setLimits(res?.data?.limits || null);
    } catch {
      setLimits(null);
    } finally {
      setLimitsLoading(false);
    }
  };

  useEffect(() => {
    loadLimits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/users', form);
      setSuccess('User created successfully.');
      setTimeout(() => navigate('/dashboard/admin/users'), 600);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create user');
      if (err?.response?.data?.code === 'MAX_STAFF_USERS_REACHED') {
        setLimits(err?.response?.data?.limits || limits);
      }
    } finally {
      setLoading(false);
    }
  };

  const max = limits?.maxStaffUsers ?? null;
  const staff = limits?.staffUsers ?? null;
  const remaining = limits?.remainingStaffUsers ?? null;
  const limitReached = max != null && remaining === 0 && form.role !== 'SUPER_ADMIN';

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">Create a staff account with role-based access.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/users')}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 transition"
            disabled={loading}
          >
            Back to Users
          </button>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-white ring-1 ring-gray-200 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-600/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative px-6 sm:px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">User Details</p>
              <p className="text-xs text-gray-500 mt-0.5">Hospital staff onboarding (admin-controlled)</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="blue">Admin only</Badge>
              <span
                className="text-[11px] font-extrabold px-2 py-1 rounded-full border"
                style={{
                  background: max != null ? '#f8fafc' : '#f0f9ff',
                  borderColor: max != null ? '#e2e8f0' : '#bae6fd',
                  color: max != null ? '#334155' : '#0369a1',
                }}
                title="Staff user limit"
              >
                {limitsLoading ? 'Checking limit…' : max != null ? `Staff: ${staff ?? '—'} / ${max}` : 'Staff: Unlimited'}
              </span>
            </div>
          </div>

          {(error || success) && (
            <div
              className={`relative px-6 sm:px-8 py-3 text-sm border-b ${
                error ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}
            >
              {error || success}
            </div>
          )}

          <form onSubmit={submit} className="relative px-6 sm:px-8 py-7">
            {limitReached ? (
              <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                User limit reached. You cannot add more staff users. (Max: <b>{max}</b>)
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Full Name</label>
                <input
                  value={form.name}
                  onChange={onChange('name')}
                  className="w-full px-4 py-3.5 rounded-2xl ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                  placeholder="e.g. Ravi Kumar"
                  required
                  minLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={onChange('email')}
                  className="w-full px-4 py-3.5 rounded-2xl ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                  placeholder="name@hospital.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={onChange('password')}
                    className="w-full px-4 py-3.5 pr-16 rounded-2xl ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <MdVisibilityOff className="w-5 h-5" /> : <MdVisibility className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={onChange('role')}
                  className="w-full px-4 py-3.5 rounded-2xl ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">Only admins can create users. Access is enforced via JWT + role checks.</p>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/admin/users')}
                className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 transition"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
                disabled={loading || limitReached}
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

