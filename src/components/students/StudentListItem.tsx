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
      className={`flex w-full items-center justify-between px-5 py-3.5 text-left transition ${
        isSelected
          ? `border-l-4 bg-muted ${(GENDER_COLORS[student.gender as keyof typeof GENDER_COLORS] ?? GENDER_COLORS['M']).border}`
          : 'hover:bg-muted/60'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${(GENDER_COLORS[student.gender as keyof typeof GENDER_COLORS] ?? GENDER_COLORS['M']).icon}`}>
          <User size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-foreground">{student.name}</p>
            <Link
              href={`/students/${student.id}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-border"
              title="프로필 보기"
            >
              <ExternalLink size={14} />
            </Link>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {student.gender === 'M' ? '남' : student.gender === 'F' ? '여' : '성별 입력 필요'}
            {student.school && ` · ${student.school}`}
            {student.grade && ` ${student.grade}`}
            {student.branch_name && ` · ${student.branch_name}${student.class_name ? ` ${student.class_name}` : ''}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {student.status === 'trial' && (
          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-600">
            체험 {student.trial_total - student.trial_remaining}/{student.trial_total}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_MAP[student.status]?.color ?? 'bg-muted text-secondary-foreground'}`}>
          {STATUS_MAP[student.status]?.label ?? student.status}
        </span>
        <ChevronRight size={18} className="text-muted-foreground/60" />
      </div>
    </button>
  );
}
