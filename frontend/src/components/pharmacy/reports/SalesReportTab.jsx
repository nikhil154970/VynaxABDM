import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchSalesReport } from '../../../services/pharmacy/reportsService';
import { BarChartCard, formatDate, formatMoney, LineChartCard, PieChartCard, ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'billNumber', label: 'Bill Number' },
  { key: 'patientName', label: 'Patient' },
  { key: 'billDate', label: 'Date', render: (r) => formatDate(r.billDate) },
  { key: 'amount', label: 'Amount', render: (r) => formatMoney(r.amount) },
  { key: 'paymentMode', label: 'Payment Mode' },
  { key: 'status', label: 'Status' },
];

const SalesReportTab = forwardRef(function SalesReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchSalesReport(filters));
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
    getExport: () => ({ title: 'Sales Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Total Sales', value: formatMoney(c.totalSales) },
          { label: 'Total Bills', value: String(c.totalBills ?? '—') },
          { label: 'Avg Bill Value', value: formatMoney(c.averageBillValue) },
          { label: 'Collection', value: formatMoney(c.collectionAmount) },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <LineChartCard title="Daily Sales" data={data?.charts?.dailySales} loading={loading} />
        <BarChartCard title="Monthly Sales" data={data?.charts?.monthlySales} loading={loading} />
        <PieChartCard title="Payment Mode" data={data?.charts?.paymentModeDistribution} nameKey="label" loading={loading} />
      </div>
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default SalesReportTab;
