'use client';

import type { MobileInstructorOption } from '../_lib/class-scope';

interface MobileInstructorFilterProps {
  options: MobileInstructorOption[];
  selectedInstructorId: number | null;
  visible: boolean;
  onChange: (instructorId: number | null) => void;
}

export function MobileInstructorFilter({
  options,
  selectedInstructorId,
  visible,
  onChange,
}: MobileInstructorFilterProps) {
  if (!visible || options.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-label="강사 필터">
      <label htmlFor="mobile-instructor-filter" className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        보기 범위
      </label>
      <select
        id="mobile-instructor-filter"
        aria-label="강사별 보기"
        value={selectedInstructorId ?? ''}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
      >
        <option value="">전체 보기</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}{option.isOwner ? ' (원장)' : ''}
          </option>
        ))}
      </select>
    </section>
  );
}
