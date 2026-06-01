import { useState } from 'react';
import {
  MdAccessTime, MdRefresh, MdPerson, MdArrowForward,
  MdPlayArrow, MdSkipNext, MdQueueMusic
} from 'react-icons/md';

const initialQueue = [
  { token: 'T-001', name: 'Ravi Kumar', age: 34, doctor: 'Dr. Sharma', dept: 'General', time: '10:15 AM', status: 'Consulting', waited: '5 min' },
  { token: 'T-002', name: 'Priya Singh', age: 28, doctor: 'Dr. Mehta', dept: 'Gynecology', time: '10:30 AM', status: 'Waiting', waited: '20 min' },
  { token: 'T-003', name: 'Mohan Das', age: 52, doctor: 'Dr. Verma', dept: 'Cardiology', time: '10:45 AM', status: 'Waiting', waited: '10 min' },
  { token: 'T-004', name: 'Meena Tiwari', age: 61, doctor: 'Dr. Verma', dept: 'Cardiology', time: '11:00 AM', status: 'Waiting', waited: '3 min' },
  { token: 'T-005', name: 'Arjun Yadav', age: 29, doctor: 'Dr. Mehta', dept: 'Orthopedics', time: '11:15 AM', status: 'Done', waited: '—' },
  { token: 'T-006', name: 'Kavita Verma', age: 33, doctor: 'Dr. Khan', dept: 'ENT', time: '11:30 AM', status: 'Done', waited: '—' },
];

const STATUS_STYLE = {
  Consulting: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  Waiting:    { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Done:       { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
};

const deptQueues = {
  'General':    [{ token: 'T-001', name: 'Ravi Kumar', status: 'Consulting' }, { token: 'T-009', name: 'Ram Prasad', status: 'Waiting' }],
  'Gynecology': [{ token: 'T-002', name: 'Priya Singh', status: 'Waiting' }],
  'Cardiology': [{ token: 'T-003', name: 'Mohan Das', status: 'Waiting' }, { token: 'T-004', name: 'Meena Tiwari', status: 'Waiting' }],
  'Orthopedics':[{ token: 'T-005', name: 'Arjun Yadav', status: 'Done' }],
  'ENT':        [{ token: 'T-006', name: 'Kavita Verma', status: 'Done' }],
};

export default function TokenQueue() {
  const [queue] = useState(initialQueue);
  const waiting = queue.filter(q => q.status === 'Waiting').length;
  const consulting = queue.filter(q => q.status === 'Consulting').length;
  const done = queue.filter(q => q.status === 'Done').length;
  const current = queue.find(q => q.status === 'Consulting');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Token / Queue</h1>
            <p className="text-xs text-gray-500 mt-0.5">Live patient queue status</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
            <MdRefresh className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Waiting', value: waiting, bg: '#fef9c3', text: '#854d0e' },
            { label: 'Consulting', value: consulting, bg: '#dcfce7', text: '#14532d' },
            { label: 'Done Today', value: done, bg: '#f1f5f9', text: '#475569' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5 border border-gray-100 shadow-sm text-center" style={{ background: s.bg }}>
              <p className="text-3xl font-bold" style={{ color: s.text }}>{s.value}</p>
              <p className="text-xs font-semibold mt-1" style={{ color: s.text }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Current Token */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Now Consulting</p>
              {current ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <MdQueueMusic className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-4xl font-bold text-green-700 font-mono mb-1">{current.token}</p>
                  <p className="font-semibold text-gray-800">{current.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{current.doctor} · {current.dept}</p>
                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: '#22c55e' }}>
                      <MdPlayArrow className="w-4 h-4" /> Done
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: '#3b82f6' }}>
                      <MdSkipNext className="w-4 h-4" /> Next
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-400 text-sm mt-4">No active consultation</p>
              )}
            </div>

            {/* Dept queues */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">By Department</h3>
              <div className="space-y-2">
                {Object.entries(deptQueues).map(([dept, tokens]) => {
                  const waiting = tokens.filter(t => t.status === 'Waiting').length;
                  return (
                    <div key={dept} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                      <span className="text-xs font-medium text-gray-700">{dept}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{tokens.length} total</span>
                        {waiting > 0 && (
                          <span className="text-xs font-semibold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            {waiting} waiting
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Full Queue */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #1e3a8a08, #1e40af05)' }}>
              <h2 className="font-bold text-gray-800">Full Queue</h2>
              <span className="text-xs text-gray-400">{queue.length} tokens issued</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f8faff' }}>
                    {['Token', 'Patient', 'Doctor', 'Dept', 'Time', 'Waited', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {queue.map(q => {
                    const s = STATUS_STYLE[q.status];
                    return (
                      <tr key={q.token} className="hover:bg-blue-50/30 transition">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{q.token}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 text-sm">{q.name}</p>
                          <p className="text-xs text-gray-400">{q.age} yrs</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{q.doctor}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{q.dept}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MdAccessTime className="w-3 h-3" />{q.time}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{q.waited}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit"
                            style={{ background: s.bg, color: s.text }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                            {q.status}
                          </span>
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
    </div>
  );
}
