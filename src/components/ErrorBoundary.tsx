'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // 프로덕션에서는 에러 리포팅 서비스로 전송할 수 있음
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // 커스텀 fallback이 있으면 사용
      if (fallback) {
        return fallback;
      }

      // 기본 fallback UI
      return (
        <div
          data-testid="error-boundary-fallback"
          className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-red-50 rounded-xl border border-red-200"
        >
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />

          <h2 className="text-lg font-semibold text-red-800 mb-2">
            오류가 발생했습니다
          </h2>

          <p className="text-sm text-red-600 mb-4 text-center max-w-md">
            {error?.message || '알 수 없는 오류가 발생했습니다'}
          </p>

          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>

          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="mt-4 w-full max-w-md">
              <summary className="text-xs text-red-500 cursor-pointer">
                상세 정보 (개발 모드)
              </summary>
              <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-h-32">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}
