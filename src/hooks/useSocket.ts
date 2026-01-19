/**
 * Socket.io 실시간 연결 훅
 * 반배치 등 실시간 동기화가 필요한 페이지에서 사용
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// 프로덕션/개발 환경에 따른 Socket URL 설정
const getSocketUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:8330';

  // 개발: localhost만 로컬 서버 사용
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8330';
  }

  // 그 외 모든 환경(Vercel 등): 프로덕션 백엔드 사용
  return 'https://chejump.com';
};

const SOCKET_URL = getSocketUrl();

interface UseSocketOptions {
  onAssignmentsUpdated?: (data: {
    date: string;
    time_slot: string;
    action: string;
    class_num?: number;
  }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('peak_token');
    if (!token) {
      console.warn('[Socket] No token found, skipping connection');
      return;
    }

    // 이미 연결되어 있으면 스킵
    if (socketRef.current?.connected) {
      return;
    }

    // 기존 소켓 정리
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log('[Socket] Connecting to', SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      reconnectAttempts.current = 0;

      // 학원 room 참가
      socket.emit('join-academy', token);
    });

    socket.on('joined', (data) => {
      console.log('[Socket] Joined academy room:', data.academyId);
    });

    socket.on('assignments-updated', (data) => {
      console.log('[Socket] Assignments updated:', data);
      options.onAssignmentsUpdated?.(data);
    });

    socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      reconnectAttempts.current++;

      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.warn('[Socket] Max reconnect attempts reached, stopping');
        socket.disconnect();
      }
    });

    socketRef.current = socket;
  }, [options.onAssignmentsUpdated]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[Socket] Disconnecting');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    connect,
    disconnect,
  };
}
