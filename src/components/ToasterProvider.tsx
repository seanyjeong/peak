'use client';

import { Toaster } from 'react-hot-toast';

export function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        // 기본 스타일
        className: '',
        duration: 3000,
        style: {
          background: '#333',
          color: '#fff',
          fontSize: '14px',
          borderRadius: '10px',
          padding: '12px 16px',
        },
        // 성공 토스트
        success: {
          duration: 3000,
          style: {
            background: '#22c55e',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#22c55e',
          },
        },
        // 에러 토스트
        error: {
          duration: 4000,
          style: {
            background: '#ef4444',
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#ef4444',
          },
        },
      }}
    />
  );
}
