import { useMemo, useRef, useState } from 'react';
import Toast from '../../../components/Toast';
import ReportFilters from '../../../components/pharmacy/reports/ReportFilters';
import OverviewTab from '../../../components/pharmacy/reports/OverviewTab';
import SalesReportTab from '../../../components/pharmacy/reports/SalesReportTab';
import PurchaseReportTab from '../../../components/pharmacy/reports/PurchaseReportTab';
import InventoryReportTab from '../../../components/pharmacy/reports/InventoryReportTab';
import LowStockReportTab from '../../../components/pharmacy/reports/LowStockReportTab';
import ExpiryReportTab from '../../../components/pharmacy/reports/ExpiryReportTab';
import SupplierReportTab from '../../../components/pharmacy/reports/SupplierReportTab';
import ReturnReportTab from '../../../components/pharmacy/reports/ReturnReportTab';
import DueCollectionReportTab from '../../../components/pharmacy/reports/DueCollectionReportTab';
import { exportTableCsv, exportTableExcel, printReportHtml } from '../../../utils/exportReports';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales Report' },
  { id: 'purchase', label: 'Purchase Report' },
  { id: 'inventory', label: 'Inventory Report' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'expiry', label: 'Expiry Report' },
  { id: 'suppliers', label: 'Supplier Report' },
  { id: 'returns', label: 'Return Report' },
  { id: 'dues', label: 'Due Collection' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [datePreset, setDatePreset] = useState('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const overviewRef = useRef();
  const salesRef = useRef();
  const purchaseRef = useRef();
  const inventoryRef = useRef();
  const lowStockRef = useRef();
  const expiryRef = useRef();
  const supplierRef = useRef();
  const returnsRef = useRef();
  const duesRef = useRef();

  const filters = useMemo(
    () => ({
      datePreset: datePreset || undefined,
      dateFrom: datePreset === 'custom' ? dateFrom : undefined,
      dateTo: datePreset === 'custom' ? dateTo : undefined,
      _refresh: refreshKey,
    }),
    [datePreset, dateFrom, dateTo, refreshKey]
  );

  const tabRefMap = {
    overview: overviewRef,
    sales: salesRef,
    purchase: purchaseRef,
    inventory: inventoryRef,
    'low-stock': lowStockRef,
    expiry: expiryRef,
    suppliers: supplierRef,
    returns: returnsRef,
    dues: duesRef,
  };

  const getExportData = () => {
    const ref = tabRefMap[activeTab];
    return ref?.current?.getExport?.() || null;
  };

  const runExport = (kind) => {
    const exp = getExportData();
    if (!exp?.rows?.length) {
      setToast({
        type: 'error',
        message: exp ? 'No data to export' : 'Report is still loading — try again in a moment',
      });
      return;
    }
    const slug = exp.title.toLowerCase().replace(/\s+/g, '-');
    if (kind === 'csv') exportTableCsv(slug, exp.columns, exp.rows);
    else if (kind === 'excel') exportTableExcel(slug, exp.columns, exp.rows);
    else printReportHtml(exp.title, exp.columns, exp.rows);
    setToast({ type: 'success', message: 'Export started' });
  };

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 py-3">
      {toast.message ? (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: 'success', message: '' })} />
      ) : null}


      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3 space-y-3">
          <ReportFilters
            datePreset={datePreset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPresetChange={setDatePreset}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            onExportCsv={() => runExport('csv')}
            onExportExcel={() => runExport('excel')}
            onExportPdf={() => runExport('pdf')}
          />
          <div className="flex gap-3 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 rounded-xl px-4.5 py-2 text-[11px] font-bold transition ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' ? <OverviewTab ref={overviewRef} filters={filters} /> : null}
        {activeTab === 'sales' ? <SalesReportTab ref={salesRef} filters={filters} /> : null}
        {activeTab === 'purchase' ? <PurchaseReportTab ref={purchaseRef} filters={filters} /> : null}
        {activeTab === 'inventory' ? <InventoryReportTab ref={inventoryRef} filters={filters} /> : null}
        {activeTab === 'low-stock' ? <LowStockReportTab ref={lowStockRef} filters={filters} /> : null}
        {activeTab === 'expiry' ? <ExpiryReportTab ref={expiryRef} filters={filters} /> : null}
        {activeTab === 'suppliers' ? <SupplierReportTab ref={supplierRef} filters={filters} /> : null}
        {activeTab === 'returns' ? <ReturnReportTab ref={returnsRef} filters={filters} /> : null}
        {activeTab === 'dues' ? <DueCollectionReportTab ref={duesRef} filters={filters} /> : null}
      </div>
    </div>
  );
}
