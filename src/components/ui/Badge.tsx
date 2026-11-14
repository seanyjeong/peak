'use client';

import { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'pink' | 'blue';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const variantStyles = {
  default: 'bg-muted text-secondary-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-primary-soft text-primary',
  purple: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  pink: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300',
  blue: 'bg-primary-soft text-primary',
};

const sizeStyles = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center
        font-semibold rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// Gender Badge convenience component
export function GenderBadge({ gender }: { gender: 'M' | 'F' }) {
  return (
    <Badge variant={gender === 'M' ? 'blue' : 'pink'} size="sm">
      {gender === 'M' ? '남' : '여'}
    </Badge>
  );
}

// Status Badge convenience component
export type StudentStatus = 'enrolled' | 'trial' | 'rest' | 'injury';

const statusConfig: Record<StudentStatus, { label: string; variant: BadgeProps['variant'] }> = {
  enrolled: { label: '등록', variant: 'success' },
  trial: { label: '체험', variant: 'purple' },
  rest: { label: '휴원', variant: 'warning' },
  injury: { label: '부상', variant: 'danger' },
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} size="sm">
      {config.label}
    </Badge>
  );
}

// Trial Badge convenience component
export function TrialBadge({ completed, total }: { completed: number; total: number }) {
  return (
    <Badge variant="purple" size="xs">
      {completed}/{total}
    </Badge>
  );
}
