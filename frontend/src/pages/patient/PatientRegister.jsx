import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePatientAuth } from '../../context/PatientAuthContext';

export default function PatientRegister() {
  const navigate = useNavigate();
  const { register } = usePatientAuth();
  const [form, setForm] = useState({
    name: '', mobile: '', dob: '', age: '', gender: '', address: '',
    password: '', confirmPassword: '', bloodGroup: '', allergies: '',
    heightCm: '', weightKg: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '', aadhaarId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.gender || !form.password) { setError('Name, gender, and password are required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (!form.mobile && !form.aadhaarId) { setError('Mobile or Aadhaar is required'); return; }

    setLoading(true);
    try {
      await register(form);
      navigate('/patient/portal/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: '#ffffff', border: '1.5px solid #e2e8f0', color: '#1e293b' };
  const inputFocus = (e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.08)'; };
  const inputBlur  = (e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; };

  const fieldWrap = { marginBottom: '14px' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' };
  const baseInput = { ...inputStyle, width: '100%', borderRadius: '11px', padding: '11px 14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'all 0.15s' };

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)', padding: '20px 12px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: '760px' }}>

        {/* Back to login */}
        <Link to="/patient/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          fontSize: '13px', fontWeight: 600, color: '#1d4ed8',
          textDecoration: 'none', marginBottom: '16px',
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Login
        </Link>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 10px',
            background: '#eff1fb', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.5" stroke="#3b4ed6" strokeWidth="1.8" />
              <path d="M4.5 20c0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5" stroke="#3b4ed6" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: '21px', fontWeight: 800, color: '#1d4ed8', margin: '0 0 4px' }}>Patient Registration</h1>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>Create your patient portal account</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="px-4 py-6 sm:px-6 sm:py-7 md:px-8 md:py-7" style={{
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(255,255,255,0.6)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 60px rgba(30,58,138,0.12), 0 2px 8px rgba(30,58,138,0.05)',
          boxSizing: 'border-box',
        }}>
          {error && (
            <div style={{ borderRadius: '10px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Basic details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0 mb-1">
            <div style={fieldWrap}>
              <label style={labelStyle}>Full Name *</label>
              <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                     value={form.name} onChange={set('name')} placeholder="Patient name" />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Mobile</label>
              <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                     value={form.mobile} onChange={set('mobile')} placeholder="10-digit mobile" maxLength={10} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Date of Birth</label>
              <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                     type="date" value={form.dob} onChange={set('dob')} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Age</label>
              <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                     type="number" value={form.age} onChange={set('age')} placeholder="Years" />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Gender *</label>
              <select style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                      value={form.gender} onChange={set('gender')}>
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Aadhaar ID</label>
              <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                     value={form.aadhaarId} onChange={set('aadhaarId')} placeholder="Optional" />
            </div>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>Address</label>
            <textarea style={{ ...baseInput, resize: 'none' }} onFocus={inputFocus} onBlur={inputBlur}
                      rows={2} value={form.address} onChange={set('address')} placeholder="Address" />
          </div>

          {/* Credentials */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px', marginTop: '6px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8', margin: '0 0 14px' }}>Portal Login Credentials</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0">
              <div style={fieldWrap}>
                <label style={labelStyle}>Password *</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       type="password" value={form.password} onChange={set('password')} placeholder="Min 6 characters" />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Confirm Password *</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Re-enter password" />
              </div>
            </div>
          </div>

          {/* Medical & Emergency */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px', marginTop: '6px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8', margin: '0 0 14px' }}>Medical &amp; Emergency (Optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-0">
              <div style={fieldWrap}>
                <label style={labelStyle}>Blood Group</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       value={form.bloodGroup} onChange={set('bloodGroup')} />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Height (cm)</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       type="number" value={form.heightCm} onChange={set('heightCm')} />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Weight (kg)</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       type="number" value={form.weightKg} onChange={set('weightKg')} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-0 mt-0">
              <div style={fieldWrap}>
                <label style={labelStyle}>Emergency Contact</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       value={form.emergencyName} onChange={set('emergencyName')} placeholder="Name" />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Emergency Phone</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       value={form.emergencyPhone} onChange={set('emergencyPhone')} placeholder="Phone" />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Relation</label>
                <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                       value={form.emergencyRelation} onChange={set('emergencyRelation')} placeholder="Relation" />
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Allergies</label>
              <input style={baseInput} onFocus={inputFocus} onBlur={inputBlur}
                     value={form.allergies} onChange={set('allergies')} placeholder="List allergies if any" />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', borderRadius: '12px', padding: '14px 20px', marginTop: '8px',
              fontSize: '14px', fontWeight: 700, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 6px 18px rgba(37,99,235,0.35)',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(37,99,235,0.35)'; }}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '12.5px', color: '#475569', margin: '16px 0 0' }}>
            Already have an account?{' '}
            <Link to="/patient/login" style={{ fontWeight: 700, color: '#2563eb', textDecoration: 'underline' }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
