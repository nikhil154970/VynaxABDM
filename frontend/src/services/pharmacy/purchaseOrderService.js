import api from '../../utils/api';

const BASE = '/pharmacy/purchase-orders';

export async function fetchPurchaseOrders(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchPurchaseOrderById(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function fetchPurchaseOrderPrint(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}/print`);
  return res.data;
}

export async function createPurchaseOrder(payload) {
  const res = await api.post(BASE, payload);
  return res.data;
}

export async function updatePurchaseOrder(id, payload) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function approvePurchaseOrder(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/approve`);
  return res.data;
}

export async function cancelPurchaseOrder(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/cancel`);
  return res.data;
}

export async function deletePurchaseOrder(id) {
  const res = await api.delete(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}
