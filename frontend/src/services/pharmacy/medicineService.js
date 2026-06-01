import api from '../../utils/api';

const BASE = '/pharmacy/medicines';

export async function fetchMedicines(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchMedicineById(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createMedicine(payload) {
  const res = await api.post(BASE, payload);
  return res.data;
}

export async function updateMedicine(id, payload) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deactivateMedicine(id) {
  const res = await api.delete(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}
