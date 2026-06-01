const LAB_STORAGE_KEY = 'labOrdersDataV1';
const LAB_SYNC_EVENT = 'lab-orders-updated';

export const LAB_STATUS = {
  PENDING: 'Pending',
  COLLECTED: 'Collected',
  COMPLETED: 'Completed',
};

const initialLabOrders = [
  {
    id: 'SMP-22001',
    patientId: 'P-0001',
    patientName: 'Ravi Kumar',
    uhid: 'UH202604180123',
    phone: '9876543210',
    age: 34,
    gender: 'Male',
    doctorName: 'Dr. Sharma',
    tests: [
      { name: 'CBC', unit: 'cells/uL', range: '4.0-11.0' },
      { name: 'CRP', unit: 'mg/L', range: '0-10' },
    ],
    sampleType: 'Blood',
    date: '2026-04-28T09:18:00.000Z',
    status: LAB_STATUS.PENDING,
    collectedAt: null,
    results: [],
    overallRemarks: '',
    technicianNotes: '',
    reportGeneratedAt: null,
  },
  {
    id: 'SMP-22002',
    patientId: 'P-0002',
    patientName: 'Priya Singh',
    uhid: 'UH202604180124',
    phone: '9123456780',
    age: 28,
    gender: 'Female',
    doctorName: 'Dr. Gupta',
    tests: [
      { name: 'Urine R/M', unit: '', range: '' },
      { name: 'Urine Culture', unit: '', range: '' },
    ],
    sampleType: 'Urine',
    date: '2026-04-28T10:05:00.000Z',
    status: LAB_STATUS.PENDING,
    collectedAt: null,
    results: [],
    overallRemarks: '',
    technicianNotes: '',
    reportGeneratedAt: null,
  },
  {
    id: 'SMP-22003',
    patientId: 'P-0003',
    patientName: 'Mohan Das',
    uhid: 'UH202604170987',
    phone: '9988776655',
    age: 52,
    gender: 'Male',
    doctorName: 'Dr. Kapoor',
    tests: [
      { name: 'LFT', unit: '', range: '' },
      { name: 'KFT', unit: '', range: '' },
    ],
    sampleType: 'Blood',
    date: '2026-04-28T08:42:00.000Z',
    status: LAB_STATUS.COMPLETED,
    collectedAt: '2026-04-28T09:02:00.000Z',
    results: [
      { name: 'LFT', value: 'Normal', unit: '', range: '', remarks: 'Within range' },
      { name: 'KFT', value: 'Normal', unit: '', range: '', remarks: '' },
    ],
    overallRemarks: 'Stable profile',
    technicianNotes: '',
    reportGeneratedAt: '2026-04-28T11:12:00.000Z',
  },
];

function toArraySafe(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStatus(statusValue, fallbackResultCount = 0) {
  const raw = String(statusValue || '').trim().toLowerCase();
  if (!raw) return fallbackResultCount > 0 ? LAB_STATUS.COMPLETED : LAB_STATUS.PENDING;
  if (raw === 'pending' || raw === 'pending result') return LAB_STATUS.PENDING;
  if (raw === 'collected' || raw === 'sample collected') return LAB_STATUS.COLLECTED;
  if (raw === 'completed' || raw === 'result completed' || raw === 'result ready') return LAB_STATUS.COMPLETED;
  return fallbackResultCount > 0 ? LAB_STATUS.COMPLETED : LAB_STATUS.COLLECTED;
}

function normalizeOrder(order) {
  const safeResults = toArraySafe(order.results);
  return {
    ...order,
    status: normalizeStatus(order.status, safeResults.length),
    tests: toArraySafe(order.tests).map((t) => (typeof t === 'string' ? { name: t, unit: '', range: '' } : t)),
    results: safeResults,
  };
}

export function getLabOrders() {
  try {
    const raw = window.localStorage.getItem(LAB_STORAGE_KEY);
    if (!raw) return initialLabOrders.map(normalizeOrder);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return initialLabOrders.map(normalizeOrder);
    return parsed.map(normalizeOrder);
  } catch (error) {
    return initialLabOrders.map(normalizeOrder);
  }
}

export function saveLabOrders(nextOrders) {
  const safeOrders = toArraySafe(nextOrders).map(normalizeOrder);
  window.localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(safeOrders));
  window.dispatchEvent(new CustomEvent(LAB_SYNC_EVENT, { detail: { orders: safeOrders } }));
  return safeOrders;
}

export function subscribeLabOrders(onChange) {
  const handler = (event) => {
    const orders = event?.detail?.orders;
    if (Array.isArray(orders)) {
      onChange(orders.map(normalizeOrder));
      return;
    }
    onChange(getLabOrders());
  };
  window.addEventListener(LAB_SYNC_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(LAB_SYNC_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
