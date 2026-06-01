import api from '../../utils/api';

const BASE = '/pharmacy/inventory';

export async function fetchInventorySummary() {
  const res = await api.get(`${BASE}/summary`);
  return res.data;
}

export async function fetchInventory(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchInventoryByMedicine(medicineId) {
  const res = await api.get(`${BASE}/${encodeURIComponent(medicineId)}`);
  return res.data;
}

export async function fetchLowStock() {
  const res = await api.get(`${BASE}/low-stock`);
  return res.data;
}

export async function fetchNearExpiry() {
  const res = await api.get(`${BASE}/near-expiry`);
  return res.data;
}

export async function fetchStockLedger(params = {}) {
  const res = await api.get(`${BASE}/ledger`, { params });
  return res.data;
}
