import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/*
 * 화면 공통 틀 (2026-11 새 디자인, 파카와 같은 모양). 회색 바탕 위에 흰 카드(rounded-2xl)를 놓고,
 * 큰 숫자·굵은 제목·옅은 색 아이콘으로 구분한다. 줄(border)은 되도록 쓰지 않는다.
 */

export function PageHeader({ title, description, actions, className }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-3 pb-1 pt-2 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionCard({ title, description, actions, children, className, bodyClassName }: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-2xl bg-card', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cn('px-5 pb-5 sm:px-6', !(title || actions) && 'pt-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const toneText: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export const toneIcon: Record<Tone, string> = {
  neutral: 'bg-muted text-secondary-foreground',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
};

export function StatTile({ label, value, note, tone = 'neutral', icon: Icon, onClick, className }: {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-secondary-foreground">{label}</span>
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', toneIcon[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 break-keep text-[26px] font-extrabold leading-tight tracking-tight text-foreground tabular-nums">{value}</div>
      {note && <div className={cn('mt-1 text-[13px] font-medium', toneText[tone])}>{note}</div>}
    </>
  );
  const base = cn('min-w-0 rounded-2xl bg-card p-5 text-left', className);
  return onClick
    ? <button type="button" onClick={onClick} className={cn(base, 'transition-colors hover:bg-card/70 active:scale-[0.99]')}>{body}</button>
    : <div className={base}>{body}</div>;
}

export function ListRow({ icon: Icon, tone = 'neutral', title, detail, trailing, onClick, href, className }: {
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  title: React.ReactNode;
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const interactive = Boolean(onClick || href);
  const body = (
    <>
      {Icon && (
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', toneIcon[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-foreground">{title}</span>
        {detail && <span className="mt-0.5 block line-clamp-2 text-[13px] text-muted-foreground">{detail}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      {interactive && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />}
    </>
  );
  const base = cn('-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left', interactive && 'transition-colors hover:bg-muted', className);
  if (href) return <a href={href} className={base}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={base}>{body}</button>;
  return <div className={base}>{body}</div>;
}

export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="mt-3 text-[15px] font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 칩 하나(전체/지점/상태 고르기 등). 고른 칩은 진한 바탕. 흰 카드 안에서는 surface="card". */
export function chipClass(active: boolean, surface: 'page' | 'card' = 'page') {
  return cn(
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
    active
      ? 'bg-foreground text-background'
      : surface === 'card'
        ? 'bg-muted text-secondary-foreground hover:bg-border hover:text-foreground'
        : 'bg-card text-secondary-foreground hover:bg-muted hover:text-foreground'
  );
}

/** 회색 바탕 위 흰 도구 버튼(날짜·새로고침·초기화 등). 주 동작은 Button(primary)을 쓴다. */
export function toolbarButtonClass(tone: 'default' | 'primary' | 'danger' = 'default') {
  return cn(
    'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-card/70 disabled:opacity-50',
    tone === 'primary' ? 'text-primary' : tone === 'danger' ? 'text-destructive' : 'text-secondary-foreground hover:text-foreground'
  );
}

/** 장식색(성별·체험·시간대). 옅은 바탕 + 진한 글자라 다크 모드에서도 읽힌다. */
export const decorTone = {
  pink: 'bg-pink-500/15 text-pink-600',
  violet: 'bg-violet-500/15 text-violet-600',
  purple: 'bg-purple-500/15 text-purple-600',
} as const;
