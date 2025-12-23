/**
 * API Client Tests
 *
 * Tests for the P-EAK API client including:
 * - Base configuration
 * - Request interceptors (token handling)
 * - Response interceptors (error handling)
 * - Error message handling
 */

import axios from 'axios';

// Mock axios before importing the client
jest.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
    isAxiosError: jest.fn((error) => !!error.isAxiosError),
    ...mockAxiosInstance,
  };
});

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  value: true,
  writable: true,
});

describe('API Client', () => {
  let requestInterceptor: (config: any) => any;
  let responseInterceptor: (response: any) => any;
  let responseErrorHandler: (error: any) => any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-import to get fresh instance
    jest.isolateModules(() => {
      require('@/lib/api/client');
    });

    const mockCreate = axios.create as jest.Mock;
    const mockInstance = mockCreate.mock.results[0]?.value;

    if (mockInstance) {
      // Capture interceptors
      const requestUse = mockInstance.interceptors.request.use as jest.Mock;
      const responseUse = mockInstance.interceptors.response.use as jest.Mock;

      if (requestUse.mock.calls[0]) {
        requestInterceptor = requestUse.mock.calls[0][0];
      }
      if (responseUse.mock.calls[0]) {
        responseInterceptor = responseUse.mock.calls[0][0];
        responseErrorHandler = responseUse.mock.calls[0][1];
      }
    }
  });

  describe('axios instance creation', () => {
    it('should create axios instance with correct base URL and timeout', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.any(String),
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        })
      );
    });

    it('should set up request and response interceptors', () => {
      const mockInstance = (axios.create as jest.Mock).mock.results[0]?.value;
      expect(mockInstance?.interceptors.request.use).toHaveBeenCalled();
      expect(mockInstance?.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('request interceptor', () => {
    it('should add Authorization header when token exists', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('test-token');

      const config = { headers: {} };
      const result = requestInterceptor?.(config);

      expect(result?.headers?.Authorization).toBe('Bearer test-token');
    });

    it('should not add Authorization header when token is missing', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const config = { headers: {} };
      const result = requestInterceptor?.(config);

      expect(result?.headers?.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor', () => {
    it('should pass through successful responses', () => {
      const response = { data: { success: true } };
      const result = responseInterceptor?.(response);
      expect(result).toEqual(response);
    });
  });

  describe('response error handler', () => {
    it('should clear tokens on 401 error', async () => {
      const error = {
        response: { status: 401 },
        message: '',
      };

      try {
        await responseErrorHandler?.(error);
      } catch {
        // Expected to reject
      }

      expect(localStorage.removeItem).toHaveBeenCalledWith('peak_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('peak_user');
    });

    it('should set session expired message on 401 error', async () => {
      const error = {
        response: { status: 401 },
        message: '',
      };

      try {
        await responseErrorHandler?.(error);
      } catch (e: any) {
        expect(e.message).toBe('세션이 만료되었습니다. 다시 로그인해주세요');
      }
    });

    it('should reject with error for non-401 errors', async () => {
      const error = {
        response: { status: 500, data: {} },
        message: '',
      };

      await expect(responseErrorHandler?.(error)).rejects.toBeDefined();
    });

    it('should use server error message when available', async () => {
      const error = {
        response: { status: 400, data: { message: '잘못된 요청입니다' } },
        message: '',
      };

      try {
        await responseErrorHandler?.(error);
      } catch (e: any) {
        expect(e.message).toBe('잘못된 요청입니다');
      }
    });

    it('should handle network errors (no response)', async () => {
      const error = {
        message: '',
        response: undefined,
        code: undefined,
      };

      try {
        await responseErrorHandler?.(error);
      } catch (e: any) {
        expect(e.message).toBe('네트워크 연결을 확인해주세요');
      }
    });

    it('should handle timeout errors', async () => {
      const error = {
        message: '',
        response: undefined,
        code: 'ECONNABORTED',
      };

      try {
        await responseErrorHandler?.(error);
      } catch (e: any) {
        expect(e.message).toBe('요청 시간이 초과되었습니다. 다시 시도해주세요');
      }
    });
  });
});
