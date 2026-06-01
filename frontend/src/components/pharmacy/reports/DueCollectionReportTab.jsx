import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchDuesReport } from '../../../services/pharmacy/reportsService';
import { formatDate, formatMoney, LineChartCard, ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'patientName', label: 'Patient' },
  { key: 'uhid', label: 'UHID' },
  { key: 'billNumber', label: 'Bill #' },
  { key: 'pendingAmount', label: 'Pending', render: (r) => formatMoney(r.pendingAmount) },
  { key: 'lastPaymentDate', label: 'Last Payment', render: (r) => formatDate(r.lastPaymentDate) },
  { key: 'status', label: 'Status' },
];

const DueCollectionReportTab = forwardRef(function DueCollectionReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchDuesReport(filters));
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
    getExport: () => ({ title: 'Due Collection Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Outstanding', value: formatMoney(c.outstandingAmount) },
          { label: 'Collected', value: formatMoney(c.collectedAmount) },
          { label: 'Pending Accounts', value: String(c.pendingAccounts ?? '—') },
          { label: 'Overdue', value: String(c.overdueAccounts ?? '—') },
        ]}
      />
      <LineChartCard title="Due Collection Trend" data={data?.charts?.dueCollectionTrend} loading={loading} />
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default DueCollectionReportTab;
