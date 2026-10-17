import { Routes, Route } from 'react-router-dom';
import OtDashboard from './OtDashboard';
import OtRoomBoard from './OtRoomBoard';
import OtRequests from './OtRequests';
import SurgeryScheduling from './SurgeryScheduling';
import TodaySurgeries from './TodaySurgeries';
import UpcomingSurgeries from './UpcomingSurgeries';
import InProgressSurgeries from './InProgressSurgeries';
import CompletedSurgeries from './CompletedSurgeries';
import DelayedSurgeries from './DelayedSurgeries';
import EquipmentAllocation from './EquipmentAllocation';
import RecoveryRoom from './RecoveryRoom';
import PostSurgeryNotes from './PostSurgeryNotes';
import OtNotifications from './OtNotifications';
import OtMedicine from './OtMedicine';

export default function OtRoutes() {
  return (
    <Routes>
      <Route index element={<OtDashboard />} />
      <Route path="rooms" element={<OtRoomBoard />} />
      <Route path="requests" element={<OtRequests />} />
      <Route path="today" element={<TodaySurgeries />} />
      <Route path="upcoming" element={<UpcomingSurgeries />} />
      <Route path="surgery/schedule" element={<SurgeryScheduling />} />
      <Route path="surgery/in-progress" element={<InProgressSurgeries />} />
      <Route path="surgery/completed" element={<CompletedSurgeries />} />
      <Route path="delayed" element={<DelayedSurgeries />} />
      <Route path="equipment" element={<EquipmentAllocation />} />
      <Route path="recovery" element={<RecoveryRoom />} />
      <Route path="post-surgery" element={<PostSurgeryNotes />} />
      <Route path="medicine" element={<OtMedicine />} />
      <Route path="notifications" element={<OtNotifications />} />
    </Routes>
  );
}
