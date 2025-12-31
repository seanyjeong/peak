'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { authAPI } from '@/lib/api/auth';
import Image from 'next/image';
import { Medal, ClipboardList, Activity, LogOut } from 'lucide-react';

const APP_VERSION = 'v4.3.7';

// 동적 임포트로 AlertPopup 로드 (서버 사이드 렌더링 방지)
const AlertPopup = dynamic(() => import('@/components/AlertPopup'), { ssr: false });

// Bottom tab items (3개)
const bottomTabs = [
  { name: '기록', href: '/mobile/records', icon: Medal },
  { name: '계획', href: '/mobile/plans', icon: ClipboardList },
  { name: '수업', href: '/mobile/training', icon: Activity },
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

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role?: string; position?: string | null } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
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

  const handleLogout = () => {
    authAPI.logout();
  };

  const currentPage = bottomTabs.find(tab => pathname.startsWith(tab.href))?.name || 'P-EAK';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* 인앱 알림 팝업 */}
      {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

      {/* 헤더 */}
      <header className="h-14 bg-[#1a2b4a] flex items-center justify-between px-4 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Image
            src="/peak-512x512.png"
            alt="P-EAK"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-white font-bold text-sm">{currentPage}</h1>
            <p className="text-[8px] text-slate-400">{APP_VERSION}</p>
          </div>
        </div>
        {user && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2"
          >
            <div className="text-right">
              <p className="text-xs font-medium text-white">{user.name}</p>
              <p className="text-[10px] text-slate-400">{getRoleDisplayName(user.role, user.position)}</p>
            </div>
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user.name.charAt(0)}
            </div>
          </button>
        )}
      </header>

      {/* 프로필 드롭다운 메뉴 */}
      {showMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}>
          <div
            className="absolute top-14 right-2 bg-white rounded-xl shadow-lg p-2 w-40"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
            >
              <LogOut size={16} />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main className="flex-1 p-3 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* 하단 탭 바 */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-4 z-20 safe-area-pb">
        {bottomTabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center py-2 px-4 min-w-[72px] ${
                isActive ? 'text-orange-500' : 'text-slate-400'
              }`}
            >
              <tab.icon size={22} />
              <span className="text-xs mt-1 font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
