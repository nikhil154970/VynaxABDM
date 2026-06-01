import api from '../../utils/api';

const BASE = '/pharmacy/pending-dues';

export async function fetchPendingDuesSummary() {
  const res = await api.get(`${BASE}/summary`);
  return res.data;
}

export async function fetchPendingDues(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchPatientPendingDues(patientId) {
  const res = await api.get(`${BASE}/${encodeURIComponent(patientId)}`);
  return res.data;
}

export async function fetchBillPendingDueDetails(billId) {
  const res = await api.get(`${BASE}/bill/${encodeURIComponent(billId)}`);
  return res.data;
}

export async function checkPatientPharmacyDues(patientId) {
  const res = await api.get(`${BASE}/check/${encodeURIComponent(patientId)}`);
  return res.data;
}

export async function collectPendingDuePayment(payload) {
  const res = await api.post(`${BASE}/payment`, payload);
  return res.data;
}
