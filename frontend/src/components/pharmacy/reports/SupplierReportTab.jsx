import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchSupplierReport } from '../../../services/pharmacy/reportsService';
import { formatMoney, PieChartCard, ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'supplier', label: 'Supplier' },
  { key: 'orders', label: 'Orders' },
  { key: 'purchaseValue', label: 'Purchase', render: (r) => formatMoney(r.purchaseValue) },
  { key: 'returns', label: 'Returns', render: (r) => formatMoney(r.returns) },
  { key: 'status', label: 'Status' },
];

const SupplierReportTab = forwardRef(function SupplierReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchSupplierReport(filters));
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
    getExport: () => ({ title: 'Supplier Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Total Suppliers', value: String(c.totalSuppliers ?? '—') },
          { label: 'Purchase Value', value: formatMoney(c.totalPurchaseValue) },
          { label: 'Vendor Returns', value: formatMoney(c.vendorReturns) },
          { label: 'Active Suppliers', value: String(c.activeSuppliers ?? '—') },
        ]}
      />
      <PieChartCard title="Supplier Purchase Distribution" data={data?.charts?.supplierPurchaseDistribution} nameKey="name" valueKey="value" loading={loading} />
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default SupplierReportTab;
