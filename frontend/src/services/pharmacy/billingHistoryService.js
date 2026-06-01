import api from '../../utils/api';

const BASE = '/pharmacy/billing-history';

export async function fetchBillingHistorySummary(params = {}) {
  const res = await api.get(`${BASE}/summary`, { params });
  return res.data;
}

export async function fetchBillingHistory(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchBillHistoryDetails(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function fetchPatientBillingHistory(patientId) {
  const res = await api.get(`${BASE}/patient/${encodeURIComponent(patientId)}`);
  return res.data;
}

export async function cancelBillingHistoryBill(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/cancel`);
  return res.data;
}
