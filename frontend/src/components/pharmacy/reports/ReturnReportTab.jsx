import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchReturnsReport } from '../../../services/pharmacy/reportsService';
import { formatDate, formatMoney, LineChartCard, PieChartCard, ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'returnNumber', label: 'Return #' },
  { key: 'returnType', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'amount', label: 'Amount', render: (r) => formatMoney(r.amount) },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
];

const ReturnReportTab = forwardRef(function ReturnReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchReturnsReport(filters));
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
    getExport: () => ({ title: 'Return Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Total Returns', value: String(c.totalReturns ?? '—') },
          { label: 'Customer', value: String(c.customerReturns ?? '—') },
          { label: 'Vendor', value: String(c.vendorReturns ?? '—') },
          { label: 'Expired', value: String(c.expiredReturns ?? '—') },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <LineChartCard title="Return Trends" data={data?.charts?.returnTrends} loading={loading} />
        <PieChartCard title="Return Types" data={data?.charts?.returnTypeDistribution} nameKey="label" loading={loading} />
      </div>
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default ReturnReportTab;
