import api from '../../utils/api';

const BASE = '/pharmacy/billing';

export async function fetchBillingStats() {
  const res = await api.get(`${BASE}/stats`);
  return res.data;
}

export async function fetchBills(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchBillById(id, { forEdit = false } = {}) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`, {
    params: forEdit ? { forEdit: '1' } : {},
  });
  return res.data;
}

export async function createBill(payload) {
  const res = await api.post(BASE, payload);
  return res.data;
}

export async function updateBill(id, payload) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function cancelBill(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/cancel`);
  return res.data;
}

export async function searchInventory(params = {}) {
  const res = await api.get(`${BASE}/inventory/search`, { params });
  return res.data;
}

export async function searchBillingPatients(q) {
  const res = await api.get(`${BASE}/patients/search`, { params: { q } });
  return res.data;
}

export async function fetchPatientPharmacyDues(patientId) {
  const res = await api.get(`${BASE}/patient/${encodeURIComponent(patientId)}/dues`);
  return res.data;
}

export async function fetchBillPrint(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}/print`);
  return res.data;
}
