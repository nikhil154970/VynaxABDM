import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import PharmacySidebar from './pharmacy/PharmacySidebar';
import { startNavigationLoading } from '../utils/loadingBus';
import api from '../utils/api';
import {
  MdDashboard, MdPeople, MdCalendarToday, MdLocalHospital,
  MdBed, MdReceiptLong, MdNotifications, MdPerson, MdLogout,
  MdExpandMore, MdExpandLess, MdChevronLeft, MdChevronRight,
  MdAdminPanelSettings, MdMedicalServices, MdScience,
  MdLocalPharmacy, MdBarChart, MdSettings, MdVpnKey,
  MdMonitorHeart, MdAttachMoney, MdGroups, MdWarning,
  MdMenu, MdClose, MdExitToApp, MdAssignment
} from 'react-icons/md';

const ROLE_MENUS = {
  super_admin: [
    { label: 'Dashboard', icon: MdDashboard, children: [
      { label: 'Overview', path: '/dashboard/admin' },
      { label: 'Revenue Snapshot', path: '/dashboard/admin/revenue-snapshot' },
    ]},
    { label: 'User & Access', icon: MdVpnKey, children: [
      { label: 'All Users', path: '/dashboard/admin/users' },
      { label: 'Create User', path: '/dashboard/admin/users/create' },
      { label: 'Activity Logs', path: '/dashboard/admin/logs' },
    ]},
    { label: 'Doctor Management', icon: MdMedicalServices, children: [
      { label: 'All Doctors', path: '/dashboard/admin/doctors' },
      { label: 'Add Doctor', path: '/dashboard/admin/doctors/add' },
      { label: 'Availability', path: '/dashboard/admin/doctors/availability' },
    ]},
    { label: 'Patient Intelligence', icon: MdMonitorHeart, children: [
      { label: 'All Patients', path: '/dashboard/admin/patients' },
      { label: 'Patient History', path: '/dashboard/admin/patients/history' },
      { label: 'Patient Analytics', path: '/dashboard/admin/patients/analytics' },
    ]},
    { label: 'Appointment & OPD', icon: MdCalendarToday, children: [
      { label: 'All Appointments', path: '/dashboard/admin/appointments' },
      // { label: 'Book Appointment', path: '/dashboard/admin/appointments/book' },
      // { label: 'OPD Records', path: '/dashboard/admin/opd' },
      // { label: 'Queue / Token', path: '/dashboard/admin/opd/queue' },
      { label: 'OPD Analytics', path: '/dashboard/admin/opd/analytics' },
    ]},
    { label: 'IPD & Admission', icon: MdBed, children: [
      { label: 'Active Admissions', path: '/dashboard/admin/ipd' },
      // { label: 'Admit Patient', path: '/dashboard/admin/ipd/admit' },
      { label: 'IPD Analytics', path: '/dashboard/admin/ipd/analytics' },
    ]},
    { label: 'Bed & Resource', icon: MdLocalHospital, children: [
      { label: 'Live Bed Tracker', path: '/dashboard/admin/beds' },
      { label: 'Add / Edit Beds', path: '/dashboard/admin/beds/manage' },
      { label: 'Occupancy Analytics', path: '/dashboard/admin/beds/analytics' },
    ]},
    { label: 'Lab Management', icon: MdScience, children: [
      { label: 'Lab Tests', path: '/dashboard/admin/lab/tests' },
    ]},
    { label: 'Financial', icon: MdAttachMoney, children: [
      { label: 'All Bills', path: '/dashboard/admin/finance/bills' },
      { label: 'Revenue Analytics', path: '/dashboard/admin/finance/analytics' },
    ]},
    { label: 'Alerts', icon: MdWarning, children: [
      { label: 'Critical Alerts', path: '/dashboard/admin/alerts/critical' },
      { label: 'System Notifications', path: '/dashboard/admin/alerts/system' },
    ]},
    { label: 'System Settings', icon: MdSettings, children: [
      { label: 'Hospital Information', path: '/dashboard/admin/settings/hospital' },
      { label: 'Security Settings', path: '/dashboard/admin/settings/security' },
      { label: 'ABDM Consents', path: '/dashboard/admin/abdm/consents' },
      { label: 'Profile', path: '/dashboard/admin/settings/profile' },
    ]},
  ],

  receptionist: [
    { label: 'Dashboard', icon: MdDashboard, children: [
      { label: 'Overview', path: '/dashboard/reception' },
      // { label: 'Today Summary', path: '/dashboard/reception/summary' },
    ]},
    { label: 'Patients', icon: MdPeople, children: [
      { label: 'Register Patient', path: '/dashboard/reception/patients/register' },
      { label: 'Patient List', path: '/dashboard/reception/patients' },
    ]},
    { label: 'Appointments', icon: MdCalendarToday, children: [
      { label: 'Book Appointment', path: '/dashboard/reception/appointments/book' },
      { label: 'Appointment List', path: '/dashboard/reception/appointments' },
      // { label: 'Token / Queue', path: '/dashboard/reception/queue' },
    ]},
    { label: 'OPD', icon: MdMedicalServices, children: [
      { label: "Today's OPD", path: '/dashboard/reception/opd' },
      { label: 'Consultation History', path: '/dashboard/reception/opd/history' },
    ]},
    { label: 'IPD', icon: MdBed, children: [
      { label: 'Direct IPD Admit', path: '/dashboard/reception/ipd/admit' },
      { label: 'Active Admissions', path: '/dashboard/reception/ipd' },
      { label: 'Transfers', path: '/dashboard/reception/ipd/transfers' },
      { label: 'Recovery Transfers', path: '/dashboard/reception/ipd/recovery-transfers' },
      { label: 'Transfer History', path: '/dashboard/reception/ipd/transfers/history' },
    ]},
    { label: 'Discharge', icon: MdExitToApp, children: [
      { label: 'Discharge Requests', path: '/dashboard/reception/ipd/today-discharge' },
      { label: 'Discharge History', path: '/dashboard/reception/ipd/discharge/history' },
    ]},
    { label: 'Bed Management', icon: MdLocalHospital, children: [
      { label: 'Bed Status', path: '/dashboard/reception/beds' },
      { label: 'Live Bed Tracker', path: '/dashboard/reception/beds/live-tracker' },
    ]},
    { label: 'Billing', icon: MdReceiptLong, children: [
      { label: 'Generate Bill', path: '/dashboard/reception/billing/generate' },
      { label: 'All Bills', path: '/dashboard/reception/billing' },
      // { label: 'Payments', path: '/dashboard/reception/billing/payments' },
      // { label: 'Pending Dues', path: '/dashboard/reception/billing/dues' },
    ]},
    { label: 'Lab Billing', icon: MdScience, children: [
      { label: 'Create new bill', path: '/dashboard/reception/lab/create-bill' },
      { label: 'All lab billing', path: '/dashboard/reception/lab/bills' },
      { label: 'Pending payment', path: '/dashboard/reception/lab/pending-payment' },
      { label: 'Advised Lab Tests', path: '/dashboard/reception/lab/advised' },
      { label: 'Lab reports', path: '/dashboard/reception/lab/reports' },
    ]},
    { label: 'OT Requests', icon: MdMedicalServices, children: [
      { label: 'All OT Requests', path: '/dashboard/reception/ot-requests' },
      { label: 'Generate OT Bill', path: '/dashboard/reception/ot-requests/generate-bill' },
      { label: 'Approved For OT', path: '/dashboard/reception/ot-requests/approved' },
    ]},
    { label: 'Notifications', icon: MdNotifications, children: [
      { label: 'Pending Actions', path: '/dashboard/reception/notifications/pending' },
      { label: 'Alerts', path: '/dashboard/reception/notifications/alerts' },
    ]},
    // { label: 'Profile', icon: MdPerson, children: [
    //   { label: 'My Profile', path: '/dashboard/reception/profile' },
    // ]},
  ],

  doctor: [
    { label: 'Dashboard', icon: MdDashboard, children: [
      { label: 'Dashboard', path: '/dashboard/doctor' },
    ]},
    { label: 'Appointments', icon: MdCalendarToday, children: [
      { label: 'Today Appointments', path: '/dashboard/doctor/appointments/today' },
      { label: 'Appointment List', path: '/dashboard/doctor/appointments' },
    ]},
    { label: 'OPD', icon: MdMedicalServices, children: [
      { label: 'Assigned Patients', path: '/dashboard/doctor/opd' },
      { label: 'Consultation', path: '/dashboard/doctor/opd/consultation' },
    ]},
    { label: 'IPD', icon: MdBed, children: [
      { label: 'My Patients', path: '/dashboard/doctor/ipd' },
      { label: 'Patient Detail', path: '/dashboard/doctor/ipd/detail' },
    ]},
    // { label: 'Lab Requests', icon: MdScience, children: [
    //   { label: 'Create Request', path: '/dashboard/doctor/lab/request' },
    //   { label: 'View Reports', path: '/dashboard/doctor/lab/reports' },
    // ]},
    { label: 'OT Schedule', icon: MdLocalHospital, children: [
      { label: 'My OT Schedule', path: '/dashboard/doctor/ot/schedule' },
      { label: 'All OT Recovery', path: '/dashboard/doctor/ot/recovery' },
    ]},
    { label: 'Patient History', icon: MdMonitorHeart, children: [
      { label: 'Search Patient', path: '/dashboard/doctor/history/search' },
      { label: 'Full Medical History', path: '/dashboard/doctor/history' },
    ]},
    { label: 'Notifications', icon: MdNotifications, children: [
      { label: 'Alerts', path: '/dashboard/doctor/notifications/alerts' },
      { label: 'Updates', path: '/dashboard/doctor/notifications/updates' },
    ]},
  ],

  nurse: [
    { label: 'Dashboard', icon: MdDashboard, children: [
      { label: 'Overview', path: '/dashboard/nurse' },
      // { label: "Today's Patients", path: '/dashboard/nurse/summary' },
    ]},
    { label: 'IPD Patients', icon: MdBed, children: [
      { label: 'Assigned Patients', path: '/dashboard/nurse/ipd' },
      { label: 'Update Patients record', path: '/dashboard/nurse/ipd/details' },
      { label: 'Discharge Approval', path: '/dashboard/nurse/ipd/discharge-approval' },
    ]},
    { label: 'OT Request', icon: MdMedicalServices, children: [
      { label: 'Pre Assessment', path: '/dashboard/nurse/pre-assessment' },
      { label: 'OT Request Status', path: '/dashboard/nurse/ot-requests' },
    ]},
    { label: 'OT Patient', icon: MdMonitorHeart, children: [
      { label: 'Assigned Patients', path: '/dashboard/nurse/ot-patients' },
    ]},
    { label: 'Duty Schedule', icon: MdAssignment, children: [
      { label: 'My Schedule', path: '/dashboard/nurse/duty-schedule' },
    ]},
    { label: 'Nursing Notes', icon: MdReceiptLong, children: [
      { label: 'Add Notes', path: '/dashboard/nurse/notes/add' },
      { label: 'View Notes', path: '/dashboard/nurse/notes' },
    ]},
    { label: 'Notifications', icon: MdNotifications, children: [
      { label: 'Alerts', path: '/dashboard/nurse/notifications' },
    ]},
    // { label: 'Profile', icon: MdPerson, children: [
    //   { label: 'My Profile', path: '/dashboard/nurse/profile' },
    // ]},
  ],

  lab_technician: [
      { label: 'Dashboard', icon: MdDashboard, children: [
        { label: 'Overview', path: '/dashboard/lab' },
      ]},
      { label: 'Test Orders', icon: MdScience, children: [
        // { label: 'All Orders', path: '/dashboard/lab/orders' },
        { label: 'Sample Collection', path: '/dashboard/lab/samples' },
        { label: 'Result Entry', path: '/dashboard/lab/results' },
      ]},
     
      { label: 'Reports', icon: MdBarChart, children: [
        { label: 'Generate Report', path: '/dashboard/lab/reports/generate' },
       //
      ]},
       { label: 'Notifications', icon: MdNotifications, children: [
        { label: 'Lab updates', path: '/dashboard/lab/notifications' },
      ]},
      // { label: 'Profile', icon: MdPerson, children: [
      //   { label: 'My Profile', path: '/dashboard/lab/profile' },
      // ]},
    ],
  hr_manager: [
    { label: 'Dashboard', icon: MdDashboard, children: [
      { label: 'Overview', path: '/dashboard/hr' },
    ]},
    { label: 'Employee Management', icon: MdGroups, children: [
      { label: 'All Employees', path: '/dashboard/hr/employees' },
      { label: 'Departments', path: '/dashboard/hr/employees/departments' },
    ]},
    { label: 'Staff Allocation', icon: MdMedicalServices, children: [
      { label: 'Allocation Requests', path: '/dashboard/hr/staff-allocation/requests' },
      { label: 'Nurse Allocation', path: '/dashboard/hr/staff-allocation/nurse' },
      { label: 'Patient Staff Allocation', path: '/dashboard/hr/staff-allocation/patient' },
    ]},
    { label: 'Shift Management', icon: MdCalendarToday, children: [
      { label: 'Shifts', path: '/dashboard/hr/shifts' },
      { label: 'Staff Availability', path: '/dashboard/hr/shifts/availability' },
      { label: 'Duty Roster', path: '/dashboard/hr/duty-roster' },
    ]},
    { label: 'Reports', icon: MdBarChart, children: [
      { label: 'View Reports', path: '/dashboard/hr/reports' },
    ]},
    { label: 'Notifications', icon: MdNotifications, children: [
      { label: 'Alerts', path: '/dashboard/hr/notifications' },
    ]},
  ],

  ot_technician: [
    { label: 'Dashboard', icon: MdDashboard, children: [
      { label: 'Overview', path: '/dashboard/ot' },
    ]},
    { label: 'OT Operations', icon: MdMedicalServices, children: [
      { label: 'OT Requests', path: '/dashboard/ot/requests' },
      { label: "Today's Surgeries", path: '/dashboard/ot/today' },
      { label: 'Upcoming Surgeries', path: '/dashboard/ot/upcoming' },
      { label: 'Delayed Surgeries', path: '/dashboard/ot/delayed' },
    ]},
    { label: 'Surgery Management', icon: MdLocalHospital, children: [
      { label: 'Surgery Scheduling', path: '/dashboard/ot/surgery/schedule' },
      { label: 'In Progress Surgeries', path: '/dashboard/ot/surgery/in-progress' },
      { label: 'Recovery Room', path: '/dashboard/ot/recovery' },
      { label: 'Post-Surgery Notes', path: '/dashboard/ot/post-surgery' },
      { label: 'Completed Surgeries', path: '/dashboard/ot/surgery/completed' },
    ]},
    { label: 'Resource Management', icon: MdSettings, children: [
      { label: 'OT Rooms', path: '/dashboard/ot/rooms' },
      { label: 'Equipment Allocation', path: '/dashboard/ot/equipment' },
      { label: 'Medicine Tracking', path: '/dashboard/ot/medicine' },
    ]},
    { label: 'Reports & Analytics', icon: MdBarChart, children: [
      { label: 'Surgery Reports', path: '/dashboard/ot/reports/surgery' },
      { label: 'OT Utilization Report', path: '/dashboard/ot/reports/utilization' },
    ]},
    { label: 'System', icon: MdNotifications, children: [
      { label: 'Notifications', path: '/dashboard/ot/notifications' },
      { label: 'Activity Logs', path: '/dashboard/ot/logs' },
    ]},
  ],
};

