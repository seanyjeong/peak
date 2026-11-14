'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { FeaturePermissions } from '@/lib/api/permissions';
import {
  canShowNavItem,
  dashboardItem,
  findActiveHref,
  navCategories,
  withPrefix,
  type NavItem,
} from './nav-config';

// 아래 탭 + '전체' 메뉴. responsive 면 휴대폰 폭(md 미만)에서만 보인다.
export function BottomNav({
  tabs,
  menuOpen,
  onMenuOpenChange,
  prefix = '',
  permissions,
  fallbackPermissions,
  tablet = false,
  responsive = true,
  onLogout,
}: {
  tabs: NavItem[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  prefix?: string;
  permissions: FeaturePermissions | null;
  fallbackPermissions: FeaturePermissions;
  tablet?: boolean;
  responsive?: boolean;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  // 메뉴에서 다른 화면으로 가면 시트를 닫는다.
  useEffect(() => {
    onMenuOpenChange(false);
  }, [pathname, onMenuOpenChange]);

  const activeHref = findActiveHref(pathname, prefix);
  const categories = [
    { title: '', items: [dashboardItem] },
    ...navCategories,
  ]
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => canShowNavItem(item, permissions, fallbackPermissions, tablet)),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <>
      <nav
        aria-label="아래 메뉴"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
          responsive && 'md:hidden'
        )}
      >
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const href = withPrefix(tab.href, prefix);
            const active = !menuOpen && activeHref === href;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}
                >
                  <Icon className={cn('h-6 w-6', active && 'text-primary')} />
                  {tab.name}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-expanded={menuOpen}
              onClick={() => onMenuOpenChange(!menuOpen)}
              className={cn('flex h-[60px] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold', menuOpen ? 'text-foreground' : 'text-muted-foreground')}
            >
              <LayoutGrid className={cn('h-6 w-6', menuOpen && 'text-primary')} />
              전체
            </button>
          </li>
        </ul>
      </nav>

      {menuOpen && (
        <div
          className={cn('fixed inset-0 z-50 flex flex-col bg-background', responsive && 'md:hidden')}
          role="dialog"
          aria-modal="true"
          aria-label="전체 메뉴"
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-5">
            <p className="text-lg font-extrabold tracking-tight text-foreground">전체</p>
            <button
              type="button"
              onClick={() => onMenuOpenChange(false)}
              aria-label="전체 메뉴 닫기"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            {categories.map((category) => (
              <section key={category.title || 'home'} className="rounded-2xl bg-card p-2">
                {category.title && <h3 className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{category.title}</h3>}
                <ul className="grid grid-cols-2 gap-1">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const href = withPrefix(item.href, prefix);
                    const active = activeHref === href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={href}
                          className={cn('flex h-12 items-center gap-2.5 rounded-xl px-3 text-[15px]', active ? 'bg-muted font-bold text-foreground' : 'font-medium text-foreground hover:bg-muted')}
                        >
                          <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <section className="rounded-2xl bg-card p-2">
              <button
                type="button"
                onClick={onLogout}
                className="flex h-12 w-full items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium text-destructive hover:bg-destructive-soft"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                로그아웃
              </button>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
