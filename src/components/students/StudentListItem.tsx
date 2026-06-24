'use client';

import Link from 'next/link';
import { User, ChevronRight, ExternalLink } from 'lucide-react';
import { Student, STATUS_MAP, GENDER_COLORS } from './types';

interface StudentListItemProps {
  student: Student;
  isSelected: boolean;
  onSelect: () => void;
}

export function StudentListItem({ student, isSelected, onSelect }: StudentListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between p-4 text-left transition ${
        isSelected
          ? `border-l-4 bg-emerald-50 ${(GENDER_COLORS[student.gender as keyof typeof GENDER_COLORS] ?? GENDER_COLORS['M']).border}`
          : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${(GENDER_COLORS[student.gender as keyof typeof GENDER_COLORS] ?? GENDER_COLORS['M']).icon}`}>
          <User size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-black text-slate-950">{student.name}</p>
            <Link
              href={`/students/${student.id}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200"
              title="프로필 보기"
            >
              <ExternalLink size={14} />
            </Link>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
            {student.gender === 'M' ? '남' : student.gender === 'F' ? '여' : ''}
            {student.school && ` · ${student.school}`}
            {student.grade && ` ${student.grade}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {student.status === 'trial' && (
          <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">
            체험 {student.trial_total - student.trial_remaining}/{student.trial_total}
          </span>
        )}
        <span className={`rounded-md px-2 py-1 text-xs font-bold ${STATUS_MAP[student.status]?.color ?? 'bg-slate-100 text-slate-600'}`}>
          {STATUS_MAP[student.status]?.label ?? student.status}
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </div>
    </button>
  );
}
