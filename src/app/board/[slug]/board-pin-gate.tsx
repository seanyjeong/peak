'use client';

import { FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';

interface BoardPinGateProps {
  academyName?: string;
  error?: string | null;
  pin: string;
  submitting: boolean;
  onPinChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function BoardPinGate({
  academyName,
  error,
  pin,
  submitting,
  onPinChange,
  onSubmit,
}: BoardPinGateProps) {
  return (
    <div className="min-h-screen bg-[#0a0a12] px-6 text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
        <form onSubmit={onSubmit} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
              <LockKeyhole className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-black">{academyName || '전광판'}</h1>
              <p className="mt-1 text-sm font-semibold text-white/50">PIN 확인 후 전광판을 볼 수 있습니다.</p>
            </div>
          </div>
          <label className="block text-sm font-bold text-white/70">
            전광판 PIN
            <input
              autoFocus
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-lg font-black tracking-widest text-white outline-none focus:border-white/40"
              inputMode="numeric"
              maxLength={12}
              onChange={(event) => onPinChange(event.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="숫자 4~12자리"
              type="password"
              value={pin}
            />
          </label>
          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{error}</p>}
          <button
            className="mt-5 h-11 w-full rounded-xl bg-white text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:opacity-50"
            disabled={submitting}
            type="submit"
          >
            {submitting ? '확인 중' : '전광판 열기'}
          </button>
        </form>
      </div>
    </div>
  );
}
