import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchExpiryReport } from '../../../services/pharmacy/reportsService';
import { formatDate, formatMoney, ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'medicine', label: 'Medicine' },
  { key: 'batch', label: 'Batch' },
  { key: 'expiryDate', label: 'Expiry', render: (r) => formatDate(r.expiryDate) },
  { key: 'availableQty', label: 'Qty' },
  { key: 'purchaseValue', label: 'Purchase Value', render: (r) => formatMoney(r.purchaseValue) },
  { key: 'daysRemaining', label: 'Days Left' },
];

const ExpiryReportTab = forwardRef(function ExpiryReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchExpiryReport(filters));
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
    getExport: () => ({ title: 'Expiry Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Expired', value: String(c.expiredMedicines ?? '—') },
          { label: 'Expiring ≤30d', value: String(c.expiringIn30Days ?? '—') },
          { label: 'Expiring ≤60d', value: String(c.expiringIn60Days ?? '—') },
          { label: 'Expiring ≤90d', value: String(c.expiringIn90Days ?? '—') },
        ]}
      />
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default ExpiryReportTab;
