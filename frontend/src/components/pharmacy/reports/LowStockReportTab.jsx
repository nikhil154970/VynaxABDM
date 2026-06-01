import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchLowStockReport } from '../../../services/pharmacy/reportsService';
import { ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'medicine', label: 'Medicine' },
  { key: 'currentStock', label: 'Current Stock' },
  { key: 'minimumLevel', label: 'Minimum Level' },
  { key: 'requiredQuantity', label: 'Required Qty' },
  { key: 'status', label: 'Status' },
];

const LowStockReportTab = forwardRef(function LowStockReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchLowStockReport(filters));
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
    getExport: () => ({ title: 'Low Stock Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Low Stock', value: String(c.lowStockMedicines ?? '—') },
          { label: 'Out of Stock', value: String(c.outOfStockMedicines ?? '—') },
          { label: 'Reorder Required', value: String(c.reorderRequired ?? '—') },
        ]}
      />
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default LowStockReportTab;
