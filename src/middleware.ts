import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  // 로그인 페이지, API, 정적 파일은 스킵
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 태블릿 감지 (아이뮤즈 L11 포함)
  // iPad, Android 태블릿 (Mobile 제외), 아이뮤즈 감지
  const isTablet = /iPad|Android(?!.*Mobile)|tablet|IMUZ|imuz/i.test(ua);

  // 태블릿 사용자가 PC 경로에 접근하면 태블릿 버전으로 리다이렉트
  if (isTablet) {
    // 이미 tablet 경로면 스킵
    if (pathname.startsWith('/tablet')) {
      return NextResponse.next();
    }

    // 루트 경로면 대시보드로
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/tablet/dashboard', request.url));
    }

    // PC 경로를 태블릿 경로로 변환
    // /dashboard -> /tablet/dashboard
    // /students/123 -> /tablet/students/123
    const tabletPath = `/tablet${pathname}`;
    return NextResponse.redirect(new URL(tabletPath, request.url));
  }

  // PC 사용자가 태블릿 경로에 접근하면 PC 버전으로 리다이렉트
  if (!isTablet && pathname.startsWith('/tablet')) {
    const pcPath = pathname.replace('/tablet', '') || '/dashboard';
    return NextResponse.redirect(new URL(pcPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
