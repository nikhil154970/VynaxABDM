import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  Info,
  Minus,
  PackageX,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react';

const pendingQueueSeed = [
  {
    token: '#1024',
    patient: 'Ravi Kumar',
    uhid: 'UHID1024',
    ageGender: '32 Y / Male',
    doctor: 'Dr. Sharma',
    department: 'General Medicine',
    mobile: '9876543210',
    time: '10:30 AM',
    visitDate: '21 May 2026',
    status: 'Pending',
    medicines: [
      { id: 1, name: 'Paracetamol 650mg', type: 'Tablet', dosage: '1-0-1', prescribed: 10, available: 120, dispense: 10 },
      { id: 2, name: 'Azithromycin 500mg', type: 'Tablet', dosage: '1-0-0', prescribed: 6, available: 32, dispense: 6 },
      { id: 3, name: 'Cetirizine 10mg', type: 'Tablet', dosage: '1-0-1', prescribed: 10, available: 45, dispense: 10 },
      { id: 4, name: 'Omeprazole 20mg', type: 'Capsule', dosage: '1-0-0', prescribed: 5, available: 25, dispense: 5 },
    ],
    note: 'Take after food',
  },
  {
    token: '#1025',
    patient: 'Sita Devi',
    uhid: 'UHID1025',
    ageGender: '45 Y / Female',
    doctor: 'Dr. Verma',
    department: 'ENT',
    mobile: '9876501122',
    time: '10:45 AM',
    visitDate: '21 May 2026',
    status: 'Pending',
    medicines: [
      { id: 1, name: 'Amoxicillin 500mg', type: 'Capsule', dosage: '1-1-1', prescribed: 15, available: 62, dispense: 15 },
      { id: 2, name: 'Levocetirizine 5mg', type: 'Tablet', dosage: '0-0-1', prescribed: 5, available: 28, dispense: 5 },
      { id: 3, name: 'Pantoprazole 40mg', type: 'Tablet', dosage: '1-0-0', prescribed: 5, available: 40, dispense: 5 },
    ],
    note: 'Avoid cold drinks',
  },
  {
    token: '#1026',
    patient: 'Amit Singh',
    uhid: 'UHID1026',
    ageGender: '28 Y / Male',
    doctor: 'Dr. Mehta',
    department: 'Orthopedics',
    mobile: '9988776655',
    time: '11:00 AM',
    visitDate: '21 May 2026',
    status: 'Pending',
    medicines: [
      { id: 1, name: 'Aceclofenac 100mg', type: 'Tablet', dosage: '1-0-1', prescribed: 10, available: 38, dispense: 10 },
      { id: 2, name: 'Calcium D3', type: 'Tablet', dosage: '0-1-0', prescribed: 15, available: 80, dispense: 15 },
      { id: 3, name: 'Rabeprazole 20mg', type: 'Tablet', dosage: '1-0-0', prescribed: 5, available: 31, dispense: 5 },
      { id: 4, name: 'Diclofenac Gel', type: 'Tube', dosage: 'Local', prescribed: 1, available: 12, dispense: 1 },
      { id: 5, name: 'Vitamin B Complex', type: 'Tablet', dosage: '0-1-0', prescribed: 10, available: 44, dispense: 10 },
    ],
    note: 'Apply gel twice daily',
  },
  {
    token: '#1027',
    patient: 'Pooja Patel',
    uhid: 'UHID1027',
    ageGender: '36 Y / Female',
    doctor: 'Dr. Sharma',
    department: 'General Medicine',
    mobile: '9911223344',
    time: '11:15 AM',
    visitDate: '21 May 2026',
    status: 'Pending',
    medicines: [
      { id: 1, name: 'Metformin 500mg', type: 'Tablet', dosage: '1-0-1', prescribed: 20, available: 90, dispense: 20 },
      { id: 2, name: 'Glimepiride 1mg', type: 'Tablet', dosage: '1-0-0', prescribed: 10, available: 18, dispense: 10 },
    ],
    note: 'Monitor sugar level',
  },
  {
    token: '#1028',
    patient: 'Vikram Jaiswal',
    uhid: 'UHID1028',
    ageGender: '51 Y / Male',
    doctor: 'Dr. Verma',
    department: 'Cardiology',
    mobile: '9090909090',
    time: '11:25 AM',
    visitDate: '21 May 2026',
    status: 'Pending',
    medicines: [
      { id: 1, name: 'Amlodipine 5mg', type: 'Tablet', dosage: '1-0-0', prescribed: 10, available: 52, dispense: 10 },
      { id: 2, name: 'Atorvastatin 10mg', type: 'Tablet', dosage: '0-0-1', prescribed: 10, available: 47, dispense: 10 },
      { id: 3, name: 'Aspirin 75mg', type: 'Tablet', dosage: '0-1-0', prescribed: 10, available: 68, dispense: 10 },
    ],
    note: 'Do not skip night dose',
  },
  {
    token: '#1029',
    patient: 'Neha Verma',
    uhid: 'UHID1029',
    ageGender: '24 Y / Female',
    doctor: 'Dr. Iyer',
    department: 'Dermatology',
    mobile: '9000012345',
    time: '11:35 AM',
    visitDate: '21 May 2026',
    status: 'Pending',
    medicines: [
      { id: 1, name: 'Fluconazole 150mg', type: 'Tablet', dosage: 'Weekly', prescribed: 2, available: 20, dispense: 2 },
      { id: 2, name: 'Clotrimazole Cream', type: 'Tube', dosage: 'Local', prescribed: 1, available: 14, dispense: 1 },
      { id: 3, name: 'Loratadine 10mg', type: 'Tablet', dosage: '0-0-1', prescribed: 5, available: 26, dispense: 5 },
      { id: 4, name: 'Calamine Lotion', type: 'Bottle', dosage: 'Local', prescribed: 1, available: 9, dispense: 1 },
    ],
    note: 'External application only where advised',
  },
  {
    token: '#1030',
    patient: 'Mohit Sharma',
    uhid: 'UHID1030',
    ageGender: '40 Y / Male',
    doctor: 'Dr. Khan',
    department: 'Pulmonology',
    mobile: '9888899990',
    time: '11:45 AM',
    visitDate: '21 May 2026',
    status: 'Pending',
    medicines: [
      { id: 1, name: 'Montelukast 10mg', type: 'Tablet', dosage: '0-0-1', prescribed: 10, available: 36, dispense: 10 },
      { id: 2, name: 'Salbutamol Inhaler', type: 'Inhaler', dosage: 'SOS', prescribed: 1, available: 7, dispense: 1 },
    ],
    note: 'Demonstrate inhaler use',
  },
];

