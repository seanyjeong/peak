'use strict';

import { renderHook, act } from '@testing-library/react';
import { useToast } from '@/hooks/useToast';
import toast from 'react-hot-toast';

// react-hot-toast 모킹
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
    promise: jest.fn(),
  }),
}));

describe('useToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success', () => {
    it('성공 메시지를 표시한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success('저장되었습니다');
      });

      expect(toast.success).toHaveBeenCalledWith('저장되었습니다', expect.any(Object));
    });

    it('커스텀 옵션을 전달한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success('저장되었습니다', { duration: 5000 });
      });

      expect(toast.success).toHaveBeenCalledWith(
        '저장되었습니다',
        expect.objectContaining({ duration: 5000 })
      );
    });
  });

  describe('error', () => {
    it('에러 메시지를 표시한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.error('저장에 실패했습니다');
      });

      expect(toast.error).toHaveBeenCalledWith('저장에 실패했습니다', expect.any(Object));
    });

    it('Error 객체에서 메시지를 추출한다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.error(new Error('네트워크 오류'));
      });

      expect(toast.error).toHaveBeenCalledWith('네트워크 오류', expect.any(Object));
    });

    it('API 에러 응답에서 메시지를 추출한다', () => {
      const { result } = renderHook(() => useToast());
      const apiError = {
        response: {
          data: {
            message: '인증이 만료되었습니다',
          },
        },
      };

      act(() => {
        result.current.error(apiError);
      });

      expect(toast.error).toHaveBeenCalledWith('인증이 만료되었습니다', expect.any(Object));
    });
  });

  describe('loading', () => {
    it('로딩 토스트를 표시하고 ID를 반환한다', () => {
      (toast.loading as jest.Mock).mockReturnValue('toast-id-123');
      const { result } = renderHook(() => useToast());

      let toastId: string | undefined;
      act(() => {
        toastId = result.current.loading('저장 중...');
      });

      expect(toast.loading).toHaveBeenCalledWith('저장 중...', expect.any(Object));
      expect(toastId).toBe('toast-id-123');
    });
  });

  describe('dismiss', () => {
    it('특정 토스트를 닫는다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.dismiss('toast-id-123');
      });

      expect(toast.dismiss).toHaveBeenCalledWith('toast-id-123');
    });

    it('모든 토스트를 닫는다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.dismiss();
      });

      expect(toast.dismiss).toHaveBeenCalledWith(undefined);
    });
  });

  describe('promise', () => {
    it('프로미스 상태에 따라 토스트를 표시한다', async () => {
      (toast.promise as jest.Mock).mockResolvedValue({ data: 'success' });
      const { result } = renderHook(() => useToast());

      const promise = Promise.resolve({ data: 'success' });

      await act(async () => {
        await result.current.promise(promise, {
          loading: '저장 중...',
          success: '저장 완료!',
          error: '저장 실패',
        });
      });

      expect(toast.promise).toHaveBeenCalledWith(
        promise,
        {
          loading: '저장 중...',
          success: '저장 완료!',
          error: '저장 실패',
        },
        expect.any(Object)
      );
    });
  });

  describe('기본 스타일', () => {
    it('기본 스타일 옵션이 적용된다', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success('테스트');
      });

      expect(toast.success).toHaveBeenCalledWith(
        '테스트',
        expect.objectContaining({
          style: expect.objectContaining({
            borderRadius: '10px',
          }),
        })
      );
    });
  });
});
