import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const normalizeRoleKey = (role) => {
  if (!role) return role;
  return String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');
};

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  const userRole = normalizeRoleKey(user?.role);
  const allowed = allowedRoles.map(normalizeRoleKey);
  if (allowed.length > 0 && !allowed.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
