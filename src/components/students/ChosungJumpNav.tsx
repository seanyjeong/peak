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
                ? 'bg-primary text-white scale-110'
                : isAvailable
                  ? 'bg-muted text-secondary-foreground hover:bg-primary-soft hover:text-primary'
                  : 'bg-muted text-muted-foreground/60 cursor-default'
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
