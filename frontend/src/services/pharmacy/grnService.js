import api from '../../utils/api';

const BASE = '/pharmacy/grn';

export async function fetchPurchaseOrdersForGrn() {
  const res = await api.get(`${BASE}/purchase-orders`);
  return res.data;
}

export async function fetchGrns(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchGrnById(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createGrn(payload) {
  const res = await api.post(BASE, payload);
  return res.data;
}

export async function updateGrn(id, payload) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function completeGrn(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/complete`);
  return res.data;
}

export async function cancelGrn(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/cancel`);
  return res.data;
}

export async function fetchGrnPrint(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}/print`);
  return res.data;
}
