import { Outlet } from 'react-router-dom';

export default function NurseShell() {
  // Header is handled by the default dashboard header (Layout/AdminHeader).
  return <Outlet />;
}

