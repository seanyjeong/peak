'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const APP_VERSION = 'v2.0.0';
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
  Mountain,
  UserCheck,
  Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '출근 체크', href: '/attendance', icon: UserCheck },
  { name: '반 배치', href: '/assignments', icon: Users },
  { name: '수업 계획', href: '/plans', icon: ClipboardList },
  { name: '수업 기록', href: '/training', icon: Activity },
  { name: '기록 측정', href: '/records', icon: Medal },
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

export default function PCLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role?: string; position?: string | null } | null>(null);
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
        className={`${sidebarOpen ? 'w-52' : 'w-20'} bg-[#1a2b4a] text-white transition-all duration-300 flex flex-col fixed h-full z-10`}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-[#243a5e] ${sidebarOpen ? 'justify-between px-4' : 'justify-center px-2'}`}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mountain size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-wide">P-EAK</h1>
                  <p className="text-[10px] text-slate-400 -mt-1">Physical Excellence</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-[#243a5e] rounded-lg transition"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center hover:bg-orange-600 transition"
            >
              <Mountain size={24} className="text-white" />
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
                      ? `items-center gap-3 px-3 py-3 ${isActive ? 'bg-orange-500/15 text-orange-400 border-l-[3px] border-orange-500 -ml-[3px] pl-[15px]' : 'text-slate-300 hover:bg-[#243a5e] hover:text-white'}`
                      : `flex-col items-center py-2 px-1 ${isActive ? 'bg-orange-500/15 text-orange-400' : 'text-slate-300 hover:bg-[#243a5e] hover:text-white'}`
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
        <div className={`border-t border-[#243a5e] ${sidebarOpen ? 'p-4' : 'p-2'}`}>
          {sidebarOpen && user && (
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{getRoleDisplayName(user.role, user.position)}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex rounded-lg text-slate-400 hover:text-white hover:bg-[#243a5e] transition w-full ${
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
        <div className="p-8 min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
