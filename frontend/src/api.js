import axios from 'axios';

// Prefer localhost when the app is served from localhost to avoid stale env URLs
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const envUrl = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_API_URL : undefined;
const computedLocalUrl = `http://${hostname}:5001`;
// If on localhost/127.0.0.1, force localhost even if VITE_API_URL is set
const API_BASE = (hostname === 'localhost' || hostname === '127.0.0.1')
  ? 'http://localhost:5001/api'
  : (envUrl || `${computedLocalUrl}/api`);

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
    // optional: handle 401 globally
    if (error.response && error.response.status === 401) {
      // clear token or trigger logout flow if needed
      // localStorage.removeItem('token');
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