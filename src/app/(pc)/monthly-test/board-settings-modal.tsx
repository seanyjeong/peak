'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export type SlugCheckState = {
  status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';
  message: string;
};

interface BoardSettingsModalProps {
  clearBoardPin: boolean;
  currentSlug: string;
  hasBoardPin: boolean;
  onCheckSlug: () => void;
  onClearBoardPinChange: (value: boolean) => void;
  onClose: () => void;
  onPinChange: (value: string) => void;
  onSave: () => void;
  open: boolean;
  pinInput: string;
  saving: boolean;
  slugCheck: SlugCheckState;
  slugInput: string;
  setSlugInput: (value: string) => void;
}

export function BoardSettingsModal({
  clearBoardPin,
  currentSlug,
  hasBoardPin,
  onCheckSlug,
  onClearBoardPinChange,
  onClose,
  onPinChange,
  onSave,
  open,
  pinInput,
  saving,
  slugCheck,
  slugInput,
  setSlugInput,
}: BoardSettingsModalProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Modal isOpen={open} onClose={onClose} title="전광판 설정">
      <div className="space-y-4">
        <label className="block text-sm font-bold text-slate-700">
          전광판 주소
          <div className="mt-2 flex items-center rounded-lg border border-slate-200 bg-white px-3">
            <span className="text-sm font-semibold text-slate-400">/board/</span>
            <input
              className="h-10 min-w-0 flex-1 bg-transparent px-1 font-mono outline-none"
              onChange={(event) => setSlugInput(event.target.value)}
              placeholder="ilsanmax"
              value={slugInput}
            />
            <button
              className="ml-2 h-8 rounded-md border border-slate-200 px-3 text-xs font-black text-slate-700 disabled:opacity-50"
              disabled={slugCheck.status === 'checking'}
              onClick={onCheckSlug}
              type="button"
            >
              {slugCheck.status === 'checking' ? '확인 중' : '중복확인'}
            </button>
          </div>
        </label>
        {slugCheck.message && (
          <StatusMessage status={slugCheck.status} message={slugCheck.message} />
        )}
        {currentSlug && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            <p>{origin}/board/{currentSlug}</p>
            <p className="mt-1">{origin}/board/{currentSlug}/scores</p>
          </div>
        )}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-800">전광판 PIN</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {hasBoardPin ? '현재 PIN이 설정되어 있습니다.' : '현재 PIN이 없습니다.'}
              </p>
            </div>
            {hasBoardPin && (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  checked={clearBoardPin}
                  className="size-4 rounded border-slate-300"
                  onChange={(event) => onClearBoardPinChange(event.target.checked)}
                  type="checkbox"
                />
                PIN 해제
              </label>
            )}
          </div>
          {!clearBoardPin && (
            <input
              className="mt-3 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono outline-none focus:border-slate-900"
              inputMode="numeric"
              maxLength={12}
              onChange={(event) => onPinChange(event.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder={hasBoardPin ? '새 PIN 입력 시 변경됩니다' : '숫자 4~12자리'}
              type="password"
              value={pinInput}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">취소</button>
          <button type="button" onClick={onSave} disabled={saving} className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StatusMessage({ status, message }: { status: SlugCheckState['status']; message: string }) {
  const isGood = status === 'available';
  const isChecking = status === 'checking';
  const Icon = isChecking ? Loader2 : isGood ? CheckCircle2 : XCircle;

  return (
    <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      <Icon className={`size-4 ${isChecking ? 'animate-spin' : ''}`} />
      {message}
    </p>
  );
}
