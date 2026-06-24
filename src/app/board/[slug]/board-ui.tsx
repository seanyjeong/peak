'use client';

import type React from 'react';
import type { EventRecord, RankingItem } from './board-model';

export function SportyBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
      <div className="absolute inset-0 opacity-10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="absolute h-full border-l-2 border-white/30" style={{ left: `${20 + i * 15}%` }} />
        ))}
      </div>
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)',
          top: '-200px',
          left: '-200px',
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(236,72,153,0.5) 0%, transparent 70%)',
          bottom: '-150px',
          right: '-150px',
          animation: 'pulse 5s ease-in-out infinite reverse',
        }}
      />
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {[...Array(3)].map((_, i) => (
          <line
            key={i}
            x1="0"
            y1={`${30 + i * 20}%`}
            x2="100%"
            y2={`${35 + i * 20}%`}
            stroke="url(#lineGrad)"
            strokeWidth="2"
            style={{
              animation: `slideLine ${3 + i}s linear infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </svg>
      <div className="absolute top-10 right-20 text-[200px] opacity-5 select-none">🏆</div>
      <div className="absolute bottom-20 left-10 text-[150px] opacity-5 select-none rotate-12">🏅</div>
      <div className="absolute top-1/3 left-1/4 text-[120px] opacity-5 select-none -rotate-6">💪</div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
        @keyframes slideLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export function Card3D({
  children,
  className = '',
  glowColor = '#3b82f6',
  index = 0,
  total = 10,
  isTop3 = false,
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  index?: number;
  total?: number;
  isTop3?: boolean;
}) {
  const baseDelay = (total - 1 - index) * 0.18;
  const top3ExtraDelay = isTop3 ? 0.3 : 0;
  const delay = baseDelay + top3ExtraDelay;
  const animationDuration = isTop3 ? '1s' : '0.7s';

  return (
    <div
      className={`relative ${className}`}
      style={{
        animation: `${isTop3 ? 'cardFlipInTop3' : 'cardFlipIn'} ${animationDuration} cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s both`,
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="absolute -inset-1 rounded-2xl opacity-50 blur-xl transition-opacity" style={{ background: glowColor }} />
      {isTop3 && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ animation: `sparkBurst 0.8s ease-out ${delay + 0.3}s both` }}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: glowColor,
                  boxShadow: `0 0 10px 3px ${glowColor}`,
                  left: '50%',
                  top: '50%',
                  animation: `sparkParticle 0.6s ease-out ${delay + 0.3 + i * 0.05}s both`,
                  '--angle': `${i * 45}deg`,
                } as React.CSSProperties & Record<'--angle', string>}
              />
            ))}
          </div>
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${glowColor}80 0%, transparent 70%)`,
              animation: `flashBurst 0.5s ease-out ${delay + 0.2}s both`,
            }}
          />
        </>
      )}
      <div
        className="relative bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl rounded-xl border border-white/20 overflow-hidden hover:scale-[1.02] transition-transform duration-200"
        style={{
          boxShadow: isTop3
            ? `0 0 30px ${glowColor}60, 0 20px 40px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`
            : '0 20px 40px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        {children}
      </div>
      <style jsx>{`
        @keyframes cardFlipIn {
          0% { opacity: 0; transform: perspective(1000px) translateY(-100px) rotateX(90deg) scale(0.7); }
          60% { opacity: 1; transform: perspective(1000px) translateY(8px) rotateX(-8deg) scale(1.02); }
          80% { transform: perspective(1000px) translateY(-3px) rotateX(3deg) scale(1); }
          100% { opacity: 1; transform: perspective(1000px) translateY(0) rotateX(0) scale(1); }
        }
        @keyframes cardFlipInTop3 {
          0% { opacity: 0; transform: perspective(1000px) translateY(-150px) rotateX(180deg) scale(0.5); filter: brightness(3); }
          40% { opacity: 1; transform: perspective(1000px) translateY(20px) rotateX(-15deg) scale(1.1); filter: brightness(2); }
          60% { transform: perspective(1000px) translateY(-10px) rotateX(10deg) scale(1.05); filter: brightness(1.5); }
          80% { transform: perspective(1000px) translateY(5px) rotateX(-3deg) scale(1.02); filter: brightness(1.2); }
          100% { opacity: 1; transform: perspective(1000px) translateY(0) rotateX(0) scale(1); filter: brightness(1); }
        }
        @keyframes sparkParticle {
          0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--angle)) translateX(80px) scale(0); }
        }
        @keyframes flashBurst {
          0% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}

export function RankRow3D({ item, index, total, glowColor }: { item: RankingItem; index: number; total: number; glowColor: string }) {
  const isTop3 = item.rank <= 3;
  const rankColors = ['#fbbf24', '#9ca3af', '#cd7f32'];
  const rankBg = isTop3 ? rankColors[item.rank - 1] : 'rgba(255,255,255,0.1)';

  return (
    <Card3D glowColor={isTop3 ? rankColors[item.rank - 1] : glowColor + '20'} className="mb-1.5" index={index} total={total} isTop3={isTop3}>
      <div className="flex items-center gap-3 px-3 py-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg shadow-lg flex-shrink-0"
          style={{
            background: isTop3 ? `linear-gradient(135deg, ${rankBg}, ${rankBg}cc)` : 'rgba(255,255,255,0.1)',
            color: isTop3 ? '#000' : '#fff',
            boxShadow: isTop3 ? `0 4px 15px ${rankBg}60` : 'none',
          }}
        >
          {item.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold truncate ${isTop3 ? 'text-white text-lg' : 'text-white/90 text-base'}`}>{item.name}</div>
          {item.school && <div className="text-xs text-white/50 truncate">{item.school}</div>}
        </div>
        <div className="text-right font-black text-xl flex-shrink-0" style={{ color: isTop3 ? rankBg : '#fff' }}>
          {item.total}
          <span className="text-xs font-normal text-white/40 ml-0.5">점</span>
        </div>
      </div>
    </Card3D>
  );
}

export function EventRow3D({ record, index, total, unit, glowColor }: { record: EventRecord; index: number; total: number; unit: string; glowColor: string }) {
  const isTop3 = record.rank <= 3;
  const rankColors = ['#fbbf24', '#9ca3af', '#cd7f32'];
  const rankBg = isTop3 ? rankColors[record.rank - 1] : 'rgba(255,255,255,0.1)';

  return (
    <Card3D glowColor={isTop3 ? rankColors[record.rank - 1] : glowColor + '20'} className="mb-1.5" index={index} total={total} isTop3={isTop3}>
      <div className="flex items-center gap-3 px-3 py-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-base flex-shrink-0"
          style={{
            background: isTop3 ? `linear-gradient(135deg, ${rankBg}, ${rankBg}cc)` : 'rgba(255,255,255,0.1)',
            color: isTop3 ? '#000' : '#fff',
            boxShadow: isTop3 ? `0 4px 15px ${rankBg}60` : 'none',
          }}
        >
          {record.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold truncate ${isTop3 ? 'text-white text-base' : 'text-white/90 text-sm'}`}>{record.name}</div>
          {record.school && <div className="text-xs text-white/50 truncate">{record.school}</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-black text-lg text-white">
            {record.value}
            <span className="text-xs font-normal text-white/40 ml-0.5">{unit}</span>
          </div>
          <div className="text-xs" style={{ color: isTop3 ? rankBg : 'rgba(255,255,255,0.5)' }}>{record.score}점</div>
        </div>
      </div>
    </Card3D>
  );
}

export function GenderColumn({ title, color, children }: { title: string; color: 'blue' | 'pink'; children: React.ReactNode }) {
  const colors = {
    blue: { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)' },
    pink: { main: '#ec4899', glow: 'rgba(236, 72, 153, 0.3)' },
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-shrink-0 py-2 px-4 rounded-t-xl border-b border-white/10" style={{ background: `linear-gradient(135deg, ${colors[color].glow}, transparent)` }}>
        <h3 className="text-2xl font-black" style={{ color: colors[color].main, textShadow: `0 0 30px ${colors[color].main}` }}>{title}</h3>
      </div>
      <div className="flex-1 p-2 overflow-y-auto">{children}</div>
    </div>
  );
}
