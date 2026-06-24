import type { ReactNode } from 'react';
import { Crown, Star } from 'lucide-react';
import { TIME_SLOT_INFO, formatDateKorean, type TimeSlot } from './assignments-model';

export function ResetConfirmModal({
  activeSlot,
  date,
  resetting,
  onCancel,
  onConfirm,
}: {
  activeSlot: TimeSlot;
  date: string;
  resetting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-md rounded-md bg-white p-6 shadow-xl dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">반 배치 초기화</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {formatDateKorean(date)} <span className="font-semibold text-orange-600">{TIME_SLOT_INFO[activeSlot].label}</span> 시간대의 배치를 초기화합니다.
          학생은 대기 영역으로 이동되고, 생성된 반은 삭제됩니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={resetting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-md rounded-md bg-white p-6 shadow-xl dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">프리셋 적용</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-indigo-600">{presetName}</span> 프리셋을 적용합니다.
          현재 {TIME_SLOT_INFO[activeSlot].label} 배치가 초기화된 뒤 프리셋 기준으로 다시 배정됩니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
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
    <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-slate-500 dark:text-slate-400">
      <LegendItem marker={<span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">남</span>} label="남학생" />
      <LegendItem marker={<span className="rounded bg-pink-100 px-1.5 py-0.5 text-xs text-pink-700">여</span>} label="여학생" />
      <LegendItem marker={<span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] text-purple-700">1/2</span>} label="체험 횟수" />
      <LegendItem marker={<span className="rounded bg-red-100 px-1 py-0.5 text-[9px] text-red-600">결석</span>} label="결석 학생" />
      <LegendItem marker={<Star size={12} className="fill-orange-500 text-orange-500" />} label="주강사" />
      <LegendItem marker={<Crown size={12} className="text-amber-500" />} label="원장" />
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
