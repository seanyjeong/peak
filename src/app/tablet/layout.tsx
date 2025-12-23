'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { authAPI } from '@/lib/api/auth';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Activity,
  Medal,
  UserCheck,
  Settings,
  Calendar,
  LogOut,
  Menu,
  X,
  Dumbbell
} from 'lucide-react';

const APP_VERSION = 'v2.0.8';

// 동적 임포트로 AlertPopup 로드 (서버 사이드 렌더링 방지)
const AlertPopup = dynamic(() => import('@/components/AlertPopup'), { ssr: false });

// Orientation Context
const OrientationContext = createContext<'portrait' | 'landscape'>('portrait');
export const useOrientation = () => useContext(OrientationContext);

// Navigation items
const navigation = [
  { name: '대시보드', href: '/tablet/dashboard', icon: LayoutDashboard },
  { name: '출근 체크', href: '/tablet/attendance', icon: UserCheck },
  { name: '반 배치', href: '/tablet/assignments', icon: Users },
  { name: '수업 계획', href: '/tablet/plans', icon: ClipboardList },
  { name: '수업 기록', href: '/tablet/training', icon: Activity },
  { name: '기록 측정', href: '/tablet/records', icon: Medal },
  { name: '학생 관리', href: '/tablet/students', icon: Calendar },
  { name: '운동 관리', href: '/tablet/exercises', icon: Dumbbell },
  { name: '실기측정설정', href: '/tablet/settings', icon: Settings, adminOnly: true },
];

// Bottom tab items (세로 모드용 - 5개)
const bottomTabs = [
  { name: '대시보드', href: '/tablet/dashboard', icon: LayoutDashboard },
  { name: '반 배치', href: '/tablet/assignments', icon: Users },
  { name: '수업 기록', href: '/tablet/training', icon: Activity },
  { name: '기록 측정', href: '/tablet/records', icon: Medal },
  { name: '더보기', href: '#more', icon: Menu },
];

// 역할 표시명 매핑
const getRoleDisplayName = (role?: string, position?: string | null): string => {
  if (position) return position;
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};

export default function TabletLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role?: string; position?: string | null } | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAlertPopup, setShowAlertPopup] = useState(false);

  useEffect(() => {
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

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // 가로 모드 레이아웃
  if (orientation === 'landscape') {
    return (
      <OrientationContext.Provider value={orientation}>
        <div className="min-h-screen flex bg-slate-100">
          {/* 인앱 알림 팝업 */}
          {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

          {/* 축소형 사이드바 */}
          <aside className="w-20 bg-[#1a2b4a] text-white flex flex-col fixed h-full z-20">
            {/* 로고 */}
            <div className="h-16 flex items-center justify-center border-b border-[#243a5e]">
              <Image
                src="/peak-512x512.png"
                alt="P-EAK"
                width={48}
                height={48}
                className="rounded-lg"
              />
            </div>

            {/* 네비게이션 */}
            <nav className="flex-1 py-4 overflow-y-auto">
              <div className="space-y-1 px-2">
                {navigation
                  .filter(item => !item.adminOnly || isAdmin)
                  .map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex flex-col items-center py-3 px-1 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'text-slate-300 hover:bg-[#243a5e] hover:text-white'
                        }`}
                        title={item.name}
                      >
                        <item.icon size={22} />
                        <span className="text-[10px] mt-1 text-center leading-tight">{item.name}</span>
                      </Link>
                    );
                  })}
              </div>
            </nav>

            {/* 사용자 & 로그아웃 */}
            <div className="border-t border-[#243a5e] p-2">
              <button
                onClick={handleLogout}
                className="flex flex-col items-center py-2 px-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#243a5e] transition w-full"
                title="로그아웃"
              >
                <LogOut size={20} />
                <span className="text-[10px] mt-1">로그아웃</span>
              </button>
              <p className="text-[8px] text-slate-500 text-center mt-2">{APP_VERSION}</p>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="flex-1 ml-20">
            {/* 헤더 */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
              <h1 className="text-lg font-bold text-slate-800">
                {navigation.find(n => pathname.startsWith(n.href))?.name || 'P-EAK'}
              </h1>
              {user && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{getRoleDisplayName(user.role, user.position)}</p>
                  </div>
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                    {user.name.charAt(0)}
                  </div>
                </div>
              )}
            </header>

            {/* 페이지 콘텐츠 */}
            <div className="p-6 min-h-[calc(100vh-56px)]">
              {children}
            </div>
          </main>
        </div>
      </OrientationContext.Provider>
    );
  }

  // 세로 모드 레이아웃
  return (
    <OrientationContext.Provider value={orientation}>
      <div className="min-h-screen flex flex-col bg-slate-100">
        {/* 인앱 알림 팝업 */}
        {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

        {/* 헤더 */}
        <header className="h-16 bg-[#1a2b4a] flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Image
              src="/peak-512x512.png"
              alt="P-EAK"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-white font-bold">P-EAK</h1>
              <p className="text-[10px] text-slate-400">{APP_VERSION}</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-[10px] text-slate-400">{getRoleDisplayName(user.role, user.position)}</p>
              </div>
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                {user.name.charAt(0)}
              </div>
            </div>
          )}
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-4 pb-24 overflow-y-auto">
          {children}
        </main>

        {/* 하단 탭 바 */}
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-20 safe-area-pb">
          {bottomTabs.map((tab) => {
            if (tab.href === '#more') {
              return (
                <button
                  key={tab.name}
                  onClick={() => setShowMoreMenu(true)}
                  className="flex flex-col items-center justify-center py-2 px-3 min-w-[64px] text-slate-400"
                >
                  <tab.icon size={24} />
                  <span className="text-xs mt-1">{tab.name}</span>
                </button>
              );
            }
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-2 px-3 min-w-[64px] ${
                  isActive ? 'text-orange-500' : 'text-slate-400'
                }`}
              >
                <tab.icon size={24} />
                <span className="text-xs mt-1">{tab.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* 더보기 메뉴 모달 */}
        {showMoreMenu && (
          <div className="fixed inset-0 bg-black/50 z-30 flex items-end" onClick={() => setShowMoreMenu(false)}>
            <div
              className="bg-white w-full rounded-t-2xl p-4 pb-8 safe-area-pb"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">메뉴</h2>
                <button onClick={() => setShowMoreMenu(false)} className="p-2 text-slate-400">
                  <X size={24} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {navigation
                  .filter(item => !item.adminOnly || isAdmin)
                  .map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setShowMoreMenu(false)}
                        className={`flex flex-col items-center p-4 rounded-xl transition ${
                          isActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <item.icon size={28} />
                        <span className="text-xs mt-2 text-center">{item.name}</span>
                      </Link>
                    );
                  })}
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleLogout();
                  }}
                  className="flex flex-col items-center p-4 rounded-xl bg-red-50 text-red-600"
                >
                  <LogOut size={28} />
                  <span className="text-xs mt-2">로그아웃</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OrientationContext.Provider>
  );
}
