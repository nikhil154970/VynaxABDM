import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { MdAccessTime } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';

const NURSE_IPD_DETAILS_UUID = /^\/dashboard\/nurse\/ipd\/details\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;
const NURSE_IPD_DETAILS_SEARCH = /^\/dashboard\/nurse\/ipd\/details\/?$/;

function titleFromPath(pathname) {
  const p = String(pathname || '');
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
        className={`sticky top-0 z-30 border-b border-gray-200 px-4 md:px-6 ${isPharmacy ? 'py-4' : 'py-3'}`}
        style={{
          background: isPharmacy ? '#ffffff' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center justify-between gap-3 pl-10 md:pl-0">
          <div className="min-w-0 flex-1">
            <p
              className={`${isPharmacy ? 'text-sm font-extrabold' : 'text-xs font-extrabold tracking-wide'} hidden md:block`}
              style={{ color: isDoctor ? '#2D2A6E' : '#1d4ed8' }}
            >
              New H T Hospital HIMS
            </p>
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
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
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