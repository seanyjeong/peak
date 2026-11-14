'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Moon, Sun, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useTheme } from '@/components/theme-provider';
import type { User } from '@/lib/api/auth';
import { getRoleDisplayName } from './nav-config';

// 내용 영역 위에 붙는 막대(로고는 사이드바가 없는 폭에서만). 다크 모드 토글·내 계정(로그아웃).
export function TopBar({
  user,
  onLogout,
  logoHref,
  logo = 'phone',
}: {
  user: User | null;
  onLogout: () => void;
  logoHref: string;
  /** phone: 휴대폰 폭에서만 로고, always: 항상, never: 안 보임 */
  logo?: 'phone' | 'always' | 'never';
}) {
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 shrink-0 bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 md:h-[72px] md:px-8">
        {logo !== 'never' && (
          <Link href={logoHref} className={cn('flex shrink-0 items-center gap-2', logo === 'phone' && 'md:hidden')} aria-label="대시보드로 가기">
            <Image src="/peak-512x512.png" alt="P-EAK" width={32} height={32} className="rounded-xl" />
            <span className="text-[17px] font-extrabold tracking-tight text-foreground">P-EAK</span>
          </Link>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-secondary-foreground transition-colors hover:bg-card hover:text-foreground"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="내 계정"
                aria-expanded={menuOpen}
                className="flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-card md:pr-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
                  <UserIcon className="h-[18px] w-[18px] text-primary" />
                </span>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-semibold leading-tight text-foreground">{user.name}</span>
                  <span className="block text-xs text-muted-foreground">{getRoleDisplayName(user.role, user.position)}</span>
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-popover p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <div className="px-3 py-2 md:hidden">
                    <p className="text-sm font-semibold text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{getRoleDisplayName(user.role, user.position)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
