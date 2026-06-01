import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchInventoryReport } from '../../../services/pharmacy/reportsService';
import { BarChartCard, formatMoney, PieChartCard, ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'medicine', label: 'Medicine' },
  { key: 'category', label: 'Category' },
  { key: 'availableQty', label: 'Available Qty' },
  { key: 'batchCount', label: 'Batches' },
  { key: 'inventoryValue', label: 'Value', render: (r) => formatMoney(r.inventoryValue) },
];

const InventoryReportTab = forwardRef(function InventoryReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchInventoryReport(filters));
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
    getExport: () => ({ title: 'Inventory Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  const catChart = (data?.charts?.categoryWiseStock || []).map((x) => ({ label: x.category, amount: x.value }));

  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Total Medicines', value: String(c.totalMedicines ?? '—') },
          { label: 'Total Stock', value: String(c.totalStock ?? '—') },
          { label: 'Inventory Value', value: formatMoney(c.totalInventoryValue) },
          { label: 'Active Batches', value: String(c.activeBatches ?? '—') },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <BarChartCard title="Category Wise Stock" data={catChart} loading={loading} />
        <PieChartCard title="Inventory Distribution" data={data?.charts?.inventoryDistribution} nameKey="name" valueKey="value" loading={loading} />
      </div>
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default InventoryReportTab;
