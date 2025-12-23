'use client';

import toast, { ToastOptions } from 'react-hot-toast';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface PromiseMessages<T> {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((err: ApiError) => string);
}

const defaultStyle: React.CSSProperties = {
  borderRadius: '10px',
  background: '#333',
  color: '#fff',
  fontSize: '14px',
};

const successStyle: React.CSSProperties = {
  ...defaultStyle,
  background: '#22c55e',
};

const errorStyle: React.CSSProperties = {
  ...defaultStyle,
  background: '#ef4444',
};

function extractErrorMessage(error: unknown): string {
  // Error 객체
  if (error instanceof Error) {
    return error.message;
  }

  // API 에러 응답
  if (typeof error === 'object' && error !== null) {
    const apiError = error as ApiError;
    if (apiError.response?.data?.message) {
      return apiError.response.data.message;
    }
    if (apiError.message) {
      return apiError.message;
    }
  }

  // 문자열
  if (typeof error === 'string') {
    return error;
  }

  return '알 수 없는 오류가 발생했습니다';
}

export function useToast() {
  const success = (message: string, options?: ToastOptions) => {
    return toast.success(message, {
      duration: 3000,
      style: successStyle,
      ...options,
    });
  };

  const error = (messageOrError: string | Error | ApiError | unknown, options?: ToastOptions) => {
    const message = typeof messageOrError === 'string'
      ? messageOrError
      : extractErrorMessage(messageOrError);

    return toast.error(message, {
      duration: 4000,
      style: errorStyle,
      ...options,
    });
  };

  const loading = (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      style: defaultStyle,
      ...options,
    });
  };

  const dismiss = (toastId?: string) => {
    toast.dismiss(toastId);
  };

  const promise = <T,>(
    promiseValue: Promise<T>,
    messages: PromiseMessages<T>,
    options?: ToastOptions
  ) => {
    return toast.promise(
      promiseValue,
      messages,
      {
        style: defaultStyle,
        ...options,
      }
    );
  };

  const info = (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 3000,
      style: defaultStyle,
      icon: 'ℹ️',
      ...options,
    });
  };

  const warning = (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 3500,
      style: {
        ...defaultStyle,
        background: '#f59e0b',
      },
      icon: '⚠️',
      ...options,
    });
  };

  return {
    success,
    error,
    loading,
    dismiss,
    promise,
    info,
    warning,
  };
}
