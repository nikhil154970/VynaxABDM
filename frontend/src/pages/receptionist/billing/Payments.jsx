import { useState } from 'react';
import {
  MdSearch, MdFilterList, MdReceiptLong,
  MdCalendarToday, MdCreditCard, MdPhoneAndroid, MdLocalAtm
} from 'react-icons/md';

const payments = [
  { id: 'PAY-001', invoice: 'INV-2401', patient: 'Ravi Kumar', date: '18 Apr 2026', amount: 1200, mode: 'Cash', status: 'Settled' },
  { id: 'PAY-002', invoice: 'INV-2402', patient: 'Priya Singh', date: '17 Apr 2026', amount: 800, mode: 'UPI', status: 'Settled' },
  { id: 'PAY-003', invoice: 'INV-2403', patient: 'Mohan Das', date: '16 Apr 2026', amount: 10000, mode: 'Card', status: 'Partial' },
  { id: 'PAY-004', invoice: 'INV-2405', patient: 'Arjun Yadav', date: '15 Apr 2026', amount: 1500, mode: 'UPI', status: 'Settled' },
  { id: 'PAY-005', invoice: 'INV-2406', patient: 'Meena Tiwari', date: '18 Apr 2026', amount: 950, mode: 'Cash', status: 'Settled' },
  { id: 'PAY-006', invoice: 'INV-2407', patient: 'Vijay Kumar', date: '14 Apr 2026', amount: 20000, mode: 'Insurance', status: 'Partial' },
];

const MODE_ICON = { Cash: MdLocalAtm, Card: MdCreditCard, UPI: MdPhoneAndroid, Insurance: MdReceiptLong };
const MODE_COLOR = { Cash: '#14532d', Card: '#1e40af', UPI: '#6b21a8', Insurance: '#92400e' };
const MODE_BG = { Cash: '#dcfce7', Card: '#dbeafe', UPI: '#f3e8ff', Insurance: '#fef3c7' };

const STATUS_STYLE = {
  Settled: { bg: '#dcfce7', text: '#14532d' },
  Partial: { bg: '#fef9c3', text: '#854d0e' },
};

export default function Payments() {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('All');

  const modes = ['All', 'Cash', 'Card', 'UPI', 'Insurance'];

  const filtered = payments.filter(p => {
    const matchSearch = p.patient.toLowerCase().includes(search.toLowerCase()) ||
      p.invoice.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    const matchMode = modeFilter === 'All' || p.mode === modeFilter;
    return matchSearch && matchMode;
  });

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

  const modeBreakdown = modes.slice(1).map(m => ({
    mode: m,
    count: payments.filter(p => p.mode === m).length,
    total: payments.filter(p => p.mode === m).reduce((s, p) => s + p.amount, 0),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Payments</h1>
        <p className="text-xs text-gray-500 mt-0.5">All received payments and transactions</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Total */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Collected</p>
              <p className="text-3xl font-bold text-blue-700">₹{totalCollected.toLocaleString()}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              {modeBreakdown.map(m => {
                const Icon = MODE_ICON[m.mode];
                return (
                  <div key={m.mode} className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                    style={{ background: MODE_BG[m.mode] }}>
                    <Icon className="w-4 h-4" style={{ color: MODE_COLOR[m.mode] }} />
                    <div>
                      <p className="text-sm font-bold" style={{ color: MODE_COLOR[m.mode] }}>₹{m.total.toLocaleString()}</p>
                      <p className="text-xs" style={{ color: MODE_COLOR[m.mode] }}>{m.mode} · {m.count} txn</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patient or invoice..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <MdFilterList className="w-4 h-4 text-gray-400" />
              {modes.map(m => (
                <button key={m} onClick={() => setModeFilter(m)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                  style={{ background: modeFilter === m ? '#1d4ed8' : '#f1f5f9', color: modeFilter === m ? '#fff' : '#64748b' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f8faff' }}>
                  {['Payment ID', 'Invoice', 'Patient', 'Date', 'Amount', 'Mode', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => {
                  const Icon = MODE_ICON[p.mode];
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{p.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{p.invoice}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-sm">{p.patient}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MdCalendarToday className="w-3 h-3" />{p.date}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">₹{p.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit"
                          style={{ background: MODE_BG[p.mode], color: MODE_COLOR[p.mode] }}>
                          <Icon className="w-3.5 h-3.5" />{p.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={STATUS_STYLE[p.status]}>{p.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
