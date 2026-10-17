import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MdAccessTime, MdNotifications } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import api from '../utils/api';

const NURSE_IPD_DETAILS_UUID = /^\/dashboard\/nurse\/ipd\/details\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;
const NURSE_IPD_DETAILS_SEARCH = /^\/dashboard\/nurse\/ipd\/details\/?$/;

function titleFromPath(pathname) {
  const p = String(pathname || '').trim();
  
  // Explicit HR titles mapping
  const hrMap = {
    '/dashboard/hr': 'HR Dashboard',
    '/dashboard/hr/employees/departments': 'Department Registry',
    '/dashboard/hr/staff-allocation/requests': 'Staff Allocation Requests',
    '/dashboard/hr/staff-allocation/patient': 'Patient Staff Allocation',
    '/dashboard/hr/staff-allocation/nurse': 'Nurse Allocation',
    '/dashboard/hr/shifts': 'Shift Management',
    '/dashboard/hr/shifts/availability': 'Staff Availability',
    '/dashboard/hr/duty-roster': 'Duty Roster',
    '/dashboard/hr/reports': 'Workforce Reports',
    '/dashboard/hr/notifications': 'System Notifications',
  };

  if (p === '/dashboard/hr/employees') return 'Employee Registry';
  if (p.startsWith('/dashboard/hr/employees/')) return 'Employee Profile';
  
  const hrHit = Object.keys(hrMap).find(key => p === key);
  if (hrHit) return hrMap[hrHit];

  if (NURSE_IPD_DETAILS_SEARCH.test(p)) return 'Update patient record';
  if (NURSE_IPD_DETAILS_UUID.test(p)) {
    try {
      const uhid = sessionStorage.getItem('hims_nurse_ipd_header_uhid');
      if (uhid) return uhid;
    } catch {
      /* ignore */
    }
    return 'Update patient record';
  }

  if (p === '/dashboard/doctor/appointments/today') return 'Today Appointments';
  if (p === '/dashboard/admin/abdm/consents') return 'ABDM Consent Management';

  const parts = p.split('/').filter(Boolean).slice(2); // drop "dashboard/{role}"

  if (parts.length === 0) return 'Dashboard';
  const last = parts[parts.length - 1];
  return String(last)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nurseDetailUhidTick, setNurseDetailUhidTick] = useState(0);
  const normalizedRole = user?.role ? String(user.role).trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  const isDoctor = normalizedRole === 'doctor' || location.pathname.startsWith('/dashboard/doctor');
  const isPharmacy = normalizedRole === 'pharmacist' || location.pathname.startsWith('/dashboard/pharmacy');
  const accent = isDoctor ? '#2D2A6E' : '#1d4ed8';
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotifRef = useRef('');

  const fetchHeaderNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=5');
      const list = res.data?.notifications || [];
      const key = JSON.stringify(list.map((n) => n.id));
      if (key === lastNotifRef.current) return; // nothing changed → skip re-render
      lastNotifRef.current = key;
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.read_at).length);
    } catch (err) {
      console.error('Header notifications fetch failed:', err);
    }
  };

  useEffect(() => {
    fetchHeaderNotifications();
  }, []);

  useEffect(() => {
    const onUhid = () => setNurseDetailUhidTick((t) => t + 1);
    window.addEventListener('hims-nurse-header-uhid', onUhid);
    return () => window.removeEventListener('hims-nurse-header-uhid', onUhid);
  }, []);

  const title = useMemo(
    () => titleFromPath(location.pathname),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick bumps title when PatientDetails sets UHID
    [location.pathname, nurseDetailUhidTick],
  );

  const pharmacyTitle =
    title === 'Dashboard'
      ? 'Pharmacy Dashboard'
      : title === 'Dispense'
        ? 'Dispensing'
        : title === 'Suppliers'
          ? 'Suppliers Management'
          : title === 'Medicines'
            ? 'Medicines Management'
            : title === 'Purchase'
              ? 'Purchase Orders'
              : title === 'Grn'
                ? 'Goods Receipt Note (GRN)'
                : title === 'Inventory'
                  ? 'Inventory Management'
                  : title === 'Billing'
                    ? 'Pharmacy Billing'
                    : title === 'Returns'
                      ? 'Returns'
                      : title === 'Reports'
                        ? 'Pharmacy Reports'
                        : title === 'Profile'
                          ? 'Pharmacy Profile'
                          : title;

  const nurseDetailSubtitle = useMemo(() => {
    if (!NURSE_IPD_DETAILS_UUID.test(location.pathname)) return null;
    return 'Update patient record';
  }, [location.pathname]);

  const role = String(user?.role || '').replace(/_/g, ' ');
  const roleLabel = isDoctor ? 'Doctor' : isPharmacy ? 'Pharmacy' : role || 'ADMIN';

  return (
    <>
      <div
        className={`sticky top-0 z-30 px-4 md:px-6 ${isPharmacy ? 'py-4' : 'py-3'}`}
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #D6E8EE',
        }}
      >
        <div className="flex items-center justify-between gap-3 pl-10 md:pl-0">
          <div className="min-w-0 flex-1">
            <h1
              className={`${
                isPharmacy ? 'text-2xl font-black leading-tight' : 'text-base md:text-lg font-extrabold'
              } text-gray-900 truncate`}
            >
              {isPharmacy ? pharmacyTitle : title}
            </h1>
            {nurseDetailSubtitle ? (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{nurseDetailSubtitle}</p>
            ) : null}
            {!isDoctor && (
              <p className="text-xs text-gray-500 mt-0.5 truncate items-center gap-1 hidden md:flex">
                <MdAccessTime className="w-3.5 h-3.5" /> {today}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {!isDoctor && (
              <div
                className={`hidden sm:flex items-center gap-2 px-3 md:px-4 py-2 ${
                  isPharmacy ? 'h-11 rounded-lg font-bold' : 'rounded-xl font-medium'
                } text-xs md:text-sm shadow-sm`}
                style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                title="System status"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                <span className="hidden md:inline">System Online</span>
              </div>
            )}

            <div className="flex items-center gap-2 md:gap-3">
              {/* Notification Bell Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="p-1.5 text-gray-500 hover:text-gray-700 transition relative rounded-xl"
                  style={{ color: '#00B4D8' }}
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  title="Notifications"
                >
                  <MdNotifications className="w-5.5 h-5.5 md:w-6 md:h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden font-sans">
                      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#001B48]">Recent Notifications</span>
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            let rolePath = isDoctor ? 'doctor' : isPharmacy ? 'pharmacy' : normalizedRole;
                            if (rolePath === 'hr_manager') rolePath = 'hr';
                            if (rolePath === 'super_admin') {
                              navigate('/dashboard/admin/alerts/system');
                            } else {
                              navigate(`/dashboard/${rolePath}/notifications`);
                            }
                          }}
                          className="text-[10px] font-bold text-[#0077B6] hover:underline"
                        >
                          View All
                        </button>
                      </div>

                      <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-400 font-semibold">
                            No notifications
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={async () => {
                                if (!n.read_at) {
                                  try {
                                    await api.patch(`/notifications/${n.id}/read`);
                                    setNotifications((prev) =>
                                      prev.map((x) =>
                                        x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
                                      )
                                    );
                                    setUnreadCount((c) => Math.max(0, c - 1));
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }
                              }}
                              className={`p-3 text-left transition hover:bg-gray-50 cursor-pointer ${
                                !n.read_at ? 'bg-blue-50/10' : ''
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <p className={`text-xs ${!n.read_at ? 'font-bold text-[#001B48]' : 'font-semibold text-gray-700'} truncate flex-1`}>
                                  {n.title}
                                </p>
                                {!n.read_at && (
                                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 font-semibold line-clamp-2 mt-0.5 leading-relaxed">
                                {n.message}
                              </p>
                              <span className="text-[9px] text-gray-400 font-bold block mt-1">
                                {n.created_at
                                  ? new Date(n.created_at).toLocaleString('en-IN', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="text-right leading-tight">
                {isPharmacy ? (
                  <p className="inline-flex max-w-[120px] items-center justify-end truncate text-xs font-black text-gray-900 md:max-w-none md:text-sm">
                    {user?.name || 'Pharmacy'}
                  </p>
                ) : (
                  <p className="text-xs md:text-sm font-extrabold text-gray-900 truncate max-w-[100px] md:max-w-none">
                    {user?.name || (isDoctor ? 'Doctor' : 'Admin')}
                  </p>
                )}
                <p
                  className="text-[10px] md:text-[11px] font-extrabold tracking-wide uppercase"
                  style={{ color: accent }}
                >
                  {roleLabel}
                </p>
                {isDoctor && (
                  <p className="text-[10px] text-gray-500 mt-0.5 hidden md:flex items-center justify-end gap-1">
                    <MdAccessTime className="w-3.5 h-3.5" /> {today}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="text-xs md:text-sm text-gray-600 hover:text-red-600 border px-2 md:px-3 py-1.5 md:py-2 rounded-xl transition bg-white whitespace-nowrap shadow-sm"
                style={{ borderColor: '#e0e7ff' }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

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
