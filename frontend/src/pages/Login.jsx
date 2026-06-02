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
} from 'lucide-react';
import './Login.css';

const ROLES = [
  { value: 'pharmacist', label: 'Pharmacy' },
];

const toBackendRole = (role) => (role ? role.toUpperCase() : role);

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const [form, setForm]             = useState({ role: '', email: '', password: '' });
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.role)                    return setError('Please select your role');
    if (!form.email || !form.password) return setError('Please enter both email and password');

    setLoading(true);
    try {
      const user = await login(form.email, form.password, toBackendRole(form.role));
      navigate(getDashboardPath(user.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="lp-page">
      <section className="lp-shell" aria-label="New H.T. Hospital login">

        {/* ── LEFT PANEL ── */}
        <div className="lp-leftPanel">
          {/* Brand overlay on top of photo */}
          <div className="lp-brandBlock">
            <img className="lp-logo" src="/hospital-logo.png" alt="New H.T. Hospital logo" />
            <div className="lp-brandCopy">
              <h1>NEW H.T. HOSPITAL</h1>
              <p>PHARMACY MANAGEMENT SYSTEM</p>
              <div className="lp-ecgLine" aria-hidden="true"><span /></div>
            </div>
          </div>

          {/* Full-bleed hospital photo */}
          <div className="lp-hospitalVisual">
            <img src="/hospital-building.jpg" alt="New H.T. Hospital building" />
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lp-rightPanel">
          {/* Mobile-only brand header */}
          <div className="lp-mobileBrand">
            <img className="lp-mobileLogo" src="/hospital-logo.png" alt="New H.T. Hospital logo" />
            <div>
              <h2>NEW H.T. HOSPITAL</h2>
              <p>PHARMACY MANAGEMENT SYSTEM</p>
            </div>
          </div>

          <div className="lp-loginCard">
            <div className="lp-cardHeader">
              <h2>Welcome Back!</h2>
              <div className="lp-subtitleRule">
                <span />
                <p>Please login to continue to your account</p>
                <span />
              </div>
            </div>

            {error && (
              <div className="lp-errorBox" role="alert">
                <AlertCircle className="lp-errorIcon" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="lp-form">
              {/* Role */}
              <div className="lp-field">
                <label htmlFor="role">Role</label>
                <div className="lp-control">
                  <UserRound className="lp-controlIcon" aria-hidden="true" />
                  <select
                    id="role"
                    name="role"
                    value={form.role}
                    onChange={handleChange}
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

              {/* Username */}
              <div className="lp-field">
                <label htmlFor="email">Username</label>
                <div className="lp-control">
                  <User className="lp-controlIcon" aria-hidden="true" />
                  <input
                    id="email"
                    type="text"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter Username"
                    className="lp-input"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div className="lp-field">
                <label htmlFor="password">Password</label>
                <div className="lp-control">
                  <Lock className="lp-controlIcon" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter Password"
                    className="lp-input lp-passwordInput"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="lp-eyeBtn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeOff className="lp-eyeIcon" aria-hidden="true" />
                      : <Eye    className="lp-eyeIcon" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="lp-submit">
                {loading ? (
                  <><span className="lp-spinner" aria-hidden="true" /> LOGGING IN</>
                ) : (
                  <><LogIn className="lp-submitIcon" aria-hidden="true" /> LOGIN</>
                )}
              </button>

              <div className="lp-orRow" aria-hidden="true">
                <span /><small>or</small><span />
              </div>

              <button type="button" className="lp-forgotBtn">
                Forgot Password?
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <span />
        <p>Powered by <strong>Mythoquantum Explorers</strong> </p>
        <span />
      </footer>
    </main>
  );
}
