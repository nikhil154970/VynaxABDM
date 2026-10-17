import { Navigate } from 'react-router-dom';
import { usePatientAuth } from '../../context/PatientAuthContext';

export default function PatientProtectedRoute({ children }) {
  const { patient, loading } = usePatientAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!patient) return <Navigate to="/patient/login" replace />;
  return children;
}
