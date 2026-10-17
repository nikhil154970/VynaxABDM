import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AUTH_EVENTS } from '../utils/authSession';

/** Handles session expiry without full browser reload. */
export default function SessionGuard() {
  const navigate = useNavigate();
  const { logout, setUser } = useAuth();

  useEffect(() => {
    const onStaffExpired = async () => {
      await logout();
      setUser(null);
      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    };

    const onPatientExpired = () => {
      const path = window.location.pathname;
      if (!path.startsWith('/patient/login') && !path.startsWith('/patient/register')) {
        navigate('/patient/login', { replace: true });
      }
    };

    window.addEventListener(AUTH_EVENTS.STAFF_EXPIRED, onStaffExpired);
    window.addEventListener(AUTH_EVENTS.PATIENT_EXPIRED, onPatientExpired);
    return () => {
      window.removeEventListener(AUTH_EVENTS.STAFF_EXPIRED, onStaffExpired);
      window.removeEventListener(AUTH_EVENTS.PATIENT_EXPIRED, onPatientExpired);
    };
  }, [navigate, logout, setUser]);

  return null;
}
