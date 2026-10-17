import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../ConfirmModal';
import { startNavigationLoading } from '../../utils/loadingBus';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { getPharmacyMenuItems } from './pharmacySidebarConfig';

const menuItems = getPharmacyMenuItems();

function PharmacyMenuItem({ item, collapsed, onNavClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const Icon = item.icon;
  const child = item.children[0];
  const isDashboard = child.path === '/dashboard/pharmacy';
  const isActive = item.children.some((c) => {
    if (c.path === '/dashboard/pharmacy') {
      return location.pathname === '/dashboard/pharmacy';
    }
    return location.pathname === c.path || location.pathname.startsWith(`${c.path}/`);
  });
  const [open, setOpen] = useState(isActive);

  const handleClick = () => {
    if (item.children.length === 1 || collapsed) {
      startNavigationLoading();
      navigate(child.path);
      onNavClick?.();
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group hover:bg-[rgba(0,180,216,0.15)]"
        style={{
          background: isActive ? '#0077B6' : 'transparent',
          color: '#FFFFFF',
        }}
      >
        <Icon
          className="w-5 h-5 shrink-0"
          style={{ color: isActive ? '#FFFFFF' : '#90E0EF' }}
          strokeWidth={2}
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {item.children.length > 1 ? (
              open ? (
                <ChevronUp className="w-4 h-4 shrink-0" strokeWidth={2} />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" strokeWidth={2} />
              )
            ) : null}
          </>
        )}
      </button>

      {open && !collapsed && item.children.length > 1 && (
        <div
          className="ml-4 mt-0.5 mb-1 pl-3 space-y-0.5 border-l"
          style={{ borderColor: 'rgba(255,255,255,0.18)' }}
        >
          {item.children.map((c) => (
            <NavLink
              key={c.path}
              to={c.path}
              end
              onClick={() => {
                startNavigationLoading();
                onNavClick?.();
              }}
              className="block px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 hover:bg-[rgba(0,180,216,0.15)]"
              style={({ isActive: childActive }) => ({
                background: childActive ? '#0077B6' : 'transparent',
                color: '#FFFFFF',
              })}
            >
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function PharmacySidebarInner({ collapsed, setCollapsed, onNavClick, onLogout }) {
  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-4 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.14)' }}
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
            <p className="text-sm font-bold text-white truncate">VyanX Hospital Management System</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.70)' }}>HIMS</p>
          </div>
        )}

        {setCollapsed && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="transition shrink-0 p-1 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.80)', background: 'rgba(255,255,255,0.08)' }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" strokeWidth={2} />
            ) : (
              <ChevronLeft className="w-5 h-5" strokeWidth={2} />
            )}
          </button>
        )}

        {onNavClick && (
          <button
            type="button"
            onClick={onNavClick}
            className="transition shrink-0 p-1 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.80)', background: 'rgba(255,255,255,0.08)' }}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {menuItems.map((item) => (
          <PharmacyMenuItem
            key={item.label}
            item={item}
            collapsed={collapsed}
            onNavClick={onNavClick}
          />
        ))}
      </nav>

      <div className="px-2 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition w-full"
          style={{ color: '#FFFFFF', background: 'rgba(229,57,53,0.10)' }}
        >
          <LogOut className="w-5 h-5 shrink-0" style={{ color: '#E53935' }} strokeWidth={2} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}

const asideStyle = {
  background: '#001B48',
  borderRight: '1px solid rgba(255,255,255,0.14)',
};

/**
 * Pharmacy role sidebar — same layout/theme as main HMS Sidebar.
 * Menu config: ./pharmacySidebarConfig.js
 */
export default function PharmacySidebar({ collapsed, setCollapsed }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => setConfirmOpen(true);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-xl shadow-lg"
        style={{ background: '#001B48', color: '#fff' }}
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" strokeWidth={2} />
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <aside
        className="md:hidden fixed top-0 left-0 z-50 h-full flex flex-col shadow-2xl transition-transform duration-300 ease-in-out"
        style={{
          width: '256px',
          ...asideStyle,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <PharmacySidebarInner
          collapsed={false}
          setCollapsed={null}
          onNavClick={closeMobile}
          onLogout={handleLogout}
        />
      </aside>

      <aside
        className="hidden md:flex flex-col h-screen shadow-xl transition-all duration-300 sticky top-0"
        style={{
          width: collapsed ? '70px' : '256px',
          minWidth: collapsed ? '70px' : '256px',
          ...asideStyle,
        }}
      >
        <PharmacySidebarInner
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onNavClick={null}
          onLogout={handleLogout}
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
