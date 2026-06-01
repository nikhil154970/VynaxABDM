import { useState } from 'react';
import { MdSearch, MdWarning, MdReceiptLong, MdPhone, MdCalendarToday, MdSend } from 'react-icons/md';

const dues = [
  { id: 'INV-2403', patient: 'Mohan Das', patientId: 'PAT-003', phone: '9988776655', type: 'IPD', total: 18500, paid: 10000, date: '16 Apr 2026', days: 2 },
  { id: 'INV-2404', patient: 'Sunita Gupta', patientId: 'PAT-004', phone: '8877665544', type: 'IPD', total: 24000, paid: 0, date: '15 Apr 2026', days: 3 },
  { id: 'INV-2407', patient: 'Vijay Kumar', patientId: 'PAT-010', phone: '9001122334', type: 'IPD', total: 35000, paid: 20000, date: '14 Apr 2026', days: 4 },
];

const URGENCY = (days) => {
  if (days >= 4) return { label: 'Overdue', dot: '#ef4444' };
  if (days >= 2) return { label: 'Due Soon', dot: '#eab308' };
  return { label: 'Recent', dot: '#3b82f6' };
};

export default function PendingDues() {
  const [search, setSearch] = useState('');

  const filtered = dues.filter(d =>
    d.patient.toLowerCase().includes(search.toLowerCase()) ||
    d.id.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search)
  );

  const totalDues = dues.reduce((s, d) => s + (d.total - d.paid), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pending Dues</h1>
            <p className="text-xs text-gray-500 mt-0.5">Outstanding patient payments</p>
          </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-right">
              <p className="text-xs text-blue-700 font-extrabold">Total Outstanding</p>
              <p className="text-xl font-extrabold text-blue-700">₹{totalDues.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by patient name, invoice or phone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Due Cards */}
        <div className="space-y-4">
          {filtered.map(d => {
            const balance = d.total - d.paid;
            const pct = Math.round((d.paid / d.total) * 100);
            const urgency = URGENCY(d.days);
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{d.id}</span>
                      <span className="inline-flex items-center gap-2 text-[11px] font-extrabold text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: urgency.dot }} />
                        {urgency.label}
                      </span>
                    </div>
                    <p className="font-bold text-gray-900 text-lg">{d.patient}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1"><MdPhone className="w-3 h-3" />{d.phone}</span>
                      <span className="flex items-center gap-1"><MdCalendarToday className="w-3 h-3" />Due since {d.date}</span>
                      <span className="flex items-center gap-1"><MdWarning className="w-3 h-3 text-gray-400" />{d.days} days pending</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className="text-2xl font-extrabold text-gray-900">₹{balance.toLocaleString()}</p>
                  </div>
                </div>

                {/* Payment progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>Paid: ₹{d.paid.toLocaleString()} / ₹{d.total.toLocaleString()}</span>
                    <span>{pct}% collected</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct > 0 ? '#1d4ed8' : '#e5e7eb' }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:shadow-md"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #0d6ebd)' }}>
                    <MdReceiptLong className="w-4 h-4" /> Collect Payment
                  </button>
                  <button className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
                    <MdSend className="w-4 h-4" /> Remind
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
            <MdReceiptLong className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pending dues found</p>
          </div>
        )}
      </div>
    </div>
  );
}
