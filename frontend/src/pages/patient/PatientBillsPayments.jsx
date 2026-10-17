import { useState, useEffect, useCallback, useMemo } from 'react';
import patientApi from '../../utils/patientApi';

const STATUS_COLORS = {
  PAID: 'bg-green-50 text-green-600 border-green-200',
  PENDING: 'bg-red-50 text-red-600 border-red-200',
  PARTIAL: 'bg-amber-50 text-amber-600 border-amber-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-600 border-amber-200',
  DRAFT: 'bg-gray-50 text-gray-500 border-gray-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

function fmtAmt(val) {
  if (val == null) return '—';
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (Number.isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function PatientBillsPayments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('hospital');
  const [filter, setFilter] = useState('all');

  const fetchBills = useCallback(async () => {
    try {
      setError(false);
      const r = await patientApi.get('/patient/portal/bills');
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); fetchBills(); }, [fetchBills]);

  const hospitalBills = useMemo(() => {
    const list = data?.bills || [];
    if (filter === 'all') return list;
    if (filter === 'pending') return list.filter((b) => b.status === 'PENDING');
    if (filter === 'partial') return list.filter((b) => b.status === 'PARTIAL' || b.status === 'PARTIALLY_PAID');
    if (filter === 'paid') return list.filter((b) => b.status === 'PAID');
    return list;
  }, [data, filter]);

  const pharmacyBills = data?.pharmacyBills || [];

  const stats = useMemo(() => {
    const hb = hospitalBills;
    const pb = pharmacyBills;

    const activeStatuses = ['PENDING', 'PARTIAL', 'PARTIALLY_PAID'];
    const pendingAmt = hb.reduce((sum, b) => {
      if (!activeStatuses.includes(b.status)) return sum;
      const total = b.totalAmount || 0;
      const paid = b.paidAmount || 0;
      return sum + Math.max(0, total - paid);
    }, 0);

    const paidAmt = hb.reduce((sum, b) => sum + (b.paidAmount || 0), 0) +
      pb.reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    return {
      total: hb.length,
      pending: pendingAmt,
      paid: paidAmt,
      pharmacyCount: pb.length,
    };
  }, [hospitalBills, pharmacyBills]);

  if (loading && !data) return <Skeleton />;

  const currentItems = tab === 'hospital' ? hospitalBills : pharmacyBills;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bills & Payments</h1>
        <p className="text-sm text-gray-400 mt-0.5">View your hospital and pharmacy bills</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Bills" value={stats.total} color="blue" />
        <StatCard label="Pending Amount" value={fmtAmt(stats.pending)} color="amber" />
        <StatCard label="Paid Amount" value={fmtAmt(stats.paid)} color="green" />
        <StatCard label="Pharmacy Bills" value={stats.pharmacyCount} color="purple" />
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
          <TabBtn active={tab === 'hospital'} onClick={() => setTab('hospital')}>Hospital Bills</TabBtn>
          <TabBtn active={tab === 'pharmacy'} onClick={() => setTab('pharmacy')}>Pharmacy Bills</TabBtn>
        </div>
        {tab === 'hospital' && (
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
            {['all', 'pending', 'partial', 'paid'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filter === f ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-400 mt-1">Could not load bills</p>
          <button onClick={fetchBills} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">Retry</button>
        </div>
      ) : currentItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-400 font-medium">No bills found</p>
          <p className="text-xs text-gray-300 mt-1">Your bills will appear here once generated by the hospital</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentItems.map((b) => (
            tab === 'hospital' ? (
              <HospitalBillCard key={b.id} bill={b} />
            ) : (
              <PharmacyBillCard key={b.id} bill={b} />
            )
          ))}
        </div>
      )}

    </div>
  );
}

function HospitalBillCard({ bill: b }) {
  const isPending = b.status === 'PENDING';
  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition ${
      isPending ? 'border-red-200' : 'border-gray-100'
    }`}>
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isPending ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-800 truncate">{b.billNumber || 'Bill'}</p>
              <StatusBadge status={b.status} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{b.billDate?.slice(0, 10) || b.createdAt?.slice(0, 10)}{b.visitType ? ` — ${b.visitType}` : ''}</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Amt label="Total" value={fmtAmt(b.totalAmount)} color="text-gray-800" />
          <Amt label="Paid" value={fmtAmt(b.paidAmount)} color="text-green-600" />
          <Amt label="Pending" value={fmtAmt(Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0)))} color={isPending ? 'text-red-600' : 'text-gray-400'} />
        </div>

        {b.items?.length > 0 && (
          <div className="pt-3 border-t border-gray-50">
            <p className="text-[11px] text-gray-400 font-medium mb-2">Line Items ({b.items.length})</p>
            <div className="space-y-1">
              {b.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-gray-600 py-1.5 px-3 rounded-lg bg-gray-50">
                  <span className="min-w-0 flex-1 truncate">{item.description || item.testName || item.medicineName || 'Item'}</span>
                  <span className="font-semibold text-gray-700 shrink-0 ml-2">{fmtAmt(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {b.payments?.length > 0 && (
          <div className={`pt-3 ${b.items?.length > 0 ? 'mt-3 border-t border-gray-50' : ''}`}>
            <p className="text-[11px] text-gray-400 font-medium mb-2">Payments ({b.payments.length})</p>
            <div className="space-y-1">
              {b.payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-green-50/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-gray-500">{p.mode || p.paymentMode || 'Payment'}</span>
                    {p.createdAt && <span className="text-gray-400">· {new Date(p.createdAt).toLocaleDateString('en-IN')}</span>}
                  </div>
                  <span className="font-semibold text-green-600 shrink-0 ml-2">{fmtAmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {b.notes && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-[11px] text-gray-400 font-medium mb-1">Notes</p>
            <p className="text-xs text-gray-600">{b.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PharmacyBillCard({ bill: b }) {
  const pendingAmt = b.pendingAmount || Math.max(0, (b.grandTotal || 0) - (b.paidAmount || 0));
  const total = b.grandTotal || b.subTotal || 0;
  const isPending = (b.status === 'PENDING' || pendingAmt > 0) && b.status !== 'PAID';
  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition ${
      isPending ? 'border-red-200' : 'border-gray-100'
    }`}>
      <div className="px-5 py-4 bg-gradient-to-r from-purple-50 to-indigo-50/50 border-b border-purple-100 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-800 truncate">{b.billNumber || 'Pharmacy Bill'}</p>
              <StatusBadge status={b.status} />
              {b.dispenseStatus && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-200">
                  {b.dispenseStatus}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{b.createdAt?.slice(0, 10)}{b.billingType ? ` — ${b.billingType}` : ''}</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Amt label="Total" value={fmtAmt(total)} color="text-gray-800" />
          <Amt label="Paid" value={fmtAmt(b.paidAmount)} color="text-green-600" />
          <Amt label="Pending" value={fmtAmt(pendingAmt)} color={isPending ? 'text-red-600' : 'text-gray-400'} />
          {b.discount != null && <Amt label="Discount" value={fmtAmt(b.discount)} color="text-gray-500" />}
        </div>

        {b.items?.length > 0 && (
          <div className="pt-3 border-t border-gray-50">
            <p className="text-[11px] text-gray-400 font-medium mb-2">Items ({b.items.length})</p>
            <div className="space-y-1">
              {b.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-gray-600 py-1.5 px-3 rounded-lg bg-gray-50">
                  <span className="min-w-0 flex-1 truncate">{item.description || item.medicineName || item.name || 'Item'}{item.quantity ? ` × ${item.quantity}` : ''}</span>
                  <span className="font-semibold text-gray-700 shrink-0 ml-2">{fmtAmt(item.lineTotal || item.total || item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {b.payments?.length > 0 && (
          <div className={`pt-3 ${b.items?.length > 0 ? 'mt-3 border-t border-gray-50' : ''}`}>
            <p className="text-[11px] text-gray-400 font-medium mb-2">Payments ({b.payments.length})</p>
            <div className="space-y-1">
              {b.payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-green-50/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-gray-500">{p.mode || p.paymentMode || 'Payment'}</span>
                    {p.createdAt && <span className="text-gray-400">· {new Date(p.createdAt).toLocaleDateString('en-IN')}</span>}
                  </div>
                  <span className="font-semibold text-green-600 shrink-0 ml-2">{fmtAmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_COLORS[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {status || '—'}
    </span>
  );
}

function Amt({ label, value, color }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      <p className={`text-sm font-extrabold mt-0.5 ${color || 'text-gray-700'}`}>{value ?? '—'}</p>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    purple: 'text-violet-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className={`text-2xl md:text-3xl font-extrabold ${colors[color] || 'text-blue-600'}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1 font-medium">{label}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="flex gap-2">
        {[1, 2].map((i) => <div key={i} className="h-10 w-32 bg-gray-100 rounded-lg" />)}
      </div>
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
    </div>
  );
}
