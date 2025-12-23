/**
 * P-EAK 인앱 알림 API 클라이언트
 */

import apiClient from './client';

export interface Notification {
  id: number;
  type: 'record_missing' | 'plan_missing' | 'system';
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface Alert {
  type: 'record_missing' | 'plan_missing';
  title: string;
  message: string;
  severity: 'warning' | 'info' | 'error';
  count?: number;
  date?: string;
}

interface NotificationsResponse {
  notifications: Notification[];
}

interface CheckAlertsResponse {
  alerts: Alert[];
  hasAlerts: boolean;
}

export const notificationsAPI = {
  // 미읽은 알림 조회
  getUnread: async (): Promise<Notification[]> => {
    const response = await apiClient.get<NotificationsResponse>('/notifications');
    return response.data.notifications;
  },

  // 알림 읽음 처리
  markAsRead: async (id: number): Promise<void> => {
    await apiClient.put(`/notifications/${id}/read`);
  },

  // 모든 알림 읽음 처리
  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/notifications/read-all');
  },

  // 실시간 알림 체크 (로그인 시 팝업용)
  checkAlerts: async (): Promise<CheckAlertsResponse> => {
    const response = await apiClient.get<CheckAlertsResponse>('/notifications/check');
    return response.data;
  },
};
