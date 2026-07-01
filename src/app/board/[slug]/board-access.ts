import { PEAK_API_BASE_URL } from '@/lib/api/base-url';

const BOARD_TOKEN_PREFIX = 'peak_board_token_';

export interface BoardPinRequiredResponse {
  success: false;
  requiresPin: true;
  academy?: {
    name?: string;
    slug?: string;
  };
  message?: string;
}

export interface BoardPinSuccessResponse {
  success: true;
  requiresPin: false;
  boardToken?: string;
  expiresIn?: number;
}

export function getStoredBoardToken(slug: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(`${BOARD_TOKEN_PREFIX}${slug}`);
}

export function storeBoardToken(slug: string, token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(`${BOARD_TOKEN_PREFIX}${slug}`, token);
}

export function clearStoredBoardToken(slug: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(`${BOARD_TOKEN_PREFIX}${slug}`);
}

export function isPinRequiredResponse(value: unknown): value is BoardPinRequiredResponse {
  return Boolean(
    value
    && typeof value === 'object'
    && 'requiresPin' in value
    && (value as { requiresPin?: boolean }).requiresPin
  );
}

export async function fetchBoardJson<T>(path: string, slug: string, token?: string): Promise<T | BoardPinRequiredResponse> {
  const boardToken = token || getStoredBoardToken(slug);
  const res = await fetch(`${PEAK_API_BASE_URL}${path}`, {
    headers: boardToken ? { Authorization: `Bearer ${boardToken}` } : {},
  });
  const json = await res.json();

  if (res.status === 401 && isPinRequiredResponse(json)) {
    clearStoredBoardToken(slug);
  }

  return json;
}

export async function submitBoardPin(slug: string, pin: string): Promise<BoardPinSuccessResponse> {
  const res = await fetch(`${PEAK_API_BASE_URL}/public/${slug}/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || 'PIN을 확인하지 못했습니다.');
  }

  return json;
}
