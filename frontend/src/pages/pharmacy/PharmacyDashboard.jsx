import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Package,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchPharmacyDashboard } from '../../services/pharmacy/dashboardService';
import './PharmacyDashboard.css';

function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function MiniTrend({ color, data }) {
  const chartData = data?.length ? data : [{ day: '-', amount: 0 }];
  return (
    <ResponsiveContainer width="100%" height={28}>
      <AreaChart data={chartData} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="amount" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, bg, to, trendData, loading }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="pharmacy-kpi" onClick={() => navigate(to)}>
      <div className="pharmacy-kpi-top">
        <span className="pharmacy-kpi-icon" style={{ background: bg, color }}>
          <Icon size={23} strokeWidth={2.4} />
        </span>
        <span>
          <span className="pharmacy-kpi-label">{label}</span>
          <strong>{loading ? '—' : value}</strong>
          <span className="pharmacy-kpi-sub" style={{ color }}>{loading ? 'Loading…' : sub}</span>
        </span>
      </div>
      <MiniTrend color={color} data={trendData} />
    </button>
  );
}

function SectionHeader({ title, action, onClick }) {
  return (
    <div className="pharmacy-section-head">
      <h2>{title}</h2>
      {action ? (
        <button type="button" onClick={onClick}>
          {action}
        </button>
      ) : (
        <span className="text-xs text-slate-400">This Week</span>
      )}
    </div>
  );
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.25rem' }}>
        {message}
      </td>
    </tr>
  );
}

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPharmacyDashboard();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = data?.kpis || {};
  const salesChart = data?.salesChart || [];
  const billingDistribution = data?.billingDistribution || [];
  const distributionTotal = data?.distributionTotal ?? 0;
  const pendingPrescriptions = data?.pendingPrescriptions || [];
  const recentBills = data?.recentBills || [];
  const lowStock = data?.lowStock || [];
  const suppliers = data?.suppliers || [];

  return (
    <div className="pharmacy-dashboard">
      <div className="pharmacy-kpi-grid">
        <KpiCard
          icon={ShoppingBag}
          label="Today Sales"
          value={formatMoney(kpis.todaySales)}
          sub={kpis.salesChangeLabel || '—'}
          color="#2563eb"
          bg="#dbeafe"
          to="/dashboard/pharmacy/billing"
          trendData={salesChart}
          loading={loading}
        />
        <KpiCard
          icon={ClipboardList}
          label="Pending Prescriptions"
          value={String(kpis.pendingPrescriptions ?? '—')}
          sub="View prescription queue"
          color="#7c3aed"
          bg="#ede9fe"
          to="/dashboard/pharmacy/billing/queue"
          trendData={salesChart}
          loading={loading}
        />
        <KpiCard
          icon={Package}
          label="Low Stock Medicines"
          value={String(kpis.lowStockCount ?? '—')}
          sub="View inventory"
          color="#f97316"
          bg="#ffedd5"
          to="/dashboard/pharmacy/inventory"
          trendData={salesChart}
          loading={loading}
        />
        <KpiCard
          icon={Truck}
          label="Suppliers"
          value={String(kpis.suppliersCount ?? '—')}
          sub={
            kpis.suppliersNeedFollowUp > 0
              ? `${kpis.suppliersNeedFollowUp} need follow-up`
              : 'All suppliers OK'
          }
          color="#ef4444"
          bg="#fee2e2"
          to="/dashboard/pharmacy/suppliers"
          trendData={salesChart}
          loading={loading}
        />
      </div>

      <div className="pharmacy-chart-grid">
        <section className="pharmacy-panel pharmacy-sales">
          <SectionHeader title="Sales Overview (This Week)" />
          <div className="pharmacy-chart">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChart} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pharmacySalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 400 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={42}
                    tickFormatter={(v) => (v >= 1000 ? `₹${v / 1000}K` : `₹${v}`)}
                    tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 400 }}
                  />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Sales']} />
                  <Area type="monotone" dataKey="amount" stroke="#2563eb" fill="url(#pharmacySalesFill)" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="pharmacy-panel">
          <SectionHeader title="Billing Distribution" />
          <div className="pharmacy-donut-row">
            <div className="pharmacy-donut">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={billingDistribution.filter((d) => d.amount > 0)}
                        dataKey="amount"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                      >
                        {billingDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pharmacy-donut-label">
                    <span>Total</span>
                    <strong>{formatMoney(distributionTotal)}</strong>
                  </div>
                </>
              )}
            </div>
            <div className="pharmacy-donut-legend">
              {billingDistribution.map((item) => (
                <div key={item.name}>
                  <span className="pharmacy-dot" style={{ background: item.color }} />
                  <span>{item.name}</span>
                  <strong>{item.value}%</strong>
                  <small>{formatMoney(item.amount)}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="pharmacy-bottom-grid">
        <section className="pharmacy-panel">
          <SectionHeader title="Pending Prescriptions" action="View All" onClick={() => navigate('/dashboard/pharmacy/billing/queue')} />
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>Token No.</th>
                  <th>Patient Name</th>
                  <th>Doctor</th>
                  <th>Medicines</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyRow colSpan={6} message="Loading…" />
                ) : pendingPrescriptions.length ? (
                  pendingPrescriptions.map((row) => (
                    <tr key={row.id}>
                      <td>{row.tokenNumber}</td>
                      <td>{row.patientName}</td>
                      <td>{row.doctorName}</td>
                      <td>{row.medicineCount}</td>
                      <td>{row.time}</td>
                      <td>
                        <button type="button" onClick={() => navigate('/dashboard/pharmacy/billing/queue')}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow colSpan={6} message="No pending prescriptions" />
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pharmacy-panel">
          <SectionHeader title="Recent Bills" action="View All" onClick={() => navigate('/dashboard/pharmacy/billing/history')} />
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Patient Name</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyRow colSpan={6} message="Loading…" />
                ) : recentBills.length ? (
                  recentBills.map((row) => (
                    <tr key={row.id}>
                      <td>{row.billNumber}</td>
                      <td>{row.patientName}</td>
                      <td>{row.type}</td>
                      <td>{formatMoney(row.amount)}</td>
                      <td className={row.statusKey === 'PAID' ? 'status-paid' : row.statusKey === 'PENDING_PAYMENT' || row.statusKey === 'PARTIALLY_PAID' ? 'status-pending' : ''}>{row.status}</td>
                      <td>{row.time}</td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow colSpan={6} message="No bills yet" />
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pharmacy-panel">
          <SectionHeader title="Low Stock Medicines" action="View All" onClick={() => navigate('/dashboard/pharmacy/inventory')} />
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table pharmacy-stock-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyRow colSpan={3} message="Loading…" />
                ) : lowStock.length ? (
                  lowStock.map((row) => (
                    <tr key={row.medicineName}>
                      <td>{row.medicineName}</td>
                      <td>{row.stockLabel}</td>
                      <td className={`stock-status stock-${row.status.toLowerCase()}`}>{row.status}</td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow colSpan={3} message="No low stock medicines" />
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pharmacy-panel">
          <SectionHeader title="Suppliers" action="View All" onClick={() => navigate('/dashboard/pharmacy/suppliers')} />
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table pharmacy-supplier-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyRow colSpan={2} message="Loading…" />
                ) : suppliers.length ? (
                  suppliers.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td className={`supplier-status supplier-${row.statusKey}`}>{row.status}</td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow colSpan={2} message="No suppliers found" />
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
