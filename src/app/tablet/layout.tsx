'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import dynamic from 'next/dynamic';
import { authAPI, type User } from '@/lib/api/auth';
import {
  type FeaturePermissions,
  getFallbackFeaturePermissions,
  getMyFeaturePermissions,
} from '@/lib/api/permissions';
import { cn } from '@/lib/utils/cn';
import { ThemeProvider } from '@/components/theme-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { tabletTabs } from '@/components/layout/nav-config';

import packageJson from '../../../package.json';
const APP_VERSION = "v" + packageJson.version;
const APP_UPDATED = packageJson.lastUpdate;

// 동적 임포트로 AlertPopup 로드 (서버 사이드 렌더링 방지)
const AlertPopup = dynamic(() => import('@/components/AlertPopup'), { ssr: false });

// Orientation Context
const OrientationContext = createContext<'portrait' | 'landscape'>('portrait');
export const useOrientation = () => useContext(OrientationContext);

const SIDEBAR_COLLAPSED_KEY = 'peak_tablet_sidebar_collapsed';

function TabletLayoutContent({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<FeaturePermissions | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAlertPopup, setShowAlertPopup] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
    const handleResize = () => {
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
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
  const landscape = orientation === 'landscape';

  // 가로: 흰 판 사이드바 / 세로: 아래 탭 + 전체 메뉴
  return (
    <OrientationContext.Provider value={orientation}>
      <div className="min-h-screen bg-background text-foreground">
        {/* 인앱 알림 팝업 */}
        {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

        {landscape && (
          <Sidebar
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            prefix="/tablet"
            permissions={permissions}
            fallbackPermissions={fallbackPermissions}
            tablet
            responsive={false}
            version={`${APP_VERSION} · ${APP_UPDATED}`}
          />
        )}

        <div className={cn('min-w-0 transition-[margin] duration-300 ease-in-out', landscape && (collapsed ? 'ml-[76px]' : 'ml-[248px]'))}>
          <TopBar user={user} onLogout={handleLogout} logoHref="/tablet/dashboard" logo={landscape ? 'never' : 'always'} />
          <main className={cn('mx-auto w-full max-w-[1440px] px-4 pt-2 md:px-6', landscape ? 'pb-10' : 'pb-[calc(env(safe-area-inset-bottom)+84px)]')}>
            {children}
          </main>
        </div>

        {!landscape && (
          <BottomNav
            tabs={tabletTabs}
            menuOpen={menuOpen}
            onMenuOpenChange={setMenuOpen}
            prefix="/tablet"
            permissions={permissions}
            fallbackPermissions={fallbackPermissions}
            tablet
            responsive={false}
            onLogout={handleLogout}
          />
        )}
      </div>
    </OrientationContext.Provider>
  );
}

export default function TabletLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="peak-ui-theme">
      <TabletLayoutContent>{children}</TabletLayoutContent>
    </ThemeProvider>
  );
}
