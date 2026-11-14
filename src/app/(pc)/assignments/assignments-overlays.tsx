import type { ReactNode } from 'react';
import { Crown, Star } from 'lucide-react';
import { decorTone } from '@/components/ui/page';
import { TIME_SLOT_INFO, formatDateKorean, type TimeSlot } from './assignments-model';

export function ResetConfirmModal({
  activeSlot,
  branchName,
  date,
  hasBranches,
  resetting,
  onCancel,
  onConfirm,
}: {
  activeSlot: TimeSlot;
  branchName: string | null;
  date: string;
  hasBranches: boolean;
  resetting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-[0_16px_48px_rgba(0,0,0,0.16)] sm:mx-4 sm:rounded-3xl sm:pb-6">
        <h3 className="text-xl font-bold tracking-tight text-foreground">반 배치 초기화</h3>
        <p className="mt-3 text-sm leading-6 text-secondary-foreground">
          {formatDateKorean(date)} <span className="font-semibold text-primary">{TIME_SLOT_INFO[activeSlot].label}</span> 시간대의
          {branchName ? (
            <> <span className="font-semibold text-primary">{branchName}</span> 지점 배치만 초기화합니다. 다른 지점 반은 그대로입니다.</>
          ) : hasBranches ? (
            <> <span className="font-semibold text-primary">모든 지점</span> 배치를 초기화합니다.</>
          ) : (
            <> 배치를 초기화합니다.</>
          )}
          {' '}학생은 대기 영역으로 이동되고, 생성된 반은 삭제됩니다.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="h-11 rounded-xl bg-secondary px-4 text-[15px] font-semibold text-secondary-foreground transition hover:bg-secondary/70"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={resetting}
            className="h-11 rounded-xl bg-destructive px-4 text-[15px] font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
          >
            {resetting ? '초기화 중...' : '초기화'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PresetConfirmModal({
  activeSlot,
  presetName,
  onCancel,
  onConfirm,
}: {
  activeSlot: TimeSlot;
  presetName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-[0_16px_48px_rgba(0,0,0,0.16)] sm:mx-4 sm:rounded-3xl sm:pb-6">
        <h3 className="text-xl font-bold tracking-tight text-foreground">프리셋 적용</h3>
        <p className="mt-3 text-sm leading-6 text-secondary-foreground">
          <span className="font-semibold text-primary">{presetName}</span> 프리셋을 적용합니다.
          현재 {TIME_SLOT_INFO[activeSlot].label} 배치가 초기화된 뒤 프리셋 기준으로 다시 배정됩니다.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="h-11 rounded-xl bg-secondary px-4 text-[15px] font-semibold text-secondary-foreground transition hover:bg-secondary/70"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="h-11 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssignmentLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-[13px] text-muted-foreground">
      <LegendItem marker={<span className="rounded bg-primary-soft px-1.5 py-0.5 text-xs text-primary">남</span>} label="남학생" />
      <LegendItem marker={<span className={`rounded px-1.5 py-0.5 text-xs ${decorTone.pink}`}>여</span>} label="여학생" />
      <LegendItem marker={<span className={`rounded px-1 py-0.5 text-[10px] ${decorTone.purple}`}>1/2</span>} label="체험 횟수" />
      <LegendItem marker={<span className="rounded bg-destructive-soft px-1 py-0.5 text-[10px] text-destructive">결석</span>} label="결석 학생" />
      <LegendItem marker={<Star size={12} className="fill-primary text-primary" />} label="주강사" />
      <LegendItem marker={<Crown size={12} className="text-warning" />} label="원장" />
    </div>
  );
}

function LegendItem({ marker, label }: { marker: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {marker}
      <span>{label}</span>
    </div>
  );
}
