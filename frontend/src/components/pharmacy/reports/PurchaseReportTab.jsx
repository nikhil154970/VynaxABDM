import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { fetchPurchaseReport } from '../../../services/pharmacy/reportsService';
import { BarChartCard, formatDate, formatMoney, ReportCards, ReportTable } from './reportUi';

const COLS = [
  { key: 'poNumber', label: 'PO Number' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'purchaseAmount', label: 'Amount', render: (r) => formatMoney(r.purchaseAmount) },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
];

const PurchaseReportTab = forwardRef(function PurchaseReportTab({ filters }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchPurchaseReport(filters));
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
    getExport: () => ({ title: 'Purchase Report', columns: COLS, rows: data?.table || [] }),
  }));

  const c = data?.cards || {};
  const supplierChart = (data?.charts?.supplierWisePurchases || []).map((s) => ({
    label: s.supplierName,
    amount: s.amount,
  }));

  return (
    <div className="space-y-4 p-3">
      <ReportCards
        loading={loading}
        items={[
          { label: 'Purchase Value', value: formatMoney(c.totalPurchaseValue) },
          { label: 'Total GRNs', value: String(c.totalGrns ?? '—') },
          { label: 'Pending POs', value: String(c.pendingPurchaseOrders ?? '—') },
          { label: 'Active Suppliers', value: String(c.activeSuppliers ?? '—') },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <BarChartCard title="Monthly Purchases" data={data?.charts?.monthlyPurchases} loading={loading} />
        <BarChartCard title="Supplier Wise" data={supplierChart} xKey="label" loading={loading} />
      </div>
      <ReportTable columns={COLS} rows={data?.table} loading={loading} />
    </div>
  );
});

export default PurchaseReportTab;
