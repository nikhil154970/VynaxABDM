import api from '../../utils/api';

const BASE = '/pharmacy/queue';

export async function fetchQueueSummary(params = {}) {
  const res = await api.get(`${BASE}/summary`, { params });
  return res.data;
}

export async function fetchQueue(params = {}) {
  const res = await api.get(BASE, { params });
  return res.data;
}

export async function fetchQueueById(id) {
  const res = await api.get(`${BASE}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function markQueueInProgress(id) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/in-progress`);
  return res.data;
}

export async function markQueueBilled(id, { billId } = {}) {
  const res = await api.put(`${BASE}/${encodeURIComponent(id)}/billed`, { billId });
  return res.data;
}

