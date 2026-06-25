'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Activity,
  Medal,
  LogOut,
  ChevronLeft,
  UserCheck,
  ListChecks,
  Layers,
  Settings,
  Trophy,
  BarChart3,
  Sun,
  Moon,
  type LucideIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';

// 동적 임포트로 AlertPopup 로드 (서버 사이드 렌더링 방지)
const AlertPopup = dynamic(() => import('@/components/AlertPopup'), { ssr: false });

type NavigationPermission = 'analyticsReport' | 'measurementSettingsManage';

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  permission?: NavigationPermission;
}

const navigation: NavigationItem[] = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '출근 체크', href: '/attendance', icon: UserCheck },
  { name: '학생 출석', href: '/student-attendance', icon: ListChecks },
  { name: '반 배치', href: '/assignments', icon: Users },
  { name: '반 프리셋', href: '/presets', icon: Layers },
  { name: '수업 계획', href: '/plans', icon: ClipboardList },
  { name: '수업 기록', href: '/training', icon: Activity },
  { name: '기록 측정', href: '/records', icon: Medal },
  { name: '월말테스트', href: '/monthly-test', icon: Trophy },
  { name: '학생 관리', href: '/students', icon: Calendar },
  { name: '분석 리포트', href: '/analytics', icon: BarChart3, permission: 'analyticsReport' },
  { name: '실기 측정 설정', href: '/settings', icon: Settings, permission: 'measurementSettingsManage' },
];

// 역할 표시명 매핑
const getRoleDisplayName = (role?: string, position?: string | null): string => {
  // position이 있으면 그대로 반환
  if (position) {
    return position;
  }

  // role 매핑
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};

function PCLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<FeaturePermissions | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAlertPopup, setShowAlertPopup] = useState(false);
  const { theme, setTheme } = useTheme();

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

  const canShowNavigationItem = (item: NavigationItem) => {
    if (!item.permission) return true;
    const fallback = getFallbackFeaturePermissions(user);
    return permissions?.[item.permission] ?? fallback[item.permission];
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      {/* 인앱 알림 팝업 */}
      {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-20'} fixed z-10 flex h-full flex-col border-r border-slate-200 bg-slate-950 text-slate-100 transition-all duration-200 dark:border-slate-800 dark:bg-slate-950`}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-slate-800 ${sidebarOpen ? 'justify-between px-4' : 'justify-center px-2'}`}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <Image
                  src="/peak-512x512.png"
                  alt="P-EAK"
                  width={40}
                  height={40}
                  className="rounded-lg flex-shrink-0"
                />
                <div>
                  <h1 className="text-lg font-semibold tracking-wide">P-EAK</h1>
                  <p className="text-[11px] text-slate-400 -mt-0.5">Training Console</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-md p-2 text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1 transition hover:bg-slate-900"
            >
              <Image
                src="/peak-512x512.png"
                alt="P-EAK"
                width={44}
                height={44}
                className="rounded-lg"
              />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className={`space-y-1 ${sidebarOpen ? 'px-3' : 'px-1'}`}>
            {navigation
              .filter(canShowNavigationItem)
              .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex rounded-md border transition ${
                    sidebarOpen
                      ? `items-center gap-3 px-3 py-2.5 ${isActive ? 'border-orange-500/50 bg-orange-500/15 text-orange-200' : 'border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white'}`
                      : `flex-col items-center px-1 py-2 ${isActive ? 'border-orange-500/50 bg-orange-500/15 text-orange-200' : 'border-transparent text-slate-300 hover:bg-slate-900 hover:text-white'}`
                  }`}
                >
                  <item.icon size={20} />
                  {sidebarOpen ? (
                    <span className="font-medium">{item.name}</span>
                  ) : (
                    <span className="text-[10px] mt-1 text-center leading-tight">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className={`border-t border-slate-800 ${sidebarOpen ? 'p-4' : 'p-2'}`}>
          {sidebarOpen && user && (
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{getRoleDisplayName(user.role, user.position)}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex w-full rounded-md text-slate-400 transition hover:bg-slate-900 hover:text-white ${
              sidebarOpen ? 'items-center gap-3 px-3 py-2' : 'flex-col items-center py-2'
            }`}
          >
            <LogOut size={18} />
            {sidebarOpen ? (
              <span className="text-sm">로그아웃</span>
            ) : (
              <span className="text-[10px] mt-1">로그아웃</span>
            )}
          </button>
          {sidebarOpen && (
            <p className="mt-3 text-center text-[10px] text-slate-500">{APP_VERSION} · {APP_UPDATED}</p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-56' : 'ml-20'} transition-all duration-200`}>
        {/* 헤더 */}
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-slate-50/95 px-6 dark:border-slate-800 dark:bg-slate-950/95">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">P-EAK</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">실기 훈련 운영</p>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-md border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="min-h-[calc(100vh-56px)] p-6">
          {children}
        </div>
      </main>
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
