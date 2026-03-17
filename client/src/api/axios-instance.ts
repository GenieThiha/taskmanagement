import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../modules/auth/auth-store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/v1';

// Refuse to run in a production build without an explicit HTTPS API URL.
// A missing variable here would silently send credentials over plain HTTP.
if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
  throw new Error('[TMA] VITE_API_BASE_URL is not set. Production builds require an explicit HTTPS API URL.');
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Custom header prevents simple cross-origin CSRF requests (browsers block
    // non-standard headers without a CORS preflight that would fail here).
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
});

// Request interceptor: attach Bearer token from in-memory store
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: AxiosRequestConfig;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        config.headers = { Authorization: `Bearer ${token}` };
      }
      resolve(apiClient(config));
    }
  });
  failedQueue = [];
}

// Sanitise error details before they surface to the UI.
// 5xx responses may contain internal stack traces; always replace with a generic message.
function sanitiseError(error: unknown): unknown {
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    if (status >= 500) {
      error.response.data = { detail: 'A server error occurred. Please try again later.' };
    }
  }
  return error;
}

// Response interceptor: 401 → refresh token (httpOnly cookie) → retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The httpOnly refresh token cookie is sent automatically via withCredentials.
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } }
        );

        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        processQueue(null, newToken);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        } else {
          originalRequest.headers = { Authorization: `Bearer ${newToken}` };
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(sanitiseError(refreshError));
      }
    }

    return Promise.reject(sanitiseError(error));
  }
);
