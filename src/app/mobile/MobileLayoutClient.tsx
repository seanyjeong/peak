'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { authAPI } from '@/lib/api/auth';
import Image from 'next/image';
import { ClipboardList, Activity, Medal, BarChart3, LogOut, Sun, Moon } from 'lucide-react';

const APP_VERSION = 'v5.0.0';

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

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('peak-ui-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleLogout = () => { authAPI.logout(); };

  const currentPage = bottomTabs.find(tab => pathname.startsWith(tab.href))?.name || 'P-EAK';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      {showAlertPopup && <AlertPopup onClose={() => setShowAlertPopup(false)} />}

      {/* Header */}
      <header className="h-14 bg-neutral-900 dark:bg-neutral-950 flex items-center justify-between px-4 sticky top-0 z-20 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Image src="/peak-512x512.png" alt="P-EAK" width={32} height={32} className="rounded-lg" />
          <div>
            <h1 className="text-white font-bold text-sm">{currentPage}</h1>
            <p className="text-[8px] text-neutral-400">{APP_VERSION}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-neutral-800 transition text-neutral-300">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user && (
            <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-medium text-white">{user.name}</p>
                <p className="text-[10px] text-neutral-400">{getRoleDisplayName(user.role, user.position)}</p>
              </div>
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {user.name.charAt(0)}
              </div>
            </button>
          )}
        </div>
      </header>

      {/* Dropdown */}
      {showMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}>
          <div className="absolute top-14 right-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-2 w-40 border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm transition">
              <LogOut size={16} /><span>로그아웃</span>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-3 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Tabs - 4 tabs */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-2 z-20 safe-area-pb">
        {bottomTabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center py-2 px-3 min-w-[70px] rounded-xl transition ${
                isActive
                  ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] mt-0.5 font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
