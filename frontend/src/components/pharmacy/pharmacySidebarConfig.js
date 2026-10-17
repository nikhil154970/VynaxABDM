import {
  LayoutDashboard,
  IndianRupee,
  Pill,
  Package,
  Tablets,
  ShoppingCart,
  ClipboardCheck,
  Truck,
  RotateCcw,
  BarChart3,
  User,
} from 'lucide-react';

/** Pharmacy navigation — supports single-level submenu (children). */
export const PHARMACY_SIDEBAR_MENU = [
  { label: 'Dashboard', path: '/dashboard/pharmacy', icon: LayoutDashboard },
  {
    label: 'Billing',
    icon: IndianRupee,
    children: [
      { label: 'New Billing', path: '/dashboard/pharmacy/billing' },
      { label: 'Prescription Queue', path: '/dashboard/pharmacy/billing/queue' },
      { label: 'Pending Dues', path: '/dashboard/pharmacy/billing/pending-dues' },
      { label: 'Billing History', path: '/dashboard/pharmacy/billing/history' },
    ],
  },
  // { label: 'Dispensing', path: '/dashboard/pharmacy/dispense', icon: Pill },
  { label: 'Inventory', path: '/dashboard/pharmacy/inventory', icon: Package },
  { label: 'Medicines', path: '/dashboard/pharmacy/medicines', icon: Tablets },
  { label: 'Purchase', path: '/dashboard/pharmacy/purchase', icon: ShoppingCart },
  { label: 'GRN', path: '/dashboard/pharmacy/grn', icon: ClipboardCheck },
  { label: 'Suppliers', path: '/dashboard/pharmacy/suppliers', icon: Truck },
  { label: 'Returns', path: '/dashboard/pharmacy/returns', icon: RotateCcw },
  { label: 'OT Issue', path: '/dashboard/pharmacy/ot-issue', icon: Pill },
  { label: 'Reports', path: '/dashboard/pharmacy/reports', icon: BarChart3 },
  { label: 'Profile', path: '/dashboard/pharmacy/profile', icon: User },
];

/** Shape expected by PharmacySidebar MenuItem. */
export function getPharmacyMenuItems() {
  return PHARMACY_SIDEBAR_MENU.map((item) => {
    const children =
      Array.isArray(item.children) && item.children.length
        ? item.children
        : [{ label: item.label, path: item.path }];

    return {
      label: item.label,
      icon: item.icon,
      children,
    };
  });
}

export function isPharmacyPathActive(pathname, path) {
  if (path === '/dashboard/pharmacy') {
    return pathname === '/dashboard/pharmacy';
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
