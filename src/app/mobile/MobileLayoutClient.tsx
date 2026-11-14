'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { authAPI } from '@/lib/api/auth';
import Image from 'next/image';
import { ClipboardList, Activity, Medal, BarChart3, LogOut, Sun, Moon } from 'lucide-react';
import packageJson from '../../../package.json';

const APP_VERSION = "v" + packageJson.version;

const AlertPopup = dynamic(() => import('@/components/AlertPopup'), { ssr: false });

const bottomTabs = [
  { name: '내 수업', href: '/mobile/my-class', icon: ClipboardList },
  { name: '수업기록', href: '/mobile/training', icon: Activity },
  { name: '기록측정', href: '/mobile/records', icon: Medal },
  { name: '통계', href: '/mobile/stats', icon: BarChart3 },
];

const getRoleDisplayName = (role?: string, position?: string | null): string => {
  if (position) return position;
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};

export default function MobileLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role?: string; position?: string | null } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAlertPopup, setShowAlertPopup] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login';
    } else {
      setUser(currentUser);
      const alertShown = sessionStorage.getItem('alertShown');
      if (!alertShown) {
        setShowAlertPopup(true);
        sessionStorage.setItem('alertShown', 'true');
      }
    }

    const savedTheme = localStorage.getItem('peak-ui-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('peak-ui-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleLogout = () => { authAPI.logout(); };

  const currentPage = bottomTabs.find(tab => pathname.startsWith(tab.href))?.name || 'P-EAK';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

      {/* Header */}
      <header className="h-16 bg-background/85 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <Image src="/peak-512x512.png" alt="P-EAK" width={32} height={32} className="rounded-xl" />
          <div>
            <h1 className="text-foreground text-[17px] font-extrabold leading-tight tracking-tight">{currentPage}</h1>
            <p className="text-[10px] text-muted-foreground">{APP_VERSION}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-card transition text-secondary-foreground" aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user && (
            <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 rounded-xl p-1 pl-2 transition hover:bg-card" aria-label="내 계정">
              <div className="text-right">
                <p className="text-xs font-medium text-foreground">{user.name}</p>
                <p className="text-[10px] text-muted-foreground">{getRoleDisplayName(user.role, user.position)}</p>
              </div>
              <div className="w-8 h-8 bg-primary-soft rounded-full flex items-center justify-center text-primary font-bold text-sm">
                {user.name.charAt(0)}
              </div>
            </button>
          )}
        </div>
      </header>

      {/* Dropdown */}
      {showMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}>
          <div className="absolute top-16 right-3 w-44 rounded-2xl bg-popover p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2.5 text-destructive hover:bg-destructive-soft rounded-xl text-[15px] font-medium transition">
              <LogOut size={16} /><span>로그아웃</span>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+84px)] overflow-y-auto">
        {children}
      </main>

      {/* Bottom Tabs - 4 tabs */}
      <nav aria-label="아래 메뉴" className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-lg">
          {bottomTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <li key={tab.name} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <tab.icon className={`h-6 w-6 ${isActive ? 'text-primary' : ''}`} />
                  {tab.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
