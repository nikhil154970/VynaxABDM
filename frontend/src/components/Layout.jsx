import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import GlobalLoader from './GlobalLoader';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isReception = location.pathname.startsWith('/dashboard/reception');
  const contentRef = useRef(null);

  // On every route change, start page from top.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <GlobalLoader scope="container" />
        {!isReception && <AdminHeader />}
        <div ref={contentRef} className="flex-1 overflow-y-auto relative">
          {children}
        </div>
      </main>
    </div>
  );
}
