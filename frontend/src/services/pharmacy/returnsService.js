import api from '../../utils/api';

const BASE = '/pharmacy/returns';

export async function fetchReturnsSummary() {
  const res = await api.get(`${BASE}/summary`);
  return res.data;
}

export async function fetchReturns(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchReturnById(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function searchReturnBills(q) {
  const res = await api.get(`${BASE}/bills/search`, { params: { q } });
  return res.data;
}

export async function fetchExpiredBatches() {
  const res = await api.get(`${BASE}/expired-batches`);
  return res.data;
}

export async function fetchSupplierBatches(supplierId) {
  const res = await api.get(`${BASE}/supplier-batches`, { params: { supplierId } });
  return res.data;
}

export async function createCustomerReturn(payload) {
  const res = await api.post(`${BASE}/customer`, payload);
  return res.data;
}

export async function createVendorReturn(payload) {
  const res = await api.post(`${BASE}/vendor`, payload);
  return res.data;
}

export async function createExpiredReturn(payload) {
  const res = await api.post(`${BASE}/expired`, payload);
  return res.data;
}

export async function approveReturn(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/approve`);
  return res.data;
}

export async function cancelReturn(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/cancel`);
  return res.data;
}
