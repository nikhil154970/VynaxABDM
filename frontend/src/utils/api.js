import axios from 'axios';
import { startRequestLoading, stopRequestLoading } from './loadingBus';

const envBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const baseURL = envBase ? `${envBase}/api` : '/api';

const api = axios.create({ baseURL });

// Attach access token to every request automatically
api.interceptors.request.use((config) => {
  startRequestLoading();
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If token is invalid/expired, force re-login
api.interceptors.response.use(
  (res) => {
    stopRequestLoading();
    return res;
  },
  async (error) => {
    stopRequestLoading();
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