const recentDispensedSeed = [
  { token: '#1023', patient: 'Sita Devi', doctor: 'Dr. Verma', total: 3, amount: 'Rs.1,250.00', status: 'Dispensed', by: 'Pharmacist', time: '10:28 AM' },
  { token: '#1022', patient: 'Amit Singh', doctor: 'Dr. Mehta', total: 5, amount: 'Rs.320.00', status: 'Dispensed', by: 'Pharmacist', time: '10:15 AM' },
  { token: '#1021', patient: 'Pooja Patel', doctor: 'Dr. Sharma', total: 2, amount: 'Rs.1,980.00', status: 'Dispensed', by: 'Pharmacist', time: '09:50 AM' },
  { token: '#1020', patient: 'Vikram Jaiswal', doctor: 'Dr. Verma', total: 3, amount: 'Rs.450.00', status: 'Dispensed', by: 'Pharmacist', time: '09:30 AM' },
];

function Modal({ open, title, children, footer, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-3 py-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </section>
    </div>
  );
}

function PillBadge({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900">{value}</p>
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function moneyFromPrescription(prescription) {
  return prescription.medicines.reduce((sum, item) => sum + item.dispense * (item.id % 2 ? 38 : 52), 0);
}

export default function PharmacyDispensing() {
  const [queue, setQueue] = useState(pendingQueueSeed);
  const [activeToken, setActiveToken] = useState(pendingQueueSeed[0].token);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('pending');
  const [filterOpen, setFilterOpen] = useState(false);
  const [confirmBillOpen, setConfirmBillOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const [viewBill, setViewBill] = useState(null);
  const [toast, setToast] = useState('');
  const [recentDispensed, setRecentDispensed] = useState(recentDispensedSeed);

  const filteredQueue = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return queue;
    return queue.filter((item) => (
      item.token.toLowerCase().includes(term)
      || item.patient.toLowerCase().includes(term)
      || item.uhid.toLowerCase().includes(term)
    ));
  }, [queue, search]);

  const activePrescription = queue.find((item) => item.token === activeToken) || queue[0];
  const summary = useMemo(() => {
    if (!activePrescription) return { medicines: 0, qty: 0, available: 0, amount: 0 };
    return {
      medicines: activePrescription.medicines.length,
      qty: activePrescription.medicines.reduce((sum, item) => sum + item.dispense, 0),
      available: activePrescription.medicines.reduce((sum, item) => sum + item.available, 0),
      amount: moneyFromPrescription(activePrescription),
    };
  }, [activePrescription]);

  const updateDispenseQty = (medicineId, direction) => {
    setQueue((items) => items.map((prescription) => {
      if (prescription.token !== activePrescription.token) return prescription;
      return {
        ...prescription,
        medicines: prescription.medicines.map((medicine) => {
          if (medicine.id !== medicineId) return medicine;
          const next = direction === 'up' ? medicine.dispense + 1 : medicine.dispense - 1;
          return { ...medicine, dispense: Math.max(0, Math.min(medicine.prescribed, medicine.available, next)) };
        }),
      };
    }));
  };

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const handleGenerateBill = () => {
    const amount = `Rs.${summary.amount.toLocaleString('en-IN')}.00`;
    setRecentDispensed((rows) => [
      {
        token: activePrescription.token,
        patient: activePrescription.patient,
        doctor: activePrescription.doctor,
        total: summary.medicines,
        amount,
        status: 'Dispensed',
        by: 'Pharmacist',
        time: 'Now',
      },
      ...rows,
    ]);
    setQueue((items) => {
      const next = items.filter((item) => item.token !== activePrescription.token);
      setActiveToken(next[0]?.token || '');
      return next;
    });
    setConfirmBillOpen(false);
    setTab('dispensed');
    showToast(`Bill generated for ${activePrescription.token}`);
  };

  const handleHold = () => {
    setQueue((items) => items.map((item) => (item.token === activePrescription.token ? { ...item, status: 'Hold' } : item)));
    setHoldOpen(false);
    showToast(`${activePrescription.token} moved to hold`);
  };

  const handleUnavailable = () => {
    setQueue((items) => items.map((item) => (item.token === activePrescription.token ? { ...item, status: 'Unavailable' } : item)));
    setUnavailableOpen(false);
    showToast(`${activePrescription.token} marked unavailable`);
  };

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 pb-3 pt-0 text-slate-900 sm:px-4 lg:px-3">
      {toast && (
        <div className="fixed right-4 top-4 z-[80] rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-2 flex flex-col gap-2 border-b border-slate-200 sm:flex-row sm:items-center">
        {[
          { id: 'pending', label: 'Pending Prescriptions' },
          { id: 'today', label: 'Dispensed (Today)' },
          { id: 'dispensed', label: 'Completed Dispensing' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border-b-2 px-5 py-3 text-left text-xs font-bold transition first:pl-5 ${
              tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-700 hover:text-blue-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <label className="relative max-w-full flex-1 lg:max-w-[430px]">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="text"
              placeholder="Search by Token No. / Patient Name / UHID"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-9 text-xs outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>
          <button type="button" className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-600 shadow-sm transition hover:bg-slate-50" aria-label="Scan token">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setFilterOpen(true)} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </button>
        </div>
        <button type="button" onClick={() => showToast('Queue refreshed')} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700">
          <RefreshCcw className="h-3.5 w-3.5" />
          Refresh Queue
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[270px_minmax(0,1fr)_290px]">
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-950">Pending Queue</h2>
            <PillBadge>18</PillBadge>
          </div>
          <div className="space-y-1.5">
            {filteredQueue.map((item) => (
              <button
                key={item.token}
                type="button"
                onClick={() => setActiveToken(item.token)}
                className={`grid w-full grid-cols-[48px_minmax(0,1fr)_46px_14px] items-center gap-2 rounded-md border px-3 py-2.5 text-left transition ${
                  activePrescription?.token === item.token
                    ? 'border-blue-300 bg-blue-50/60 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-black text-blue-700">{item.token}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-950">{item.patient}</span>
                  <span className="block text-xs text-slate-500">{item.time}</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs font-black text-slate-950">{item.medicines.length}</span>
                  <span className="block text-[11px] text-slate-500">Medicines</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => showToast('No more demo tokens')} className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-blue-200 bg-white text-xs font-bold text-blue-700 transition hover:bg-blue-50">
            Load More
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </section>

        <main className="min-w-0 space-y-3">
          {activePrescription ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-blue-700">Token {activePrescription.token.replace('#', '#')}</h2>
                <PillBadge tone={activePrescription.status === 'Pending' ? 'amber' : activePrescription.status === 'Hold' ? 'slate' : 'red'}>{activePrescription.status}</PillBadge>
              </div>

              <div className="grid grid-cols-1 gap-2 rounded-md border border-slate-100 p-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <InfoTile icon={UserRound} label="Name" value={activePrescription.patient} />
                <InfoTile icon={ClipboardList} label="UHID" value={activePrescription.uhid} />
                <InfoTile icon={Stethoscope} label="Doctor" value={activePrescription.doctor} />
                <InfoTile icon={Smartphone} label="Mobile" value={activePrescription.mobile} />
              </div>

              <h3 className="mt-3 text-sm font-black text-slate-950">Prescription Details</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[580px] border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-600">
                      {['Medicine Name', 'Dosage', 'Qty Prescribed', 'Available', 'Qty to Dispense'].map((head) => (
                        <th key={head} className="border-b border-slate-100 bg-slate-50 px-2 py-2.5 first:rounded-l-md last:rounded-r-md">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activePrescription.medicines.map((medicine) => (
                      <tr key={medicine.id}>
                        <td className="border-b border-slate-100 px-2 py-2.5">
                          <p className="font-semibold text-slate-900">{medicine.name}</p>
                          <p className="text-xs text-slate-500">{medicine.type}</p>
                        </td>
                        <td className="border-b border-slate-100 px-2 py-2.5 text-slate-700">{medicine.dosage}</td>
                        <td className="border-b border-slate-100 px-2 py-2.5 text-slate-700">{medicine.prescribed}</td>
                        <td className="border-b border-slate-100 px-2 py-2.5 text-slate-700">{medicine.available}</td>
                        <td className="border-b border-slate-100 px-2 py-2.5">
                          <div className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white">
                            <button type="button" onClick={() => updateDispenseQty(medicine.id, 'down')} className="px-2 text-slate-500 transition hover:text-blue-700" aria-label={`Decrease ${medicine.name}`}>
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-8 text-center text-xs font-bold text-slate-900">{medicine.dispense}</span>
                            <button type="button" onClick={() => updateDispenseQty(medicine.id, 'up')} className="px-2 text-slate-500 transition hover:text-blue-700" aria-label={`Increase ${medicine.name}`}>
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-md bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">Notes from Doctor</p>
                <p className="mt-1 text-xs text-slate-600">- {activePrescription.note}</p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[155px_1fr_155px]">
                <button type="button" onClick={() => setUnavailableOpen(true)} className="h-9 rounded-md border border-red-100 bg-white px-3 text-xs font-bold text-red-600 transition hover:bg-red-50">Mark as Unavailable</button>
                <button type="button" onClick={() => setHoldOpen(true)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:justify-self-end sm:px-9">Hold</button>
                <button type="button" onClick={() => setConfirmBillOpen(true)} className="h-9 rounded-md bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700">Generate Bill</button>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-2 text-lg font-black text-slate-950">Queue completed</h2>
              <p className="text-sm text-slate-500">All demo prescriptions have been processed.</p>
            </section>
          )}

        </main>

        <aside className="space-y-3">
          <section className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
            <h2 className="text-sm font-black text-slate-950">Patient Information</h2>
            {activePrescription ? (
              <div className="mt-3 space-y-3 text-xs">
                {[
                  ['Patient Name', activePrescription.patient],
                  ['UHID', activePrescription.uhid],
                  ['Age / Gender', activePrescription.ageGender],
                  ['Doctor', activePrescription.doctor],
                  ['Department', activePrescription.department],
                  ['Visit Date', activePrescription.visitDate],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className="text-slate-600">{label}</span>
                    <strong className="text-right font-bold text-slate-950">{value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No active prescription selected.</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
            <h2 className="text-sm font-black text-slate-950">Dispensing Summary</h2>
            <div className="mt-3 space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-600">Total Medicines</span><strong>{summary.medicines}</strong></div>
              <div className="flex justify-between"><span className="text-slate-600">Total Qty</span><strong>{summary.qty}</strong></div>
              <div className="flex justify-between"><span className="text-slate-600">Available Qty</span><strong>{summary.available}</strong></div>
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-3"><span className="font-semibold text-slate-700">Estimated Bill</span><strong>Rs.{summary.amount.toLocaleString('en-IN')}.00</strong></div>
            </div>
          </section>

          <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p>Please verify all medicines and quantities before generating the bill.</p>
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:col-span-2 xl:col-start-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-950">Recently Dispensed</h2>
            <button type="button" className="text-xs font-bold text-blue-700 hover:text-blue-800">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="text-left font-bold text-slate-600">
                  {['Token No.', 'Patient Name', 'Doctor', 'Total Medicines', 'Amount', 'Status', 'Dispensed By', 'Time', 'Action'].map((head) => (
                    <th key={head} className="border-b border-slate-100 bg-slate-50 px-3 py-2.5 first:rounded-l-lg last:rounded-r-lg">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDispensed.map((row) => (
                  <tr key={`${row.token}-${row.time}`}>
                    <td className="border-b border-slate-100 px-3 py-2.5 font-bold text-blue-700">{row.token}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">{row.patient}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">{row.doctor}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">{row.total}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-900">{row.amount}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5"><PillBadge tone="green">{row.status}</PillBadge></td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">{row.by}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">{row.time}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      <button type="button" onClick={() => setViewBill(row)} className="rounded-md border border-blue-200 px-3 py-1.5 font-bold text-blue-700 transition hover:bg-blue-50">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={filterOpen}
        title="Filter Prescriptions"
        onClose={() => setFilterOpen(false)}
        footer={(
          <>
            <button type="button" onClick={() => setFilterOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Cancel</button>
            <button type="button" onClick={() => { setFilterOpen(false); showToast('Filters applied'); }} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">Apply Filter</button>
          </>
        )}
      >
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Doctor
            <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-300">
              <option>All Doctors</option>
              <option>Dr. Sharma</option>
              <option>Dr. Verma</option>
              <option>Dr. Mehta</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Department
            <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-300">
              <option>All Departments</option>
              <option>General Medicine</option>
              <option>Orthopedics</option>
              <option>Cardiology</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Queue Status
            <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-300">
              <option>Pending</option>
              <option>Hold</option>
              <option>Unavailable</option>
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        open={confirmBillOpen}
        title="Generate Bill"
        onClose={() => setConfirmBillOpen(false)}
        footer={(
          <>
            <button type="button" onClick={() => setConfirmBillOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Review Again</button>
            <button type="button" onClick={handleGenerateBill} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">Generate Bill</button>
          </>
        )}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 text-blue-900">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <p className="font-semibold">Confirm dispensing for {activePrescription?.patient}. This will move the token to recently dispensed.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-100 p-3"><p className="text-slate-500">Token</p><strong>{activePrescription?.token}</strong></div>
            <div className="rounded-lg border border-slate-100 p-3"><p className="text-slate-500">Amount</p><strong>Rs.{summary.amount.toLocaleString('en-IN')}.00</strong></div>
          </div>
        </div>
      </Modal>

      <Modal
        open={holdOpen}
        title="Hold Prescription"
        onClose={() => setHoldOpen(false)}
        footer={(
          <>
            <button type="button" onClick={() => setHoldOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Cancel</button>
            <button type="button" onClick={handleHold} className="h-9 rounded-lg bg-slate-800 px-4 text-sm font-bold text-white">Put On Hold</button>
          </>
        )}
      >
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Hold reason
          <textarea rows={4} className="resize-none rounded-lg border border-slate-200 p-3 text-sm font-medium outline-none focus:border-blue-300" defaultValue="Patient will collect after payment confirmation." />
        </label>
      </Modal>

      <Modal
        open={unavailableOpen}
        title="Mark Unavailable"
        onClose={() => setUnavailableOpen(false)}
        footer={(
          <>
            <button type="button" onClick={() => setUnavailableOpen(false)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Cancel</button>
            <button type="button" onClick={handleUnavailable} className="h-9 rounded-lg bg-red-600 px-4 text-sm font-bold text-white">Mark Unavailable</button>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">
            <PackageX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <p>This keeps the token in queue and marks it for medicine availability follow-up.</p>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Reason
            <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-red-300">
              <option>One or more medicines unavailable</option>
              <option>Batch stock mismatch</option>
              <option>Prescription clarification needed</option>
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewBill)}
        title="Dispensed Details"
        onClose={() => setViewBill(null)}
        footer={<button type="button" onClick={() => setViewBill(null)} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">Done</button>}
      >
        {viewBill && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-100 p-3"><p className="text-slate-500">Token No.</p><strong>{viewBill.token}</strong></div>
              <div className="rounded-lg border border-slate-100 p-3"><p className="text-slate-500">Amount</p><strong>{viewBill.amount}</strong></div>
              <div className="rounded-lg border border-slate-100 p-3"><p className="text-slate-500">Patient</p><strong>{viewBill.patient}</strong></div>
              <div className="rounded-lg border border-slate-100 p-3"><p className="text-slate-500">Doctor</p><strong>{viewBill.doctor}</strong></div>
            </div>
            <div className="flex gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 font-semibold text-emerald-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>Frontend demo record only. Backend billing API is not connected.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
