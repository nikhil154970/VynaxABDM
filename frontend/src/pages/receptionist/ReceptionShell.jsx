import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MdAccessTime } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';

const TITLES = [
  { match: '/dashboard/reception/patients/register', title: 'Register Patient', sub: 'Create new patient UHID & token' },
  { match: '/dashboard/reception/patients/search', title: 'Search Patient', sub: 'Full 360° patient view' },
  { match: '/dashboard/reception/patients', title: 'Patients', sub: 'View and manage patients' },
  { match: '/dashboard/reception/appointments/book', title: 'Book Appointment', sub: 'Schedule OPD visits' },
  { match: '/dashboard/reception/appointments', title: 'Appointments', sub: 'Manage bookings and slots' },
  { match: '/dashboard/reception/queue', title: 'Token / Queue', sub: 'OPD queue tracking' },
  { match: '/dashboard/reception/opd', title: 'OPD', sub: "Today's OPD overview" },
  { match: '/dashboard/reception/ipd/admit', title: 'Admit Patient', sub: 'New IPD admission' },
  { match: '/dashboard/reception/ipd/recovery-transfers', title: 'Recovery Transfers', sub: 'Assign ward & bed for recovery patients' },
  { match: '/dashboard/reception/ipd/transfers/history', title: 'Transfer History', sub: 'All bed transfer records' },
  { match: '/dashboard/reception/ipd/transfers', title: 'IPD Transfers', sub: 'Bed transfers & movement' },
  { match: '/dashboard/reception/ipd/today-discharge', title: 'Discharge Requests', sub: 'Nurse-approved queue — billing & bed release' },
  { match: '/dashboard/reception/ipd/discharge/history', title: 'Discharge History', sub: 'Past IPD discharges' },
  { match: '/dashboard/reception/ipd/discharge/process', title: 'Discharge review', sub: 'Payment tracking & lab reports' },
  { match: '/dashboard/reception/ipd/discharge/summary', title: 'Discharge summary form', sub: 'Fill & finalize discharge' },
  { match: '/dashboard/reception/ipd', title: 'Active IPD Patients', sub: 'Currently admitted patients' },
  { match: '/dashboard/reception/lab/pending-payment', title: 'Pending lab payment', sub: 'Lab bills with balance due — collect payment here' },
  { match: '/dashboard/reception/lab/advised', title: 'Advised Lab Tests', sub: 'Doctor-selected / Nurse-requested tests not yet billed' },
  { match: '/dashboard/reception/lab/pending', title: 'Pending lab payment', sub: 'Lab bills with balance due' },
  { match: '/dashboard/reception/lab/reports', title: 'Lab reports', sub: 'Completed tests — print from browser' },
  { match: '/dashboard/reception/billing/generate', title: 'Generate Billing', sub: 'OPD & IPD' },
  { match: '/dashboard/reception/billing/dues', title: 'Payment Due', sub: 'Track and manage pending payments' },
  { match: '/dashboard/reception/ot-requests/approved', title: 'Approved For OT', sub: 'Patients approved for surgery' },
  { match: '/dashboard/reception/ot-requests/generate-bill', title: 'Generate OT Bill', sub: 'Create bill and approve patient for OT' },
  { match: '/dashboard/reception/ot-requests', title: 'OT Requests', sub: 'Manage incoming OT requests' },
  { match: '/dashboard/reception/billing', title: 'Billing', sub: 'Bills, payments and dues' },
  { match: '/dashboard/reception', title: 'Reception', sub: 'Receptionist Workspace' },
];

function getHeaderMeta(pathname) {
  // Ensure more specific paths match first.
  const hit = [...TITLES].sort((a, b) => b.match.length - a.match.length).find((t) => pathname.startsWith(t.match));
  return hit || { title: 'Reception', sub: 'Receptionist Workspace' };
}

export default function ReceptionShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const meta = getHeaderMeta(location.pathname);
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-full w-full">
      <div
        className="sticky top-0 z-40 px-6 py-3"
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #D6E8EE',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{meta.title}</h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
              <MdAccessTime className="w-3.5 h-3.5" /> {today} · {meta.sub}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
              title="System status"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              System Online
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-sm font-bold text-gray-900">{user?.name || 'Receptionist'}</p>
                <p className="text-[11px] text-blue-700 font-extrabold tracking-wide uppercase">
                  {String(user?.role || 'receptionist').replace(/_/g, ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="text-sm text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-2 rounded-xl transition bg-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <Outlet />

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
    </div>
  );
}

