/**
 * P-EAK Auth API
 */

import apiClient from './client';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  academyId: number;
  position: string;
  instructorId?: number;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export const authAPI = {
  /**
   * P-ACA 계정으로 로그인
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post('/auth/login', { email, password });

    if (data.success && data.token) {
      localStorage.setItem('peak_token', data.token);
      localStorage.setItem('peak_user', JSON.stringify(data.user));
    }

    return data;
  },

  /**
   * 로그아웃
   */
  logout(): void {
    localStorage.removeItem('peak_token');
    localStorage.removeItem('peak_user');
    window.location.href = '/login';
  },

  /**
   * 현재 사용자 정보
   */
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;

    const userStr = localStorage.getItem('peak_user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * 토큰 가져오기
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('peak_token');
  },

  /**
   * 로그인 여부 확인
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('peak_token');
  },

  /**
   * 토큰 검증
   */
  async verifyToken(): Promise<User | null> {
    try {
      const { data } = await apiClient.get('/auth/me');
      return data.user;
    } catch {
      return null;
    }
  }
};
