// Each role lands on their own dashboard after login
const ROLE_DASHBOARD = {
  super_admin: '/dashboard/admin',
  receptionist: '/dashboard/reception',
  doctor: '/dashboard/doctor',
  nurse: '/dashboard/nurse',
  lab_technician: '/dashboard/lab',
  pharmacist: '/dashboard/pharmacy',
  hr_manager: '/dashboard/hr',
};

const normalizeRoleKey = (role) => {
  if (!role) return role;
  return String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');
};

export const getDashboardPath = (role) => ROLE_DASHBOARD[normalizeRoleKey(role)] || '/dashboard';
