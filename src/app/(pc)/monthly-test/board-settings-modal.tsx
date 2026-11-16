'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BOARD_THEMES } from '@/app/board/[slug]/board-model';
import { BoardThemePreview } from '@/app/board/[slug]/board-ui';

export type SlugCheckState = {
  status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';
  message: string;
};

interface BoardSettingsModalProps {
  academyName: string;
  boardTheme: number;
  clearBoardPin: boolean;
  currentSlug: string;
  hasBoardPin: boolean;
  onBoardThemeChange: (value: number) => void;
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
  academyName,
  boardTheme,
  clearBoardPin,
  currentSlug,
  hasBoardPin,
  onBoardThemeChange,
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
  const selectedTheme = BOARD_THEMES.find((theme) => theme.id === boardTheme) ?? BOARD_THEMES[0];

  return (
    <Modal isOpen={open} onClose={onClose} title="전광판 설정" size="xl">
      <div className="space-y-4">
        <label className="block text-sm font-bold text-secondary-foreground">
          전광판 주소
          <div className="mt-2 flex items-center rounded-lg border border-border bg-card px-3">
            <span className="text-sm font-semibold text-muted-foreground">/board/</span>
            <input
              className="h-10 min-w-0 flex-1 bg-transparent px-1 font-mono outline-none"
              onChange={(event) => setSlugInput(event.target.value)}
              placeholder="ilsanmax"
              value={slugInput}
            />
            <button
              className="ml-2 h-8 rounded-md border border-border px-3 text-xs font-black text-secondary-foreground disabled:opacity-50"
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
          <div className="rounded-lg bg-muted p-3 text-sm font-semibold text-secondary-foreground">
            <p>{origin}/board/{currentSlug}</p>
            <p className="mt-1">{origin}/board/{currentSlug}/scores</p>
          </div>
        )}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-foreground">전광판 테마</p>
            {currentSlug && (
              <a
                className="text-xs font-bold text-primary"
                href={`/board/${currentSlug}?theme=${boardTheme}`}
                rel="noreferrer"
                target="_blank"
              >
                실제 전광판으로 미리보기
              </a>
            )}
          </div>
          <BoardThemePreview
            academyName={academyName}
            className="mt-3 aspect-video w-full rounded-lg"
            theme={boardTheme}
          />
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {selectedTheme.name} · {selectedTheme.description} (학생 이름은 예시)
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="전광판 테마">
            {BOARD_THEMES.map((theme) => (
              <button
                aria-checked={theme.id === boardTheme}
                className={`flex flex-col items-stretch gap-1 rounded-lg border p-1 text-left ${theme.id === boardTheme ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                key={theme.id}
                onClick={() => onBoardThemeChange(theme.id)}
                role="radio"
                type="button"
              >
                <BoardThemePreview academyName={academyName} className="pointer-events-none aspect-video w-full rounded" theme={theme.id} />
                <span className="px-0.5 text-[11px] font-bold leading-tight text-secondary-foreground">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-foreground">전광판 PIN</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {hasBoardPin ? '현재 PIN이 설정되어 있습니다.' : '현재 PIN이 없습니다.'}
              </p>
            </div>
            {hasBoardPin && (
              <label className="flex items-center gap-2 text-xs font-bold text-secondary-foreground">
                <input
                  checked={clearBoardPin}
                  className="size-4 rounded border-border"
                  onChange={(event) => onClearBoardPinChange(event.target.checked)}
                  type="checkbox"
                />
                PIN 해제
              </label>
            )}
          </div>
          {!clearBoardPin && (
            <input
              className="mt-3 h-10 w-full rounded-xl border border-transparent px-3 font-mono outline-none focus:border-primary bg-muted"
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
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-border px-4 text-sm font-bold text-secondary-foreground">취소</button>
          <button type="button" onClick={onSave} disabled={saving} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
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
    <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${isGood ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive'}`}>
      <Icon className={`size-4 ${isChecking ? 'animate-spin' : ''}`} />
      {message}
    </p>
  );
}
