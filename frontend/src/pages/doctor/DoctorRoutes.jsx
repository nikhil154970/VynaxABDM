import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Dashboard from './Dashboard';
import TodayAppointments from './TodayAppointments';
import AppointmentList from './AppointmentList';
import AssignedPatients from './opd/AssignedPatients';
import OPDConsultation from './opd/Consultation';
import MyPatients from './ipd/MyPatients';
import PatientDetail from './ipd/PatientDetail';
import PatientDetailHome from './ipd/PatientDetailHome';
import LabRequests from './LabRequests';
import SearchPatient from './history/SearchPatient';
import FullHistory from './history/FullHistory';
import Notifications from './Notifications';
import Profile from './Profile';
import OTSchedule from './OTSchedule';
import AllOTRecovery from './AllOTRecovery';

function LogoutRoute() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      await logout();
      navigate('/login', { replace: true });
    })();
  }, [logout, navigate]);
  return null;
}

export default function DoctorRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="summary" element={<Dashboard />} />

      <Route path="appointments">
        <Route index element={<AppointmentList />} />
        <Route path="today" element={<TodayAppointments />} />
      </Route>

      <Route path="opd">
        <Route index element={<AssignedPatients />} />
        <Route path="consultation" element={<OPDConsultation />} />
      </Route>

      <Route path="ipd">
        <Route index element={<MyPatients />} />
        <Route path="detail" element={<PatientDetailHome />} />
        <Route path="detail/:id" element={<PatientDetail />} />
      </Route>

      <Route path="lab">
        <Route path="request" element={<LabRequests />} />
        <Route path="reports" element={<LabRequests />} />
      </Route>

      <Route path="history">
        <Route index element={<FullHistory />} />
        <Route path="search" element={<SearchPatient />} />
      </Route>

      <Route path="notifications">
        <Route index element={<Navigate to="alerts" replace />} />
        <Route path="alerts" element={<Notifications tab="alerts" />} />
        <Route path="updates" element={<Notifications tab="updates" />} />
      </Route>

      <Route path="ot">
        <Route path="schedule" element={<OTSchedule />} />
        <Route path="recovery" element={<AllOTRecovery />} />
      </Route>

      <Route path="profile" element={<Profile />} />
      <Route path="logout" element={<LogoutRoute />} />

      <Route path="*" element={<Navigate to="/dashboard/doctor" replace />} />
    </Routes>
  );
}

