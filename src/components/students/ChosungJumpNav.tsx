'use client';

import { DISPLAY_CHOSUNG } from '@/lib/utils/korean';

interface ChosungJumpNavProps {
  availableChosung: Set<string>;
  activeChosung?: string;
  onJump: (chosung: string) => void;
  className?: string;
}

export function ChosungJumpNav({
  availableChosung,
  activeChosung,
  onJump,
  className = '',
}: ChosungJumpNavProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {DISPLAY_CHOSUNG.map((chosung) => {
        const isAvailable = availableChosung.has(chosung);
        const isActive = activeChosung === chosung;

        return (
          <button
            key={chosung}
            onClick={() => isAvailable && onJump(chosung)}
            disabled={!isAvailable}
            className={`
              w-7 h-7 rounded text-xs font-medium transition-all
              ${isActive
                ? 'bg-orange-500 text-white scale-110'
                : isAvailable
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-default'
              }
            `}
          >
            {chosung}
          </button>
        );
      })}
    </div>
  );
}
