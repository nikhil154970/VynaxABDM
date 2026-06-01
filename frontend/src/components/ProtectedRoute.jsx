import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const normalizeRoleKey = (role) => {
  if (!role) return role;
  return String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');
};

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  // Still initializing from localStorage — don't redirect yet
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>;

  // No user in state AND no token in storage → send to login
  const token = localStorage.getItem('accessToken');
  const storedUser = localStorage.getItem('user');
  const resolvedUser = user || (token && storedUser ? JSON.parse(storedUser) : null);

  if (!resolvedUser) return <Navigate to="/login" replace />;

  const userRole = normalizeRoleKey(resolvedUser?.role);
  const allowed = allowedRoles.map(normalizeRoleKey);
  if (allowed.length > 0 && !allowed.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
