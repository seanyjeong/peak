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
      className={`rounded-lg border p-4 text-left transition ${
        isSelected
          ? 'border-slate-950 bg-slate-950 text-white'
          : hasData
            ? 'border-slate-200 bg-white hover:bg-slate-50'
            : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className={`text-xs font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
          {type.name}
        </p>
        {hasData && (
          <BarChart3 size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
        )}
      </div>
      <div className="flex items-end justify-between">
        <p className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-slate-950'}`}>
          {value !== null ? value : '-'}
          <span className={`ml-1 text-sm font-semibold ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
            {type.unit}
          </span>
        </p>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            isSelected
              ? 'text-white'
              : trend.direction === 'up' ? 'text-emerald-600'
              : trend.direction === 'down' ? 'text-red-600'
              : 'text-slate-400'
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
