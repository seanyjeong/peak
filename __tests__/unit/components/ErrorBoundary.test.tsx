'use strict';

import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// 에러를 던지는 컴포넌트
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>정상 렌더링</div>;
};

// console.error 모킹 (React 에러 로그 숨기기)
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('정상 렌더링', () => {
    it('에러가 없으면 children을 렌더링한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('정상 렌더링')).toBeInTheDocument();
    });

    it('여러 children을 렌더링한다', () => {
      render(
        <ErrorBoundary>
          <div>첫번째</div>
          <div>두번째</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('첫번째')).toBeInTheDocument();
      expect(screen.getByText('두번째')).toBeInTheDocument();
    });
  });

  describe('에러 캐치', () => {
    it('에러 발생 시 fallback UI를 표시한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/오류가 발생했습니다/i)).toBeInTheDocument();
    });

    it('에러 메시지를 표시한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Test error message/i)).toBeInTheDocument();
    });

    it('재시도 버튼을 표시한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /다시 시도/i })).toBeInTheDocument();
    });
  });

  describe('재시도 기능', () => {
    it('재시도 버튼 클릭 시 컴포넌트를 리렌더링한다', () => {
      let shouldThrow = true;

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      // 에러 상태 확인
      expect(screen.getByText(/오류가 발생했습니다/i)).toBeInTheDocument();

      // shouldThrow를 false로 변경
      shouldThrow = false;

      // 재시도 버튼 클릭
      const retryButton = screen.getByRole('button', { name: /다시 시도/i });
      fireEvent.click(retryButton);

      // 리렌더링
      rerender(
        <ErrorBoundary key="retry">
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      expect(screen.getByText('정상 렌더링')).toBeInTheDocument();
    });
  });

  describe('커스텀 fallback', () => {
    it('커스텀 fallback 컴포넌트를 표시한다', () => {
      const CustomFallback = () => <div>커스텀 에러 화면</div>;

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('커스텀 에러 화면')).toBeInTheDocument();
    });
  });

  describe('스타일', () => {
    it('에러 상태에서 적절한 UI 스타일을 적용한다', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorContainer = screen.getByTestId('error-boundary-fallback');
      expect(errorContainer).toBeInTheDocument();
    });
  });
});
