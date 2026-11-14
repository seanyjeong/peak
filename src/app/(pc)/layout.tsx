'use client';

import dynamic from 'next/dynamic';

import packageJson from '../../../package.json';
const APP_VERSION = "v" + packageJson.version;
const APP_UPDATED = packageJson.lastUpdate;
import { authAPI, type User } from '@/lib/api/auth';
import {
  type FeaturePermissions,
  getFallbackFeaturePermissions,
  getMyFeaturePermissions,
} from '@/lib/api/permissions';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { ThemeProvider } from '@/components/theme-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { phoneTabs } from '@/components/layout/nav-config';

// 동적 임포트로 AlertPopup 로드 (서버 사이드 렌더링 방지)
const AlertPopup = dynamic(() => import('@/components/AlertPopup'), { ssr: false });

const SIDEBAR_COLLAPSED_KEY = 'peak_sidebar_collapsed';

function PCLayoutContent({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<FeaturePermissions | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAlertPopup, setShowAlertPopup] = useState(false);

  useEffect(() => {
    // 태블릿 감지 (클라이언트 사이드 fallback)
    const checkTablet = () => {
      const ua = navigator.userAgent;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const minDimension = Math.min(screenWidth, screenHeight);
      const maxDimension = Math.max(screenWidth, screenHeight);

      // 태블릿 조건: 터치 지원 + 화면 크기 700px~1400px (가로 또는 세로)
      const isTabletSize = isTouch && minDimension >= 600 && minDimension <= 1400 && maxDimension <= 2000;
      const isTabletUA = /iPad|IMUZ|im-h\d|H091|SM-T\d|GT-P\d|Tab|tablet/i.test(ua) ||
        (/Android/i.test(ua) && !/Mobile/i.test(ua));

      if ((isTabletSize || isTabletUA) && !window.location.pathname.startsWith('/tablet')) {
        const path = window.location.pathname === '/' ? '/tablet/dashboard' : `/tablet${window.location.pathname}`;
        window.location.href = path;
        return true;
      }
      return false;
    };

    if (checkTablet()) return;

    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
    } catch {
      // 저장소를 못 쓰면 펼친 채로 둔다.
    }

    const currentUser = authAPI.getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login';
    } else {
      setUser(currentUser);
      setPermissions(getFallbackFeaturePermissions(currentUser));
      getMyFeaturePermissions(currentUser).then(setPermissions);
      // 로그인 후 알림 체크 (세션당 한 번만)
      const alertShown = sessionStorage.getItem('alertShown');
      if (!alertShown) {
        setShowAlertPopup(true);
        sessionStorage.setItem('alertShown', 'true');
      }
    }
  }, []);

  const handleLogout = () => {
    authAPI.logout();
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      // 저장소를 못 쓰면 이번 화면에서만 바뀐다.
    }
  };

  const fallbackPermissions = getFallbackFeaturePermissions(user);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 인앱 알림 팝업 */}
      {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        permissions={permissions}
        fallbackPermissions={fallbackPermissions}
        version={`${APP_VERSION} · ${APP_UPDATED}`}
      />

      <div className={cn('min-w-0 transition-[margin] duration-300 ease-in-out', collapsed ? 'md:ml-[76px]' : 'md:ml-[248px]')}>
        <TopBar user={user} onLogout={handleLogout} logoHref="/dashboard" />
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-2 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <BottomNav
        tabs={phoneTabs}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        permissions={permissions}
        fallbackPermissions={fallbackPermissions}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default function PCLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="peak-ui-theme">
      <PCLayoutContent>{children}</PCLayoutContent>
    </ThemeProvider>
  );
}
