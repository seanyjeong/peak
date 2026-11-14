'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
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

function NavLink({ item, href, active, collapsed }: { item: NavItem; href: string; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      title={collapsed ? item.name : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-xl text-[15px] transition-colors',
        collapsed ? 'h-11 justify-center' : 'h-10 gap-3 px-3',
        active ? 'bg-muted font-bold text-foreground' : 'font-medium text-secondary-foreground hover:bg-muted/70 hover:text-foreground'
      )}
    >
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
    </Link>
  );
}

// 흰 판 사이드바(펼침 248px / 접힘 76px). responsive 면 휴대폰 폭(md 미만)에서 숨는다.
export function Sidebar({
  collapsed,
  onToggle,
  prefix = '',
  permissions,
  fallbackPermissions,
  tablet = false,
  responsive = true,
  version,
}: {
  collapsed: boolean;
  onToggle: () => void;
  prefix?: string;
  permissions: FeaturePermissions | null;
  fallbackPermissions: FeaturePermissions;
  tablet?: boolean;
  responsive?: boolean;
  version: string;
}) {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname, prefix);
  const categories = navCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => canShowNavItem(item, permissions, fallbackPermissions, tablet)),
    }))
    .filter((category) => category.items.length > 0);
  const dashboardHref = withPrefix(dashboardItem.href, prefix);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-full flex-col bg-card transition-[width] duration-300 ease-in-out',
        responsive ? 'hidden md:flex' : 'flex',
        collapsed ? 'w-[76px]' : 'w-[248px]'
      )}
    >
      <div className={cn('flex h-[72px] shrink-0 items-center', collapsed ? 'justify-center px-2' : 'gap-2.5 px-5')}>
        <Link href={dashboardHref} className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="대시보드로 가기">
          <Image src="/peak-512x512.png" alt="P-EAK" width={36} height={36} className="shrink-0 rounded-xl" />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[17px] font-extrabold leading-tight tracking-tight text-foreground">P-EAK</span>
              <span className="block truncate text-xs font-medium text-muted-foreground">실기 훈련 운영</span>
            </span>
          )}
        </Link>
      </div>

      <nav className={cn('min-h-0 flex-1 overflow-y-auto pb-3', collapsed ? 'px-2' : 'px-3')}>
        <NavLink item={dashboardItem} href={dashboardHref} active={activeHref === dashboardHref} collapsed={collapsed} />
        {categories.map((category) => (
          <section key={category.title} className={cn(collapsed ? 'mt-2 border-t border-border/60 pt-2' : 'mt-5')}>
            {!collapsed && <h3 className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">{category.title}</h3>}
            <ul className="space-y-0.5">
              {category.items.map((item) => {
                const href = withPrefix(item.href, prefix);
                return (
                  <li key={item.href}>
                    <NavLink item={item} href={href} active={activeHref === href} collapsed={collapsed} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className={cn('flex shrink-0 items-center border-t border-border/60 py-3', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        {!collapsed && <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground/80">{version}</div>}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </aside>
  );
}
