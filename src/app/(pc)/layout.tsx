'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const APP_VERSION = 'v4.3.35';
import { authAPI } from '@/lib/api/auth';
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
  Settings,
  Trophy,
  Sun,
  Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';

// 동적 임포트로 AlertPopup 로드 (서버 사이드 렌더링 방지)
const AlertPopup = dynamic(() => import('@/components/AlertPopup'), { ssr: false });

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '출근 체크', href: '/attendance', icon: UserCheck },
  { name: '반 배치', href: '/assignments', icon: Users },
  { name: '수업 계획', href: '/plans', icon: ClipboardList },
  { name: '수업 기록', href: '/training', icon: Activity },
  { name: '기록 측정', href: '/records', icon: Medal },
  { name: '월말테스트', href: '/monthly-test', icon: Trophy },
  { name: '학생 관리', href: '/students', icon: Calendar },
  { name: '실기측정설정', href: '/settings', icon: Settings, adminOnly: true },
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
  const [user, setUser] = useState<{ name: string; role?: string; position?: string | null } | null>(null);
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

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-900">
      {/* 인앱 알림 팝업 */}
      {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

      {/* Sidebar - Dark Navy */}
      <aside
        className={`${sidebarOpen ? 'w-52' : 'w-20'} bg-[#1a2b4a] dark:bg-slate-950 text-white transition-all duration-300 flex flex-col fixed h-full z-10`}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-[#243a5e] dark:border-slate-800 ${sidebarOpen ? 'justify-between px-4' : 'justify-center px-2'}`}>
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
                  <h1 className="text-lg font-bold tracking-wide">P-EAK</h1>
                  <p className="text-[10px] text-slate-400 -mt-1">Physical Excellence</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-[#243a5e] dark:hover:bg-slate-800 rounded-lg transition"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded-lg hover:bg-[#243a5e] dark:hover:bg-slate-800 transition"
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
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className={`space-y-1 ${sidebarOpen ? 'px-3' : 'px-1'}`}>
            {navigation
              .filter(item => !item.adminOnly || user?.role === 'admin' || user?.role === 'owner')
              .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex rounded-lg transition-all duration-200 ${
                    sidebarOpen
                      ? `items-center gap-3 px-3 py-3 ${isActive ? 'bg-orange-500/15 text-orange-400 border-l-[3px] border-orange-500 -ml-[3px] pl-[15px]' : 'text-slate-300 hover:bg-[#243a5e] dark:hover:bg-slate-800 hover:text-white'}`
                      : `flex-col items-center py-2 px-1 ${isActive ? 'bg-orange-500/15 text-orange-400' : 'text-slate-300 hover:bg-[#243a5e] dark:hover:bg-slate-800 hover:text-white'}`
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
        <div className={`border-t border-[#243a5e] dark:border-slate-800 ${sidebarOpen ? 'p-4' : 'p-2'}`}>
          {sidebarOpen && user && (
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{getRoleDisplayName(user.role, user.position)}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex rounded-lg text-slate-400 hover:text-white hover:bg-[#243a5e] dark:hover:bg-slate-800 transition w-full ${
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
            <p className="text-[10px] text-slate-500 text-center mt-3">{APP_VERSION}</p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-52' : 'ml-20'} transition-all duration-300`}>
        {/* 헤더에 다크모드 토글 */}
        <div className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end px-6 sticky top-0 z-20">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="p-8 min-h-[calc(100vh-56px)]">
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
