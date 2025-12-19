'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authAPI } from '@/lib/api/auth';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Activity,
  Medal,
  LogOut,
  Menu,
  ChevronLeft,
  Mountain
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '반 배치', href: '/assignments', icon: Users },
  { name: '훈련 계획', href: '/plans', icon: ClipboardList },
  { name: '훈련 기록', href: '/training', icon: Activity },
  { name: '기록 측정', href: '/records', icon: Medal },
  { name: '학생 관리', href: '/students', icon: Calendar },
];

export default function PCLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login';
    } else {
      setUser(currentUser);
    }
  }, []);

  const handleLogout = () => {
    authAPI.logout();
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar - Dark Navy */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#1a2b4a] text-white transition-all duration-300 flex flex-col fixed h-full z-10`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#243a5e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Mountain size={24} className="text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold tracking-wide">P-EAK</h1>
                <p className="text-[10px] text-slate-400 -mt-1">Physical Excellence</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-[#243a5e] rounded-lg transition"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 overflow-y-auto">
          <div className="space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-orange-500/15 text-orange-400 border-l-[3px] border-orange-500 -ml-[3px] pl-[15px]'
                      : 'text-slate-300 hover:bg-[#243a5e] hover:text-white'
                  }`}
                >
                  <item.icon size={20} />
                  {sidebarOpen && <span className="font-medium">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-[#243a5e]">
          {sidebarOpen && user && (
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">트레이너</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#243a5e] transition w-full ${!sidebarOpen && 'justify-center'}`}
          >
            <LogOut size={18} />
            {sidebarOpen && <span className="text-sm">로그아웃</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        <div className="p-8 min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
