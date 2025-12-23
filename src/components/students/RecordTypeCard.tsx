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
      onClick={onClick}
      disabled={!hasData}
      className={`text-left rounded-xl p-4 transition ${
        isSelected
          ? 'bg-orange-500 text-white ring-2 ring-orange-300'
          : hasData
            ? 'bg-slate-50 hover:bg-slate-100'
            : 'bg-slate-50 opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className={`text-xs ${isSelected ? 'text-orange-100' : 'text-slate-500'}`}>
          {type.name}
        </p>
        {hasData && (
          <BarChart3 size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
        )}
      </div>
      <div className="flex items-end justify-between">
        <p className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
          {value !== null ? value : '-'}
          <span className={`text-sm font-normal ml-1 ${isSelected ? 'text-orange-200' : 'text-slate-400'}`}>
            {type.unit}
          </span>
        </p>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            isSelected
              ? 'text-white'
              : trend.direction === 'up' ? 'text-green-600'
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
