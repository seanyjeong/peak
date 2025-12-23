'use client';

import { Loader2 } from 'lucide-react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <Loader2
      className={`animate-spin text-orange-500 ${sizeStyles[size]} ${className}`}
    />
  );
}

// Full page loading spinner
export interface LoadingProps {
  text?: string;
}

export function Loading({ text = '로딩 중...' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
      <Spinner size="lg" />
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}

// Inline loading indicator
export function InlineLoading() {
  return (
    <span className="inline-flex items-center gap-2 text-slate-500 text-sm">
      <Spinner size="sm" />
      <span>로딩 중...</span>
    </span>
  );
}
