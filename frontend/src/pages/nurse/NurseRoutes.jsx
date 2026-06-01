import { Routes, Route } from 'react-router-dom';
import NurseShell from './NurseShell';

import NurseOverview from './NurseOverview';
import NurseSummary from './NurseSummary';

import AssignedPatients from './ipd/AssignedPatients';
import PatientDetails from './ipd/PatientDetails';
import NurseDischargeApproval from './ipd/NurseDischargeApproval';

import AddNotes from './notes/AddNotes';
import ViewNotes from './notes/ViewNotes';

import Notifications from './notifications/Notifications';
import NurseProfile from './Profile';

const ComingSoon = ({ page }) => (
  <div className="p-8 flex items-center justify-center h-full">
    <div className="text-center">
      <p className="text-4xl mb-3">🚧</p>
      <h2 className="text-xl font-bold text-gray-700">{page}</h2>
      <p className="text-gray-400 text-sm mt-1">This module is coming soon</p>
    </div>
  </div>
);

export default function NurseRoutes() {
  return (
    <Routes>
      <Route element={<NurseShell />}>
        {/* Dashboard */}
        <Route index element={<NurseOverview />} />
        <Route path="summary" element={<NurseSummary />} />

        {/* IPD */}
        <Route path="ipd" element={<AssignedPatients />} />
        <Route path="ipd/discharge-approval" element={<NurseDischargeApproval />} />
        <Route path="ipd/details" element={<PatientDetails />} />
        <Route path="ipd/details/:id" element={<PatientDetails />} />

        {/* Notes */}
        <Route path="notes/add" element={<AddNotes />} />
        <Route path="notes" element={<ViewNotes />} />

        {/* Notifications */}
        <Route path="notifications" element={<Notifications />} />

        {/* Profile */}
        <Route path="profile" element={<NurseProfile />} />

        {/* Fallback */}
        <Route path="*" element={<ComingSoon page="Nurse Module" />} />
      </Route>
    </Routes>
  );
}

