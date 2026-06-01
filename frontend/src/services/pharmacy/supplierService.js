import api from '../../utils/api';

const BASE = '/pharmacy/suppliers';

export async function fetchSuppliers(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchSupplierById(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createSupplier(payload) {
  const res = await api.post(BASE, payload);
  return res.data;
}

export async function updateSupplier(id, payload) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deactivateSupplier(id) {
  const res = await api.delete(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}