// ─── MenuItem ─────────────────────────────────────────────────────────────────
function MenuItem({ item, collapsed, setCollapsed, onNavClick, moduleCount = 0, forceActive = false }) {
  const navigate = useNavigate();
  const Icon = item.icon;

  const [open, setOpen] = useState(forceActive);

  const handleClick = () => {
    if (collapsed && setCollapsed) {
      setCollapsed(false);
      setOpen(true);
    }
    if (item.children.length === 1) {
      startNavigationLoading();
      navigate(item.children[0].path);
      onNavClick?.();
    } else {
      if (!collapsed) {
        setOpen(o => !o);
      } else {
        setOpen(true);
      }
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group hover:bg-[rgba(0,180,216,0.15)]"
        style={{
          background: forceActive ? '#0077B6' : 'transparent',
          color: '#FFFFFF',
        }}
      >
        <Icon
          className="w-5 h-5 shrink-0"
          style={{ color: forceActive ? '#FFFFFF' : '#90E0EF' }}
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {moduleCount > 0 ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                {moduleCount > 99 ? '99+' : moduleCount}
              </span>
            ) : null}
            {item.children.length > 1 && (
              open ? <MdExpandLess className="w-4 h-4 shrink-0" /> : <MdExpandMore className="w-4 h-4 shrink-0" />
            )}
          </>
        )}
      </button>

      {open && !collapsed && item.children.length > 1 && (
        <div
          className="ml-4 mt-0.5 mb-1 pl-3 space-y-0.5 border-l"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              end
              onClick={() => {
                startNavigationLoading();
                onNavClick?.();
              }}
              className="block px-3 py-1.5 rounded-lg text-xs font-medium truncate transition-all duration-150 hover:bg-[rgba(0,180,216,0.15)]"
              title={child.label}
              style={({ isActive }) => ({
                background: isActive ? '#0077B6' : 'transparent',
                color: '#FFFFFF',
              })}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared inner content ─────────────────────────────────────────────────────
function SidebarInner({ collapsed, setCollapsed, menuItems, onNavClick, onLogout, moduleCounts = {} }) {
  const location = useLocation();

  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sidebarDismissed') || '{}'); } catch { return {}; }
  });

  const saveDismissed = (next) => {
    setDismissed(next);
    try { sessionStorage.setItem('sidebarDismissed', JSON.stringify(next)); } catch {}
  };

  // Find the menu item whose child path matches the longest (most specific)
  const activeLabel = useMemo(() => {
    let best = null;
    let bestLen = 0;
    for (const group of menuItems) {
      for (const child of group.children) {
        if (location.pathname.startsWith(child.path) && child.path.length > bestLen) {
          best = group.label;
          bestLen = child.path.length;
        }
      }
    }
    return best;
  }, [menuItems, location.pathname]);

  // Auto-dismiss badge for the group matching the current path
  useEffect(() => {
    const matched = menuItems.find(g =>
      g.children.some(c => location.pathname.startsWith(c.path))
    );
    if (matched) {
      const next = { ...dismissed, [matched.label]: true };
      saveDismissed(next);
    }
  }, [location.pathname]);

  const getNetCount = (label) => {
    const raw = moduleCounts[label] || 0;
    if (dismissed[label]) return 0;
    return raw;
  };

  return (
    <>
      {/* Logo & Toggle */}
      <div
        className={`flex ${collapsed ? 'flex-col items-center px-2' : 'items-center px-4'} gap-3 py-4 border-b`}
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg bg-white">
          <img
            src="/mqe_logo.png"
            alt="VyanX"
            className="w-7 h-7 object-contain"
            draggable={false}
          />
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">VyanX</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.70)' }}>VyanX Hospital Management System</p>
          </div>
        )}

        {/* Desktop: collapse toggle */}
        {setCollapsed && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="transition shrink-0 p-1 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.80)', background: 'rgba(255,255,255,0.08)' }}
          >
            {collapsed ? <MdChevronRight className="w-5 h-5" /> : <MdChevronLeft className="w-5 h-5" />}
          </button>
        )}

        {/* Mobile: close button */}
        {onNavClick && (
          <button
            onClick={onNavClick}
            className="transition shrink-0 p-1 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.80)', background: 'rgba(255,255,255,0.08)' }}
          >
            <MdClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {menuItems.map((item) => (
          <MenuItem
            key={item.label}
            item={item}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            onNavClick={onNavClick}
            moduleCount={getNetCount(item.label)}
            forceActive={item.label === activeLabel}
          />
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition w-full"
          style={{ color: '#FFFFFF', background: 'rgba(229,57,53,0.10)' }}
        >
          <MdLogout className="w-5 h-5 shrink-0" style={{ color: '#E53935' }} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedRole = user?.role
    ? String(user.role).trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';

      if (normalizedRole === 'pharmacist') {
    return <PharmacySidebar collapsed={collapsed} setCollapsed={setCollapsed} />;
  }
  
  const menuItems = ROLE_MENUS[normalizedRole] || [];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moduleCounts, setModuleCounts] = useState({});

  // ✅ only update if values actually changed — prevents cascading re-renders on every 60s poll
  const setModuleCountsIfChanged = useCallback((next) => {
    setModuleCounts((prev) => {
      const k = Object.keys({ ...prev, ...next });
      return k.some((key) => prev[key] !== next[key]) ? next : prev;
    });
  }, []);

  useEffect(() => {
    let active = true;

    const loadCounts = async () => {
      try {
        if (normalizedRole === 'receptionist') {
          const [notifRes, moduleRes] = await Promise.all([
            api.get('/receptionist/notifications', { params: { unread: 1, limit: 100 }, silent: true }),
            api.get('/receptionist/notifications/module-counts', { silent: true }),
          ]);
          if (!active) return;
          const notifRows = Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [];
          const mc = moduleRes.data || {};
          setModuleCountsIfChanged({
            'OT Requests': mc.otPendingBill || 0,
            'Lab Billing': (mc.pendingLabPayments || 0) + (mc.advisedLabTests || 0),
            'Billing': mc.pendingBills || 0,
            'IPD': mc.activeIpd || 0,
            'Discharge': mc.pendingDischarge || 0,
            'Notifications': notifRows.length,
          });
        } else if (normalizedRole === 'lab_technician' || (normalizedRole === 'super_admin' && location.pathname.startsWith('/dashboard/lab'))) {
          const res = await api.get('/lab/notifications', { params: { unread: 1, limit: 100 }, silent: true });
          if (!active) return;
          const rows = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
          setModuleCountsIfChanged({ 'Notifications': rows.length });
        } else {
          setModuleCountsIfChanged({});
        }
      } catch {
        if (active) setModuleCountsIfChanged({});
      }
    };

    loadCounts();
  }, [normalizedRole, location.pathname, setModuleCountsIfChanged]);

  const handleLogout = () => setConfirmOpen(true);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* ══ MOBILE: Hamburger — header ke left side mein fixed ══ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-xl shadow-lg"
        style={{ background: '#001B48', color: '#fff' }}
        aria-label="Open menu"
      >
        <MdMenu className="w-6 h-6" />
      </button>

      {/* ══ MOBILE: Backdrop overlay ══ */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      {/* ══ MOBILE: Left se slide-in drawer ══ */}
      <aside
        className="md:hidden fixed top-0 left-0 z-50 h-full flex flex-col shadow-2xl transition-transform duration-300 ease-in-out"
        style={{
          width: '256px',
          background: '#001B48',
          borderRight: '1px solid rgba(255,255,255,0.14)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <SidebarInner
          collapsed={false}
          setCollapsed={null}
          menuItems={menuItems}
          onNavClick={closeMobile}
          onLogout={handleLogout}
          moduleCounts={moduleCounts}
        />
      </aside>

      {/* ══ DESKTOP: Normal sidebar (unchanged) ══ */}
      <aside
        className="hidden md:flex flex-col h-screen shadow-xl transition-all duration-300"
        style={{
          width: collapsed ? '70px' : '256px',
          minWidth: collapsed ? '70px' : '256px',
          background: '#001B48',
          borderRight: '1px solid rgba(255,255,255,0.14)',
        }}
      >
        <SidebarInner
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          menuItems={menuItems}
          onNavClick={null}
          onLogout={handleLogout}
          moduleCounts={moduleCounts}
        />
      </aside>

      <ConfirmModal
        open={confirmOpen}
        title="Logout"
        message="Do you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        confirmVariant="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          await logout();
          navigate('/login');
        }}
      />
    </>
  );
}