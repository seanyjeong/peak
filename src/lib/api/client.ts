/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * P-EAK API Client (with failover)
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import {
  getErrorMessageByStatus,
  NETWORK_ERRORS,
  AUTH_ERRORS,
  DEFAULT_ERROR_MESSAGE,
} from '@/lib/constants/errors';

const PRIMARY_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/peak';
const FALLBACK_URL = process.env.NEXT_PUBLIC_FALLBACK_API_URL || 'https://supermax.kr/peak';

function isNetworkError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error;
  }

  return !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
}

function redirectToLogin(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
    return;
  }

  if (window.location.pathname === '/login') {
    return;
  }

  window.location.href = '/login';
}

function createInstance(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('peak_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string }>) => {
      if (!error.response) {
        if (error.code === 'ECONNABORTED') {
          error.message = NETWORK_ERRORS.TIMEOUT;
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          error.message = NETWORK_ERRORS.OFFLINE;
        } else {
          error.message = NETWORK_ERRORS.CONNECTION_FAILED;
        }
        return Promise.reject(error);
      }

      const status = error.response.status;

      if (status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('peak_token');
          localStorage.removeItem('peak_user');
          redirectToLogin();
        }
        error.message = AUTH_ERRORS.SESSION_EXPIRED;
        return Promise.reject(error);
      }

      const serverMessage = error.response.data?.message;
      error.message = serverMessage || getErrorMessageByStatus(status);

      return Promise.reject(error);
    }
  );

  return instance;
}

const primary = createInstance(PRIMARY_URL);
const fallback = createInstance(FALLBACK_URL);

let usingFallback = false;
let lastPrimaryCheck = 0;

function getClient(): AxiosInstance {
  if (usingFallback && Date.now() - lastPrimaryCheck > 300000) {
    usingFallback = false;
  }
  return usingFallback ? fallback : primary;
}

function switchToFallback(): void {
  usingFallback = true;
  lastPrimaryCheck = Date.now();
  console.warn('[P-EAK] Primary down, switching to fallback:', FALLBACK_URL);
}

// Proxy object that wraps axios methods with failover
const apiClient = {
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await getClient().get<T>(url, config);
    } catch (error: unknown) {
      if (!usingFallback && isNetworkError(error)) {
        switchToFallback();
        return await fallback.get<T>(url, config);
      }
      throw error;
    }
  },
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await getClient().post<T>(url, data, config);
    } catch (error: unknown) {
      if (!usingFallback && isNetworkError(error)) {
        switchToFallback();
        return await fallback.post<T>(url, data, config);
      }
      throw error;
    }
  },
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await getClient().put<T>(url, data, config);
    } catch (error: unknown) {
      if (!usingFallback && isNetworkError(error)) {
        switchToFallback();
        return await fallback.put<T>(url, data, config);
      }
      throw error;
    }
  },
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await getClient().delete<T>(url, config);
    } catch (error: unknown) {
      if (!usingFallback && isNetworkError(error)) {
        switchToFallback();
        return await fallback.delete<T>(url, config);
      }
      throw error;
    }
  },
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await getClient().patch<T>(url, data, config);
    } catch (error: unknown) {
      if (!usingFallback && isNetworkError(error)) {
        switchToFallback();
        return await fallback.patch<T>(url, data, config);
      }
      throw error;
    }
  },
  interceptors: primary.interceptors,
};

export default apiClient;

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.message || DEFAULT_ERROR_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return DEFAULT_ERROR_MESSAGE;
}
