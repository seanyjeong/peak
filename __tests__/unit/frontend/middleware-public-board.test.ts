jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({ kind: 'next' })),
    redirect: jest.fn((url: URL) => ({ kind: 'redirect', url: url.toString() })),
  },
}));

import { NextResponse } from 'next/server';
import { middleware } from '@/middleware';

const mockNext = jest.mocked(NextResponse.next);
const mockRedirect = jest.mocked(NextResponse.redirect);

const TABLET_UA = 'Mozilla/5.0 (Linux; Android 13; SM-T970)';
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; SM-S918N) Mobile';

function createRequest(pathname: string, userAgent: string) {
  return {
    headers: { get: (name: string) => (name === 'user-agent' ? userAgent : null) },
    nextUrl: { pathname },
    url: `https://peak-rose.vercel.app${pathname}`,
  } as Parameters<typeof middleware>[0];
}

describe('public board device routing', () => {
  beforeEach(() => {
    mockNext.mockClear();
    mockRedirect.mockClear();
  });

  it.each([
    ['/board/suncheon', TABLET_UA],
    ['/board/suncheon/scores', TABLET_UA],
    ['/board/suncheon', MOBILE_UA],
    ['/board/suncheon/scores', MOBILE_UA],
  ])('keeps %s on the public route for device user agents', (pathname, userAgent) => {
    expect(middleware(createRequest(pathname, userAgent))).toEqual({ kind: 'next' });
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('preserves the existing tablet dashboard redirect', () => {
    expect(middleware(createRequest('/dashboard', TABLET_UA))).toEqual({
      kind: 'redirect',
      url: 'https://peak-rose.vercel.app/tablet/dashboard',
    });
  });

  it('does not treat an unrelated board-prefixed route as a public board', () => {
    expect(middleware(createRequest('/boardroom', TABLET_UA))).toEqual({
      kind: 'redirect',
      url: 'https://peak-rose.vercel.app/tablet/boardroom',
    });
  });
});
