import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchReportOverview } from '../../../services/pharmacy/reportsService';
import { buildOverviewExport } from '../../../utils/exportReports';
import {
  ExpiryWidget,
  LowStockWidget,
  TopSellingWidget,
  TopSuppliersWidget,
} from './OverviewWidgets';
import { DualLineChartCard, formatMoney, LineChartCard, ReportCards } from './reportUi';

const OverviewTab = forwardRef(function OverviewTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchReportOverview(filters));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useImperativeHandle(ref, () => ({
    getExport: () => buildOverviewExport(data),
  }));

  const c = data?.cards || {};
  const w = data?.widgets || {};
  const cards = [
    { label: 'Total Revenue', value: formatMoney(c.totalRevenue), tone: 'from-blue-50 to-cyan-50 border-blue-100' },
    { label: 'Total Purchase Value', value: formatMoney(c.totalPurchaseValue), tone: 'from-amber-50 to-orange-50 border-amber-100' },
    { label: 'Inventory Value', value: formatMoney(c.currentInventoryValue), tone: 'from-violet-50 to-indigo-50 border-violet-100' },
    { label: 'Outstanding Dues', value: formatMoney(c.totalOutstandingDues), tone: 'from-rose-50 to-red-50 border-rose-100' },
    { label: 'Returns Value', value: formatMoney(c.totalReturnsValue), tone: 'from-emerald-50 to-lime-50 border-emerald-100' },
  ];

  return (
    <div className="space-y-4 p-3">
      <ReportCards items={cards} loading={loading} />
      <div className="grid gap-3 lg:grid-cols-3">
        <LineChartCard title="Sales Trend" data={data?.charts?.salesTrend} loading={loading} />
        <LineChartCard title="Purchase Trend" data={data?.charts?.purchaseTrend} loading={loading} />
        <DualLineChartCard title="Revenue vs Purchase" data={data?.charts?.revenueVsPurchase} loading={loading} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TopSellingWidget items={w.topSellingMedicines} loading={loading} />
        <TopSuppliersWidget items={w.topSuppliers} loading={loading} />
        <LowStockWidget items={w.lowStockAlerts} loading={loading} />
        <ExpiryWidget items={w.expiryAlerts} loading={loading} />
      </div>
    </div>
  );
});

export default OverviewTab;
