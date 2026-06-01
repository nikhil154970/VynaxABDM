import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Download,
  IndianRupee,
  Layers,
  Package,
  Printer,
  Search,
  TrendingDown,
} from 'lucide-react';
import Toast from '../../components/Toast';
import InventoryDetailsDrawer from '../../components/pharmacy/inventory/InventoryDetailsDrawer';
import InventoryTable from '../../components/pharmacy/inventory/InventoryTable';
import LowStockPage from '../../components/pharmacy/inventory/LowStockPage';
import NearExpiryPage from '../../components/pharmacy/inventory/NearExpiryPage';
import StockLedgerTable from '../../components/pharmacy/inventory/StockLedgerTable';
import InventoryPagination, { paginateList } from '../../components/pharmacy/inventory/InventoryPagination';
import {
  fetchInventory,
  fetchInventoryByMedicine,
  fetchInventorySummary,
  fetchLowStock,
  fetchNearExpiry,
  fetchStockLedger,
} from '../../services/pharmacy/inventoryService';
import { printInventoryReport } from '../../utils/printInventoryReport';
import './PharmacyInventory.css';

const VIEWS = [
  { id: 'all', label: 'All Inventory' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'near-expiry', label: 'Near Expiry' },
  { id: 'ledger', label: 'Stock Ledger' },
];

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SummaryCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="mt-0.5 text-xl font-bold leading-none text-slate-900">{value}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="pharmacy-inventory-skeleton h-11 w-full" />
      ))}
    </div>
  );
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function exportInventoryCsv(rows) {
  const headers = [
    'Medicine Name',
    'Generic Name',
    'Category',
    'Total Stock',
    'Available Stock',
    'Batches',
    'Nearest Expiry',
    'Inventory Value',
    'Status',
  ];
  const lines = rows.map((r) =>
    [
      r.medicineName,
      r.genericName,
      r.category,
      r.totalStock,
      r.availableStock,
      r.batchCount,
      r.nearestExpiry ? new Date(r.nearestExpiry).toISOString().slice(0, 10) : '',
      r.inventoryValue,
      r.status,
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportInventoryExcel(rows) {
  const headers = [
    'Medicine Name',
    'Generic Name',
    'Category',
    'Total Stock',
    'Available Stock',
    'Batches',
    'Nearest Expiry',
    'Inventory Value',
    'Status',
  ];
  const trs = rows
    .map(
      (r) => `<tr>
      <td>${r.medicineName}</td>
      <td>${r.genericName || ''}</td>
      <td>${r.category || ''}</td>
      <td>${r.totalStock}</td>
      <td>${r.availableStock}</td>
      <td>${r.batchCount}</td>
      <td>${r.nearestExpiry ? new Date(r.nearestExpiry).toLocaleDateString('en-IN') : ''}</td>
      <td>${r.inventoryValue}</td>
      <td>${r.status}</td>
    </tr>`
    )
    .join('');
  const html = `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-inventory-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PharmacyInventory() {
  const [view, setView] = useState('all');
  const [summary, setSummary] = useState({});
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [nearExpiry, setNearExpiry] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedBatch, setDebouncedBatch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setDebouncedBatch(batchSearch.trim());
    }, 320);
    return () => clearTimeout(t);
  }, [search, batchSearch]);

  useEffect(() => {
    setPage(1);
  }, [view, debouncedSearch, debouncedBatch, categoryFilter, stockFilter]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchInventorySummary();
      setSummary(data.summary || {});
    } catch {
      /* summary optional on sub-views */
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedBatch) params.batchSearch = debouncedBatch;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (stockFilter === 'low_stock') params.filter = 'low_stock';
      else if (stockFilter === 'near_expiry') params.filter = 'near_expiry';
      else if (stockFilter === 'out_of_stock') params.filter = 'out_of_stock';
      const data = await fetchInventory(params);
      setInventory(data.inventory || []);
      setSummary(data.summary || {});
      setCategories(data.categories || []);
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to load inventory',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, debouncedBatch, categoryFilter, stockFilter]);

  const loadLowStock = useCallback(async () => {
    setSubLoading(true);
    try {
      const data = await fetchLowStock();
      setLowStock(data.lowStock || []);
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to load low stock' });
    } finally {
      setSubLoading(false);
    }
  }, []);

  const loadNearExpiry = useCallback(async () => {
    setSubLoading(true);
    try {
      const data = await fetchNearExpiry();
      setNearExpiry(data.nearExpiry || []);
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to load near expiry' });
    } finally {
      setSubLoading(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setSubLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await fetchStockLedger(params);
      setLedger(data.ledger || []);
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to load stock ledger' });
    } finally {
      setSubLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (view === 'all') loadInventory();
    else if (view === 'low-stock') loadLowStock();
    else if (view === 'near-expiry') loadNearExpiry();
    else if (view === 'ledger') loadLedger();
  }, [view, loadInventory, loadLowStock, loadNearExpiry, loadLedger]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Medicines',
        value: String(summary.totalMedicines ?? 0),
        sub: 'Active product master',
        icon: Package,
        tone: 'from-blue-50 to-cyan-50 text-blue-600 border-blue-100',
      },
      {
        label: 'Total Stock Qty',
        value: String(summary.totalStockQuantity ?? 0),
        sub: 'Available units',
        icon: Boxes,
        tone: 'from-violet-50 to-purple-50 text-violet-600 border-violet-100',
      },
      {
        label: 'Low Stock',
        value: String(summary.lowStockMedicines ?? 0),
        sub: `Below ${summary.lowStockMinimum ?? 20} units`,
        icon: TrendingDown,
        tone: 'from-orange-50 to-amber-50 text-orange-600 border-orange-100',
      },
      {
        label: 'Near Expiry',
        value: String(summary.nearExpiryMedicines ?? 0),
        sub: `Within ${summary.nearExpiryDays ?? 90} days`,
        icon: CalendarClock,
        tone: 'from-amber-50 to-yellow-50 text-amber-700 border-amber-100',
      },
      {
        label: 'Inventory Value',
        value: money(summary.inventoryValue),
        sub: 'Qty × purchase price',
        icon: IndianRupee,
        tone: 'from-emerald-50 to-green-50 text-emerald-600 border-emerald-100',
      },
    ],
    [summary]
  );

  const openDrawer = async (row) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerData(null);
    try {
      const data = await fetchInventoryByMedicine(row.medicineId);
      setDrawerData(data);
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to load medicine inventory',
      });
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const exportRows = view === 'all' ? inventory : view === 'low-stock' ? lowStock : [];

  const handleExportCsv = () => {
    if (!exportRows.length) {
      setToast({ type: 'error', message: 'No rows to export' });
      return;
    }
    exportInventoryCsv(exportRows);
    setToast({ type: 'success', message: 'CSV exported' });
  };

  const handleExportExcel = () => {
    if (!exportRows.length) {
      setToast({ type: 'error', message: 'No rows to export' });
      return;
    }
    exportInventoryExcel(exportRows);
    setToast({ type: 'success', message: 'Excel file exported' });
  };

  const handlePrint = () => {
    printInventoryReport({
      summary,
      rows: inventory,
      title: 'Pharmacy Inventory Report',
    });
  };

  const showMainFilters = view === 'all' || view === 'ledger';

  const activeList =
    view === 'all'
      ? inventory
      : view === 'low-stock'
        ? lowStock
        : view === 'near-expiry'
          ? nearExpiry
          : ledger;

  const { items: pagedItems, total: pagedTotal, page: safePage } = paginateList(activeList, page);

  return (
    <div className="pharmacy-inventory-page flex h-full flex-col overflow-hidden">
      {toast.message ? (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: 'success', message: '' })} />
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="pharmacy-inventory-view-tabs">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`pharmacy-inventory-view-tab ${view === v.id ? 'active' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        </div>

        {showMainFilters ? (
          <div className="pharmacy-inventory-filters mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Medicine or generic name…"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {view === 'all' ? (
                <>
                  <div className="relative min-w-[160px] flex-1 md:max-w-[200px]">
                    <Layers className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      placeholder="Batch number…"
                      className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <option value="all">All stock</option>
                    <option value="low_stock">Low stock</option>
                    <option value="near_expiry">Near expiry</option>
                    <option value="out_of_stock">Out of stock</option>
                  </select>
                </>
              ) : null}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Stock is read-only. Complete GRN to add batches; billing/dispensing will reduce stock later.
            </p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {view === 'all' ? (
            loading ? (
              <TableSkeleton />
            ) : inventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Package className="h-8 w-8" />
                </span>
                <h3 className="text-lg font-bold text-slate-900">No inventory yet</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Complete a GRN against an approved purchase order to create batches and stock here.
                </p>
              </div>
            ) : (
              <>
                <InventoryTable rows={pagedItems} onView={openDrawer} />
                <InventoryPagination page={safePage} totalItems={pagedTotal} onPageChange={setPage} />
              </>
            )
          ) : view === 'low-stock' ? (
            <>
              <LowStockPage rows={pagedItems} loading={subLoading} />
              {!subLoading && pagedTotal > 0 ? (
                <InventoryPagination page={safePage} totalItems={pagedTotal} onPageChange={setPage} />
              ) : null}
            </>
          ) : view === 'near-expiry' ? (
            <>
              <NearExpiryPage rows={pagedItems} loading={subLoading} />
              {!subLoading && pagedTotal > 0 ? (
                <InventoryPagination page={safePage} totalItems={pagedTotal} onPageChange={setPage} />
              ) : null}
            </>
          ) : subLoading ? (
            <TableSkeleton />
          ) : (
            <>
              <div className="p-2">
                <StockLedgerTable ledger={pagedItems} showMedicine />
              </div>
              {pagedTotal > 0 ? (
                <InventoryPagination page={safePage} totalItems={pagedTotal} onPageChange={setPage} />
              ) : null}
            </>
          )}
        </div>
      </div>

      <InventoryDetailsDrawer
        open={drawerOpen}
        data={drawerData}
        loading={drawerLoading}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerData(null);
        }}
      />
    </div>
  );
}
