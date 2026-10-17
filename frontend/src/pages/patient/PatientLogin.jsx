import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePatientAuth } from '../../context/PatientAuthContext';

export default function PatientLogin() {
  const navigate    = useNavigate();
  const { login }   = usePatientAuth();
  const [uhid, setUhid]         = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const t = uhid.trim();
    if (!t || !password) { setError('Please enter UHID and password'); return; }
    setLoading(true);
    try {
      await login(t, password);
      navigate('/patient/portal/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const features = [
    { l: 'Book Appointments',  s: 'Schedule visits with your doctors',   d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { l: 'View Reports',       s: 'Access your lab and test reports',     d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { l: 'View Prescriptions', s: 'See your prescriptions and medicines', d: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { l: 'Track Your Care',    s: 'Track vitals, history and more',       d: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { l: 'Download Bills',     s: 'View and download your bills',         d: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  ];

  const trust = [
    { l: 'Secure & Encrypted',    s: 'Your data is protected',  d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { l: 'Private & Confidential', s: 'We respect your privacy', d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { l: '24/7 Access',           s: 'Access anytime, anywhere', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { l: 'Dedicated Support',     s: 'We are here to help',     d: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z' },
  ];

  const ff   = "'Outfit', 'Inter', 'Segoe UI', sans-serif";
  const blue = '#0077B6';

  const inp = {
    width: '100%', boxSizing: 'border-box',
    paddingLeft: 38, paddingRight: 16, paddingTop: 9.5, paddingBottom: 9.5,
    fontSize: 13.5, borderRadius: 10, fontFamily: ff,
    border: '1.5px solid #e2e8f0', background: '#f8fafc',
    color: '#0f172a', outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
  };
  const onF = e => { e.target.style.borderColor = blue; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(0,119,182,.10)'; };
  const onB = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; };

  const CrossEye = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
    </svg>
  );
  const Eye = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  );

  const PlusLogo = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="20" rx="1.5" fill="white"/>
      <rect x="2" y="9" width="20" height="6" rx="1.5" fill="rgba(255,255,255,.72)"/>
    </svg>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: ff, overflow: 'hidden', background: '#fff' }}>

      {/* ══ HEADER ══ */}
      <header style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '12px 16px' : '16px 40px',
        background: '#fff',
        borderBottom: '1px solid #dde6ec',
        zIndex: 30
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14 }}>
          <div style={{
            width: isMobile ? 36 : 46,
            height: isMobile ? 36 : 46,
            borderRadius: isMobile ? 10 : 12,
            background: blue,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(0,119,182,.28)'
          }}>
            <PlusLogo size={isMobile ? 18 : 24}/>
          </div>
          <div>
            <p style={{ margin: 0, lineHeight: 1.1, fontSize: isMobile ? 15 : 17, fontWeight: 800, color: '#001B48', letterSpacing: '0.2px' }}>VyanX</p>
            {!isMobile && (
              <p style={{ margin: '3px 0 0', lineHeight: 1.1, fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>Care. Compassion. Excellence.</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
          <svg width={isMobile ? 15 : 18} height={isMobile ? 15 : 18} fill="none" stroke="#64748b" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
          </svg>
          {!isMobile && (
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>Need Help?</span>
          )}
          <a href="tel:18001234567" style={{ fontSize: isMobile ? 13.5 : 14.5, fontWeight: 700, color: blue, textDecoration: 'none' }}>1800-123-4567</a>
        </div>
      </header>

      {/* ══ BODY — left image | right card ══ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>

        {/* Background Image spans the entire width under both panels */}
        <img
          src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=1400&q=85"
          alt="Hospital Building"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 1 }}
        />

        {/* ─── LEFT PANEL ─── */}
        {!isMobile && (
          <div style={{ position: 'relative', flex: '0 0 58%', overflow: 'hidden', zIndex: 2 }}>
            {/* Gradient: left side slightly whiter for text readability, fades to transparent right */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.65) 60%, rgba(255,255,255,0.1) 100%)', zIndex: 1 }}/>

            {/* ── Text overlay ── */}
            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 70 }}>
              <div style={{ maxWidth: 480 }}>
                <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#334155', letterSpacing: '0.5px' }}>Welcome to</p>
                <h1 style={{ margin: 0, fontSize: 58, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1px' }}>
                  <span style={{ color: '#0f172a' }}>Patient </span>
                  <span style={{ color: blue }}>Portal</span>
                </h1>
                <div style={{ width: 70, height: 5, borderRadius: 2.5, background: blue, margin: '16px 0 22px' }}/>
                <p style={{ margin: '0 0 32px', fontSize: 16.5, lineHeight: 1.7, color: '#475569', maxWidth: 420 }}>
                  Access your health information, book appointments, and manage your healthcare anytime, anywhere.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(0,119,182,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}>
                        <svg width="20" height="20" fill="none" stroke={blue} strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={f.d}/>
                        </svg>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0f172a' }}>{f.l}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 13.5, color: '#64748b', fontWeight: 500 }}>{f.s}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── RIGHT PANEL: glassmorphic blur overlay + card ─── */}
        <div style={{
          position: 'relative',
          flex: isMobile ? '1 0 100%' : '0 0 42%',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(12px) saturate(120%)',
          WebkitBackdropFilter: 'blur(12px) saturate(120%)',
          borderLeft: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.35)',
          display: 'flex',
          overflow: 'hidden',
          padding: isMobile ? '16px' : '16px 24px',
          zIndex: 2
        }}>
          <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 380, margin: 'auto' }}>

            {/* CARD */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 56px rgba(0,0,0,0.08), 0 2px 10px rgba(0,0,0,0.04)',
              padding: isMobile ? '16px 20px 14px' : '16px 24px 14px'
            }}>

              {/* Logo */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,119,182,0.28)', marginBottom: 6 }}>
                  <PlusLogo size={20}/>
                </div>
                <p style={{ margin: '0 0 1px', fontSize: 14.5, fontWeight: 800, color: '#001B48', letterSpacing: '0.2px' }}>VyanX</p>
                <p style={{ margin: 0, fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>Care. Compassion. Excellence.</p>
              </div>

              {/* Avatar + title */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#EBF5FB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 52 52">
                    <circle cx="26" cy="17" r="9" stroke={blue} strokeWidth="2.2"/>
                    <path d="M7 46c0-10.493 8.507-19 19-19s19 8.507 19 19" stroke={blue} strokeWidth="2.2" strokeLinecap="round"/>
                    <circle cx="39.5" cy="37.5" r="7" fill={blue}/>
                    <path d="M39.5 33.5v8M35.5 37.5h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <h2 style={{ margin: '0 0 1px', fontSize: 20, fontWeight: 900, color: '#001B48' }}>Patient Login</h2>
                <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Login using your UHID, RCG number, or mobile</p>
              </div>

              {/* FORM */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {error && (
                  <div style={{ borderRadius: 8, padding: '7px 11px', fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: 500 }}>
                    {error}
                  </div>
                )}

                {/* UHID */}
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>UHID / RCG Number / Mobile</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'flex' }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                      </svg>
                    </span>
                    <input type="text" value={uhid} onChange={e => setUhid(e.target.value)} placeholder="Enter UHID, RCG number or mobile" required style={inp} onFocus={onF} onBlur={onB}/>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'flex' }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                    </span>
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required style={{ ...inp, paddingRight: 38 }} onFocus={onF} onBlur={onB}/>
                    <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                      {showPwd ? <CrossEye/> : <Eye/>}
                    </button>
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 4 }}>
                    <Link to="/patient/forgot-password" style={{ fontSize: 11.5, fontWeight: 600, color: blue, textDecoration: 'none' }}>Forgot Password?</Link>
                  </div>
                </div>

                {/* Login btn */}
                <button type="submit" disabled={loading}
                  style={{ width: '100%', borderRadius: 10, padding: '10px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', background: blue, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: ff, transition: 'background .15s' }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#005f8e'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = blue; }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h5a3 3 0 013 3v1"/>
                  </svg>
                  {loading ? 'Signing in…' : 'Login'}
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: '#eaeff4' }}/><span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>or</span><div style={{ flex: 1, height: 1, background: '#eaeff4' }}/>
                </div>

                {/* Register */}
                <Link to="/patient/register"
                  style={{ width: '100%', borderRadius: 10, padding: '9.5px 20px', fontSize: 12.5, fontWeight: 700, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: blue, border: '1.5px solid #b3d4e8', background: '#fff', textDecoration: 'none', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EBF5FB'; e.currentTarget.style.borderColor = blue; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#b3d4e8'; }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                  </svg>
                  Register as New Patient
                </Link>

                {/* Trust */}
                <div style={{ textAlign: 'center', paddingTop: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                    <svg width="14" height="14" fill="none" stroke={blue} strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>Your health, our priority.</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Secure &nbsp;•&nbsp; Private &nbsp;•&nbsp; Trusted</p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <footer style={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: isMobile ? '12px 20px' : '12px',
        padding: isMobile ? '12px 16px' : '16px 40px',
        background: '#f8fafc',
        borderTop: '1px solid #dde6ec'
      }}>
        {trust.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
            <div style={{
              width: isMobile ? 32 : 42,
              height: isMobile ? 32 : 42,
              borderRadius: '50%',
              background: '#EBF5FB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg width={isMobile ? 14 : 18} height={isMobile ? 14 : 18} fill="none" stroke={blue} strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={t.d}/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: isMobile ? 12 : 13.5, fontWeight: 700, color: '#1e293b' }}>{t.l}</p>
              {!isMobile && (
                <p style={{ margin: '1.5px 0 0', fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>{t.s}</p>
              )}
            </div>
          </div>
        ))}
      </footer>
    </div>
  );
}
