import { useEffect, useState } from 'react';
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
  MdMenu, MdClose, MdExitToApp
} from 'react-icons/md';

const ROLE_MENUS = {
  super_admin: [
    { label: 'Dashboard', icon: MdDashboard, children: [
      { label: 'Overview', path: '/dashboard/admin' },
      { label: 'Daily Summary', path: '/dashboard/admin/daily-summary' },
      { label: 'Revenue Snapshot', path: '/dashboard/admin/revenue-snapshot' },
      { label: 'Bed Occupancy', path: '/dashboard/admin/bed-occupancy' },
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
      { label: 'Transfers History', path: '/dashboard/admin/ipd/transfers' },
      { label: 'Discharge Overview', path: '/dashboard/admin/ipd/discharge' },
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
      { label: 'Generate Bill', path: '/dashboard/admin/finance/bills/generate' },
      { label: 'Payments', path: '/dashboard/admin/finance/payments' },
      { label: 'Pending Dues', path: '/dashboard/admin/finance/dues' },
      { label: 'Revenue Analytics', path: '/dashboard/admin/finance/analytics' },
    ]},
    { label: 'Reports & Analytics', icon: MdBarChart, children: [
      { label: 'Revenue Reports', path: '/dashboard/admin/reports/revenue' },
      { label: 'Patient Reports', path: '/dashboard/admin/reports/patients' },
      { label: 'Doctor Reports', path: '/dashboard/admin/reports/doctors' },
      { label: 'Bed Utilization', path: '/dashboard/admin/reports/beds' },
      { label: 'Daily Reports', path: '/dashboard/admin/reports/daily' },
      { label: 'Monthly Reports', path: '/dashboard/admin/reports/monthly' },
    ]},
    { label: 'Alerts', icon: MdWarning, children: [
      { label: 'Pending Actions', path: '/dashboard/admin/alerts/pending' },
      { label: 'Critical Alerts', path: '/dashboard/admin/alerts/critical' },
      { label: 'System Notifications', path: '/dashboard/admin/alerts/system' },
    ]},
    { label: 'System Settings', icon: MdSettings, children: [
      { label: 'Hospital Information', path: '/dashboard/admin/settings/hospital' },
      { label: 'Security Settings', path: '/dashboard/admin/settings/security' },
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
      { label: 'Search Patient', path: '/dashboard/reception/patients/search' },
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
      { label: 'Admit Patient', path: '/dashboard/reception/ipd/admit' },
      { label: 'Active Admissions', path: '/dashboard/reception/ipd' },
      { label: 'Transfers', path: '/dashboard/reception/ipd/transfers' },
      { label: 'Transfer History', path: '/dashboard/reception/ipd/transfers/history' },
    ]},
    { label: 'Discharge', icon: MdExitToApp, children: [
      { label: "Today's Discharge", path: '/dashboard/reception/ipd/today-discharge' },
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
      { label: 'Advised OPD tests', path: '/dashboard/reception/lab/advised' },
      { label: 'Lab reports', path: '/dashboard/reception/lab/reports' },
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
      { label: 'Overview', path: '/dashboard/doctor' },
      { label: 'Today Summary', path: '/dashboard/doctor/summary' },
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
    { label: 'Staff', icon: MdGroups, children: [
      { label: 'All Staff', path: '/dashboard/hr/staff' },
      { label: 'Add Staff', path: '/dashboard/hr/staff/add' },
    ]},
    { label: 'Attendance', icon: MdCalendarToday, children: [
      { label: 'Today Attendance', path: '/dashboard/hr/attendance' },
      { label: 'Attendance Report', path: '/dashboard/hr/attendance/report' },
    ]},
    { label: 'Payroll', icon: MdAttachMoney, children: [
      { label: 'Process Payroll', path: '/dashboard/hr/payroll' },
      { label: 'Payroll History', path: '/dashboard/hr/payroll/history' },
    ]},
    { label: 'Profile', icon: MdPerson, children: [
      { label: 'My Profile', path: '/dashboard/hr/profile' },
    ]},
  ],
};

// ─── MenuItem ─────────────────────────────────────────────────────────────────
function MenuItem({ item, collapsed, variant = 'default', onNavClick, notificationCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const Icon = item.icon;

  const isActive = item.children.some(c => location.pathname.startsWith(c.path));
  const [open, setOpen] = useState(isActive);
  const isDoctor = variant === 'doctor';

  const handleClick = () => {
    if (item.children.length === 1) {
      startNavigationLoading();
      navigate(item.children[0].path);
      onNavClick?.();
    } else {
      setOpen(o => !o);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
          isDoctor ? 'hover:bg-white/10' : ''
        }`}
        style={{
          background: isDoctor
            ? (isActive ? 'rgba(0, 174, 239, 0.22)' : 'transparent')
            : undefined,
          color: isDoctor ? '#FFFFFF' : undefined,
        }}
      >
        <Icon
          className={`w-5 h-5 shrink-0 ${isDoctor ? '' : (isActive ? 'text-white' : 'text-blue-300 group-hover:text-white')}`}
          style={isDoctor ? { color: isActive ? '#00AEEF' : 'rgba(255,255,255,0.80)' } : undefined}
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {item.label === 'Notifications' && notificationCount > 0 ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none"
                style={{ background: '#ef4444', color: '#fff' }}
                title={`${notificationCount} unread`}
              >
                +{notificationCount}
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
          style={{ borderColor: isDoctor ? 'rgba(255,255,255,0.18)' : undefined }}
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
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isDoctor
                    ? 'hover:bg-white/10'
                    : (isActive
                      ? 'bg-blue-500/20 text-white font-semibold ring-1 ring-white/15'
                      : 'text-blue-200 hover:bg-blue-700/25 hover:text-white')
                }`
              }
              style={({ isActive }) =>
                isDoctor
                  ? ({
                      background: isActive ? '#00AEEF' : 'transparent',
                      color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.82)',
                    })
                  : undefined
              }
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
function SidebarInner({ collapsed, setCollapsed, menuItems, onNavClick, onLogout, notificationCount }) {
  return (
    <>
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.14)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg bg-white">
          <img
            src="/hopital_logo.png"
            alt="New H T Hospital"
            className="w-7 h-7 object-contain"
            draggable={false}
          />
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">New H T Hospital</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.70)' }}>HIMS</p>
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
            variant="doctor"
            onNavClick={onNavClick}
            notificationCount={notificationCount}
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
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadReceptionUnread = async () => {
      try {
        const res = await api.get('/receptionist/notifications', { params: { unread: 1, limit: 100 } });
        const rows = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
        if (active) setNotificationCount(rows.length);
      } catch {
        if (active) setNotificationCount(0);
      }
    };

    const loadLabUnread = async () => {
      try {
        const res = await api.get('/lab/notifications', { params: { unread: 1, limit: 100 } });
        const rows = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
        if (active) setNotificationCount(rows.length);
      } catch {
        if (active) setNotificationCount(0);
      }
    };

    if (normalizedRole === 'receptionist') {
      loadReceptionUnread();
      return () => {
        active = false;
      };
    }

    const showLabBadge =
      normalizedRole === 'lab_technician' ||
      (normalizedRole === 'super_admin' && location.pathname.startsWith('/dashboard/lab'));

    if (showLabBadge) {
      loadLabUnread();
      return () => {
        active = false;
      };
    }

    setNotificationCount(0);
    return () => {
      active = false;
    };
  }, [normalizedRole, location.pathname]);

  const handleLogout = () => setConfirmOpen(true);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* ══ MOBILE: Hamburger — header ke left side mein fixed ══ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-xl shadow-lg"
        style={{ background: '#2D2A6E', color: '#fff' }}
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
          background: '#2D2A6E',
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
          notificationCount={notificationCount}
        />
      </aside>

      {/* ══ DESKTOP: Normal sidebar (unchanged) ══ */}
      <aside
        className="hidden md:flex flex-col h-screen shadow-xl transition-all duration-300"
        style={{
          width: collapsed ? '70px' : '256px',
          minWidth: collapsed ? '70px' : '256px',
          background: '#2D2A6E',
          borderRight: '1px solid rgba(255,255,255,0.14)',
        }}
      >
        <SidebarInner
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          menuItems={menuItems}
          onNavClick={null}
          onLogout={handleLogout}
          notificationCount={notificationCount}
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