'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';

interface ReorderButtonsProps {
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { btn: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { btn: 'w-10 h-10', icon: 'w-5 h-5' },
  lg: { btn: 'w-12 h-12', icon: 'w-6 h-6' },
};

export function ReorderButtons({
  index,
  total,
  onMoveUp,
  onMoveDown,
  size = 'lg',
  className = '',
}: ReorderButtonsProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const s = SIZES[size];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        aria-label="위로 이동"
        className={`${s.btn} flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
      >
        <ChevronUp className={`${s.icon} text-foreground`} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        aria-label="아래로 이동"
        className={`${s.btn} flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
      >
        <ChevronDown className={`${s.icon} text-foreground`} />
      </button>
    </div>
  );
}
