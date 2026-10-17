import { Routes, Route, Navigate } from 'react-router-dom';
import ReceptionShell from './ReceptionShell';
import ReceptionDashboard from './ReceptionDashboard';
import TodaySummary from './TodaySummary';

import PatientList from './patients/PatientList';
import RegisterPatient from './patients/RegisterPatient';
import SearchPatient from './patients/SearchPatient';

import AppointmentList from './appointments/AppointmentList';
import BookAppointment from './appointments/BookAppointment';
import TokenQueue from './appointments/TokenQueue';

import TodayOPD from './opd/TodayOPD';
import ConsultationHistory from './opd/ConsultationHistory';

import ActiveIPDPatients from './ipd/ActiveIPDPatients';
import AdmitPatient from './ipd/AdmitPatient';
import TransferPatient from './ipd/TransferPatient';
import TransferHistory from './ipd/TransferHistory';
import RecoveryTransferRequests from './RecoveryTransferRequests';

import BedStatus from './beds/BedStatus';
import LiveBedTracker from './beds/AllocateBed';

import AllBills from './billing/AllBills';
import GenerateBilling from './billing/GenerateBilling';
import Payments from './billing/Payments';
import PaymentDue from './billing/PaymentDue';
import OtRequests from './OtRequests';
import ApprovedForOT from './ApprovedForOT';
import GenerateOTBill from './GenerateOTBill';

import PendingActions from './notifications/PendingActions';
import Alerts from './notifications/Alerts';
import PendingLabRequests from './lab/PendingLabRequests';
import LabPendingPayments from './lab/LabPendingPayments';
import LabReports from './lab/LabReports';
import CreateLabBill from './lab/CreateLabBill';
import AllLabBills from './lab/AllLabBills';

import TodayDischarge from './ipd/TodayDischarge';
import DischargeProcessDetail from './ipd/DischargeProcessDetail';
import DischargeSummaryEditor from './ipd/DischargeSummaryEditor';
import DischargeHistory from './ipd/DischargeHistory';

import Profile from './Profile';

const ComingSoon = ({ page }) => (
  <div className="p-8 flex items-center justify-center h-full">
    <div className="text-center">
      <p className="text-4xl mb-3">🚧</p>
      <h2 className="text-xl font-bold text-gray-700">{page}</h2>
      <p className="text-gray-400 text-sm mt-1">This module is coming soon</p>
    </div>
  </div>
);

export default function ReceptionRoutes() {
  return (
    <Routes>
      <Route element={<ReceptionShell />}>
        {/* Dashboard */}
        <Route index element={<ReceptionDashboard />} />
        <Route path="summary" element={<TodaySummary />} />

        {/* Patients */}
        <Route path="patients" element={<PatientList />} />
        <Route path="patients/register" element={<RegisterPatient />} />
        <Route path="patients/search" element={<SearchPatient />} />

        {/* Appointments */}
        <Route path="appointments" element={<AppointmentList />} />
        <Route path="appointments/book" element={<BookAppointment />} />
        <Route path="queue" element={<TokenQueue />} />

        {/* OPD */}
        <Route path="opd" element={<TodayOPD />} />
        <Route path="opd/history" element={<ConsultationHistory />} />

        {/* IPD */}
        <Route path="ipd" element={<ActiveIPDPatients />} />
        <Route path="ipd/admit" element={<AdmitPatient />} />
        <Route path="ipd/transfers" element={<TransferPatient />} />
        <Route path="ipd/recovery-transfers" element={<RecoveryTransferRequests />} />
        <Route path="ipd/transfers/history" element={<TransferHistory />} />
        <Route path="ipd/today-discharge" element={<TodayDischarge />} />
        <Route path="ipd/discharge/history" element={<DischargeHistory />} />
        <Route path="ipd/discharge/process/:id" element={<DischargeProcessDetail />} />
        <Route path="ipd/discharge/summary/:id" element={<DischargeSummaryEditor />} />
        {/* Legacy document/final-discharge steps removed — redirect to the single review page */}
        <Route path="ipd/discharge/documents/:id" element={<Navigate to="/dashboard/reception/ipd/today-discharge" replace />} />
        <Route path="ipd/discharge/final/:id" element={<Navigate to="/dashboard/reception/ipd/today-discharge" replace />} />


        {/* Bed Management */}
        <Route path="beds" element={<BedStatus />} />
        <Route path="beds/live-tracker" element={<LiveBedTracker />} />
        {/* Backward compatible */}
        <Route path="beds/allocate" element={<Navigate to="/dashboard/reception/beds/live-tracker" replace />} />

        {/* Billing */}
        <Route path="billing" element={<AllBills />} />
        <Route path="billing/generate" element={<GenerateBilling />} />
        <Route path="billing/payments" element={<Payments />} />
        <Route path="billing/dues" element={<PaymentDue />} />

        {/* OT Requests */}
        <Route path="ot-requests" element={<OtRequests />} />
        <Route path="ot-requests/generate-bill" element={<GenerateOTBill />} />
        <Route path="ot-requests/approved" element={<ApprovedForOT />} />

        {/* Notifications */}
        <Route path="notifications/pending" element={<PendingActions />} />
        <Route path="notifications/alerts" element={<Alerts />} />

        {/* OPD lab: single reception flow (doctor-advised tests → bill + lab order) */}
        <Route path="lab/approvals" element={<Navigate to="/dashboard/reception/lab/advised" replace />} />
        <Route path="lab/pending" element={<Navigate to="/dashboard/reception/lab/pending-payment" replace />} />
        <Route path="lab/pending-payment" element={<LabPendingPayments />} />
        <Route path="lab/advised" element={<PendingLabRequests />} />
        <Route path="lab/create-bill" element={<CreateLabBill />} />
        <Route path="lab/bills" element={<AllLabBills />} />
        <Route path="lab/reports" element={<LabReports />} />

        {/* Profile */}
        <Route path="profile" element={<Profile />} />

        {/* Fallback */}
        <Route path="*" element={<ComingSoon page="Reception Module" />} />
      </Route>
    </Routes>
  );
}
