import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPath } from '../utils/roleRedirect';
import {
  AlertCircle,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  User,
  UserRound,
  Pill,
  ClipboardList,
  Receipt,
  BarChart3,
  ShieldCheck,
  Briefcase,
  Users,
  Headphones,
} from 'lucide-react';
import './Login.css';

const ROLES = [
  { value: 'super_admin',    label: 'Super Admin' },
  { value: 'doctor',         label: 'Doctor' },
  { value: 'nurse',          label: 'Nurse' },
  { value: 'receptionist',   label: 'Receptionist' },
  { value: 'pharmacist',     label: 'Pharmacy' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'hr_manager',     label: 'HR Manager' },
  { value: 'ot_technician',  label: 'OT Technician' },
];

const toBackendRole = (role) => (role ? role.toUpperCase() : role);

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const [form, setForm]                 = useState({ role: '', email: '', password: '' });
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const fieldMap = { loginId: 'email', loginPassword: 'password' };
    const key = fieldMap[e.target.name] || e.target.name;
    setForm({ ...form, [key]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.role)                    return setError('Please select your role');
    if (!form.email || !form.password) return setError('Please enter both email and password');

    setLoading(true);
    try {
      const loginId = form.email.trim();
      const user = await login(loginId, form.password, toBackendRole(form.role));
      navigate(getDashboardPath(user.role));
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message;
      if (!err.response)      setError('Cannot reach server. Start backend: cd backend && npm run dev');
      else if (status === 503) setError(msg || 'Database not ready. Wait a few seconds, then try again.');
      else if (status === 500) setError(msg || 'Server error. Check backend terminal.');
      else if (status === 404) setError(msg || 'User not found. Check email/username.');
      else if (status === 403) setError(msg || 'Wrong role selected or account deactivated.');
      else if (status === 401) setError(msg || 'Invalid password.');
      else                     setError(msg || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="lp-page">

      {/* ── Floating + decorations on page bg ── */}
      <div className="lp-bg-deco" aria-hidden="true">
        <span className="lp-deco lp-deco-1">+</span>
        <span className="lp-deco lp-deco-2">+</span>
        <span className="lp-deco lp-deco-3">+</span>
        <span className="lp-deco lp-deco-4">+</span>
        <span className="lp-deco lp-deco-5">+</span>
        <span className="lp-deco lp-deco-6">+</span>
      </div>

      {/* ── Two-column layout ── */}
      <div className="lp-body">

        {/* ════ LEFT PANEL ════ */}
        <div className="lp-left">
          <div className="lp-left-bg-image" aria-hidden="true" />

          {/* Brand row */}
          <div className="lp-brand">
            <img className="lp-brand-logo" src="/mqe_logo.png" alt="MythoQuantum Explorers" />
            <div className="lp-brand-copy">
              <div className="lp-brand-name">
                <span className="lp-bn-1">MythoQuantum</span>
                <span className="lp-bn-2">Explorers</span>
              </div>
              <p className="lp-brand-sub">VyanX Hospital Information Management System</p>
            </div>
          </div>

          {/* Thin separator */}
          <div className="lp-sep" />

          {/* Hero text */}
          <div className="lp-hero">
            <h1 className="lp-hero-h1">
              A Complete Solution for<br />
              <span className="lp-hero-blue">Hospitals &amp; Pharmacies</span>
            </h1>
            <p className="lp-hero-p">
              Manage medicines, inventory, billing, reports and much more with accuracy, security and ease.
            </p>
          </div>

          {/* Feature cards */}
          <div className="lp-features">
            <div className="lp-feat-card">
              <Pill className="lp-feat-icon" />
              <span>Medicine &amp; Inventory Management</span>
            </div>
            <div className="lp-feat-card">
              <ClipboardList className="lp-feat-icon" />
              <span>Prescription Management</span>
            </div>
            <div className="lp-feat-card">
              <Receipt className="lp-feat-icon" />
              <span>Billing &amp; Invoicing</span>
            </div>
            <div className="lp-feat-card">
              <BarChart3 className="lp-feat-icon" />
              <span>Reports &amp; Analytics</span>
            </div>
            <div className="lp-feat-card">
              <ShieldCheck className="lp-feat-icon" />
              <span>Secure &amp; Reliable</span>
            </div>
          </div>

          {/* Stats bar — dark navy at bottom */}
          <div className="lp-stats">
            <div className="lp-stat">
              <span className="lp-stat-ico-wrap"><Briefcase className="lp-stat-ico" /></span>
              <div><b>500+</b><small>Hospitals</small></div>
            </div>
            <div className="lp-stat-div" />
            <div className="lp-stat">
              <span className="lp-stat-ico-wrap"><Users className="lp-stat-ico" /></span>
              <div><b>20K+</b><small>Users</small></div>
            </div>
            <div className="lp-stat-div" />
            <div className="lp-stat">
              <span className="lp-stat-ico-wrap"><ShieldCheck className="lp-stat-ico" /></span>
              <div><b>99.9%</b><small>Uptime</small></div>
            </div>
            <div className="lp-stat-div" />
            <div className="lp-stat">
              <span className="lp-stat-ico-wrap"><Headphones className="lp-stat-ico" /></span>
              <div><b>24/7</b><small>Support</small></div>
            </div>
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="lp-right">

          {/* Mobile brand (hidden on desktop) */}
          <div className="lp-mob-brand">
            <img src="/mqe_logo.png" alt="logo" className="lp-mob-logo" />
            <div>
              <p className="lp-mob-name">MythoQuantum Explorers</p>
              <p className="lp-mob-sub">VyanX Hospital Management System</p>
            </div>
          </div>

          {/* Login card */}
          <div className="lp-card">

            <div className="lp-card-logo-wrap">
              <img src="/mqe_logo.png" alt="logo" className="lp-card-logo" />
            </div>

            <h2 className="lp-card-h2">Welcome Back!</h2>

            <div className="lp-card-sub-row">
              <span className="lp-card-line" />
              <span className="lp-card-sub">Please login to continue to your account</span>
              <span className="lp-card-line" />
            </div>

            {error && (
              <div className="lp-err" role="alert">
                <AlertCircle className="lp-err-ico" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="lp-form" autoComplete="off">

              {/* Role */}
              <div className="lp-field">
                <label className="lp-lbl" htmlFor="lp-role">Role</label>
                <div className="lp-ctrl">
                  <UserRound className="lp-ctrl-ico" aria-hidden="true" />
                  <select
                    id="lp-role" name="role"
                    value={form.role} onChange={handleChange}
                    className="lp-select"
                  >
                    <option value="" disabled>Select Role</option>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="lp-chevron" aria-hidden="true" />
                </div>
              </div>

              {/* Email / Username */}
              <div className="lp-field">
                <label className="lp-lbl" htmlFor="lp-email">Email / Username</label>
                <div className="lp-ctrl">
                  <User className="lp-ctrl-ico" aria-hidden="true" />
                  <input
                    id="lp-email" type="text" name="loginId"
                    value={form.email} onChange={handleChange}
                    placeholder="Enter Email or Username"
                    className="lp-input"
                    autoComplete="off" autoCorrect="off" autoCapitalize="none"
                    spellCheck={false} readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div className="lp-field">
                <label className="lp-lbl" htmlFor="lp-pwd">Password</label>
                <div className="lp-ctrl">
                  <Lock className="lp-ctrl-ico" aria-hidden="true" />
                  <input
                    id="lp-pwd" type={showPassword ? 'text' : 'password'}
                    name="loginPassword"
                    value={form.password} onChange={handleChange}
                    placeholder="Enter Password"
                    className="lp-input lp-pwd-input"
                    autoComplete="new-password" readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="lp-eye-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeOff className="lp-eye-ico" aria-hidden="true" />
                      : <Eye    className="lp-eye-ico" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="lp-opts">
                <label className="lp-remember">
                  <input type="checkbox" className="lp-chk" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="lp-forgot">Forgot Password?</button>
              </div>

              {/* Login button */}
              <button type="submit" disabled={loading} className="lp-btn-submit">
                {loading
                  ? <><span className="lp-spinner" /> LOGGING IN</>
                  : <><LogIn className="lp-btn-ico" aria-hidden="true" /> LOGIN</>
                }
              </button>

              {/* OR divider */}
              <div className="lp-or">
                <span /><small>or</small><span />
              </div>

              {/* Secure Login */}
              <button type="button" className="lp-btn-secure">
                <ShieldCheck className="lp-btn-ico" aria-hidden="true" />
                Secure Login
              </button>

              {/* Card footer note */}
              <div className="lp-card-footer">
                <p className="lp-cf-line1">
                  New to <strong>MythoQuantum Explorers</strong>?
                </p>
                <p className="lp-cf-line2">Contact your system administrator</p>
              </div>

            </form>
          </div>
        </div>
      </div>

      {/* ── Bottom footer bar ── */}
      <footer className="lp-footer">
        <div className="lp-footer-l">
          <Lock className="lp-footer-ico" aria-hidden="true" />
          <span>Secure Access | MythoQuantum Explorers  VyanX Hospital Management System</span>
        </div>
        <div className="lp-footer-r">
          Powered by <strong>MythoQuantum Explorers</strong>
        </div>
      </footer>
    </main>
  );
}
