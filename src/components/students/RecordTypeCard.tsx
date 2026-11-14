'use client';

import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { RecordType } from './types';

interface RecordTypeCardProps {
  type: RecordType;
  value: number | null;
  trend: { direction: string; diff: number } | null;
  isSelected: boolean;
  hasData: boolean;
  onClick: () => void;
}

export function RecordTypeCard({ type, value, trend, isSelected, hasData, onClick }: RecordTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!hasData}
      className={`rounded-xl p-4 text-left transition ${
        isSelected
          ? 'bg-foreground text-background'
          : hasData
            ? 'bg-muted hover:bg-border'
            : 'cursor-not-allowed bg-muted opacity-50'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className={`text-xs font-semibold ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>
          {type.name}
        </p>
        {hasData && (
          <BarChart3 size={14} className={isSelected ? 'text-background' : 'text-muted-foreground'} />
        )}
      </div>
      <div className="flex items-end justify-between">
        <p className={`text-2xl font-extrabold tabular-nums ${isSelected ? 'text-background' : 'text-foreground'}`}>
          {value !== null ? value : '-'}
          <span className={`ml-1 text-sm font-semibold ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>
            {type.unit}
          </span>
        </p>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            isSelected
              ? 'text-background'
              : trend.direction === 'up' ? 'text-success'
              : trend.direction === 'down' ? 'text-destructive'
              : 'text-muted-foreground'
          }`}>
            {trend.direction === 'up' && <TrendingUp size={16} />}
            {trend.direction === 'down' && <TrendingDown size={16} />}
            {trend.direction === 'same' && <Minus size={16} />}
            {trend.diff !== 0 && <span>{trend.diff.toFixed(1)}</span>}
          </div>
        )}
      </div>
    </button>
  );
}
