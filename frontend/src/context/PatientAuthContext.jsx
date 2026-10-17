import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/patientApi';
import { getValidPatientSession, resetPatientSessionFlags, AUTH_EVENTS } from '../utils/authSession';

const PatientAuthContext = createContext(null);

export const PatientAuthProvider = ({ children }) => {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getValidPatientSession();
    if (session) setPatient(session.patient);
    setLoading(false);
  }, []);

  useEffect(() => {
    const onExpired = () => setPatient(null);
    window.addEventListener(AUTH_EVENTS.PATIENT_EXPIRED, onExpired);
    return () => window.removeEventListener(AUTH_EVENTS.PATIENT_EXPIRED, onExpired);
  }, []);

  const login = async (uhid, password) => {
    const res = await api.post('/patient/auth/login', { uhid, password });
    const { accessToken, patient: p } = res.data;
    resetPatientSessionFlags();
    localStorage.setItem('patientToken', accessToken);
    localStorage.setItem('patient', JSON.stringify(p));
    setPatient(p);
    return p;
  };

  const register = async (data) => {
    const res = await api.post('/patient/auth/register', data);
    const { accessToken, patient: p } = res.data;
    resetPatientSessionFlags();
    localStorage.setItem('patientToken', accessToken);
    localStorage.setItem('patient', JSON.stringify(p));
    setPatient(p);
    return p;
  };

  const logout = () => {
    localStorage.removeItem('patientToken');
    localStorage.removeItem('patient');
    setPatient(null);
  };

  return (
    <PatientAuthContext.Provider value={{ patient, login, register, logout, loading }}>
      {children}
    </PatientAuthContext.Provider>
  );
};

export const usePatientAuth = () => useContext(PatientAuthContext);
