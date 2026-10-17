import { NavLink, useLocation } from 'react-router-dom';
import { usePatientAuth } from '../../context/PatientAuthContext';
import { useState, useEffect, useCallback } from 'react';
import patientApi from '../../utils/patientApi';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/patient/portal/dashboard', icon: 'grid' },
  { label: 'My Appointments', path: '/patient/portal/appointments', icon: 'calendar', notifyType: 'APPOINTMENT' },
  { label: 'Admissions', path: '/patient/portal/admissions', icon: 'bed' },
  { label: 'OT & Surgery', path: '/patient/portal/ot-surgery', icon: 'activity', notifyType: 'OT_SCHEDULED' },
  { label: 'Recovery Status', path: '/patient/portal/recovery', icon: 'heart' },
  { label: 'Prescriptions', path: '/patient/portal/prescriptions', icon: 'file-text' },
  { label: 'Lab Reports', path: '/patient/portal/lab-reports', icon: 'flask', notifyType: 'LAB_REPORT' },
  { label: 'Bills & Payments', path: '/patient/portal/bills', icon: 'dollar-sign', notifyType: 'BILL' },
  { label: 'Notifications', path: '/patient/portal/notifications', icon: 'bell', notifyType: 'TOTAL' },
  { label: 'Profile', path: '/patient/portal/profile', icon: 'user' },
];

function Icon({ name, className }) {
  const cls = `w-5 h-5 ${className || ''}`;
  const icons = {
    grid: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    calendar: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    timeline: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    bed: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    'file-text': <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    flask: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    activity: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    heart: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    pulse: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    'dollar-sign': <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    folder: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    bell: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    user: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    'chevron-left': <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
    'chevron-right': <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    menu: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
    x: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    logout: <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  };
  return icons[name] || null;
}

export default function PatientPortalSidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const { patient, logout } = usePatientAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [counts, setCounts] = useState({});
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('navDismissed') || '{}'); } catch { return {}; }
  });

  const fetchCounts = useCallback(async () => {
    try {
      const r = await patientApi.get('/patient/portal/notification-counts', { silent: true });
      setCounts(r.data?.counts || {});
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const getBadge = (item) => {
    if (!item.notifyType) return null;
    const raw = item.notifyType === 'TOTAL'
      ? Object.values(counts).reduce((s, v) => s + v, 0)
      : (counts[item.notifyType] || 0);
    const seen = dismissed[item.path] || 0;
    const badge = raw - seen;
    return badge > 0 ? badge : null;
  };

  const handleNavClick = (item) => {
    if (item.notifyType) {
      const raw = item.notifyType === 'TOTAL'
        ? Object.values(counts).reduce((s, v) => s + v, 0)
        : (counts[item.notifyType] || 0);
      const next = { ...dismissed, [item.path]: raw };
      setDismissed(next);
      localStorage.setItem('navDismissed', JSON.stringify(next));
    }
    setMobileOpen(false);
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavItem = ({ item, onClick }) => {
    const active = isActive(item.path);
    return (
      <NavLink
        to={item.path}
        onClick={onClick}
        className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          collapsed ? 'justify-center px-2' : ''
        } ${active ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/8'}`}
      >
        <Icon name={item.icon} className={`shrink-0 transition ${active ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
        {!collapsed && <span className="truncate flex-1">{item.label}</span>}
        {(() => {
          const badge = getBadge(item);
          if (badge === null) return null;
          return (
            <span className={`${collapsed ? 'absolute -top-1 -right-1' : ''} min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none shadow-lg`}>
              {badge > 99 ? '99+' : badge}
            </span>
          );
        })()}
        {active && !collapsed && !getBadge(item) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
      </NavLink>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed md:sticky top-0 z-50 h-screen flex flex-col transition-all duration-300 bg-gradient-to-b from-[#0a1628] via-[#0f1f3d] to-[#0a1628] border-r border-white/5 ${
        mobileOpen ? 'left-0' : '-left-72 md:left-0'
      } ${collapsed ? 'md:w-[72px]' : 'md:w-[260px]'}`}
        style={{ boxShadow: mobileOpen ? '0 0 40px rgba(0,0,0,0.3)' : 'none' }}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5 min-h-[72px]">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0">
            <img src="/mqe_logo.png" alt="VyanX" className="w-7 h-7 object-contain" draggable={false} />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">Patient Portal</p>
              <p className="text-[10px] text-blue-300/70 truncate font-mono">{patient?.uhid || ''}</p>
            </div>
          )}
          <button onClick={() => { if (setCollapsed) setCollapsed(c => !c); }} className="hidden md:flex p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/80 transition">
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} className="w-4 h-4" />
          </button>
          <button onClick={() => setMobileOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/80 transition">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} onClick={() => handleNavClick(item)} />
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/5 space-y-2">
          {!collapsed && patient && (
            <div className="px-3 py-2 rounded-xl bg-white/5 mb-1">
              <p className="text-xs font-bold text-white truncate">{patient?.name}</p>
              <p className="text-[10px] text-blue-300/60">Patient</p>
            </div>
          )}
          <button onClick={() => setConfirmLogout(true)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-all w-full ${collapsed ? 'justify-center px-2' : ''}`}>
            <Icon name="logout" className="shrink-0 w-5 h-5" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {confirmLogout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800">Logout</h3>
            <p className="text-sm text-gray-500 mt-2">Are you sure you want to logout?</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => { logout(); window.location.href = '/patient/login'; }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-600 transition">Logout</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
