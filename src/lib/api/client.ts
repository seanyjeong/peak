/**
 * P-EAK API Client
 */

import axios, { AxiosError } from 'axios';
import {
  getErrorMessageByStatus,
  NETWORK_ERRORS,
  AUTH_ERRORS,
  DEFAULT_ERROR_MESSAGE,
} from '@/lib/constants/errors';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8330/peak';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30초 타임아웃
});

// Request interceptor - 토큰 자동 추가
apiClient.interceptors.request.use(
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

// Response interceptor - 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    // 네트워크 에러 (서버 응답 없음)
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

    // 401: 인증 만료 처리
    if (status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('peak_token');
        localStorage.removeItem('peak_user');
        window.location.href = '/login';
      }
      error.message = AUTH_ERRORS.SESSION_EXPIRED;
      return Promise.reject(error);
    }

    // 서버 응답에 메시지가 있으면 사용, 없으면 상태 코드 기반 메시지
    const serverMessage = error.response.data?.message;
    error.message = serverMessage || getErrorMessageByStatus(status);

    return Promise.reject(error);
  }
);

export default apiClient;

/**
 * API 에러에서 사용자 친화적 메시지 추출
 */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.message || DEFAULT_ERROR_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return DEFAULT_ERROR_MESSAGE;
}
