import axios from 'axios';
import { startRequestLoading, stopRequestLoading } from './loadingBus';
import { notifyStaffSessionExpired } from './authSession';

const envBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const baseURL = envBase ? `${envBase}/api` : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  if (!config.silent) startRequestLoading();
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (!res.config?.silent) stopRequestLoading();
    return res;
  },
  async (error) => {
    if (!error.config?.silent) stopRequestLoading();
    const status = error.response?.status;
    const requestUrl = String(error.config?.url || '');
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (status === 401 && !isLoginRequest && localStorage.getItem('accessToken')) {
      notifyStaffSessionExpired();
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  if (typeof data === 'string') {
    if (data.includes('Cannot POST') || data.includes('Cannot GET')) {
      return 'Backend API not found. Restart the backend server and try again.';
    }
    return data.slice(0, 200);
  }
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.message) return data.errors[0].message;
  if (err?.response?.status === 404) return 'API endpoint not found. Please restart the backend server.';
  return fallback;
}

export default api;
