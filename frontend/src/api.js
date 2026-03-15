import axios from 'axios';

const envUrl = import.meta.env.VITE_API_URL;
// In production: use VITE_API_URL env var (e.g. https://your-backend.onrender.com)
// In development: fallback to local proxy (/api is proxied by Vite to localhost:5001)
const API_BASE = envUrl 
  ? (envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`) 
  : '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// attach token from localStorage (key: token) if present
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // ignore localStorage errors
  }
  return config;
}, (error) => Promise.reject(error));

// unwrap response to return data directly
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear invalid token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// helpers to manage token programmatically
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('token', token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    clearAuthToken();
  }
}

export function clearAuthToken() {
  localStorage.removeItem('token');
  if (api.defaults.headers.common) {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;