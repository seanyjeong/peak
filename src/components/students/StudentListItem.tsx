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
    <div
      onClick={onSelect}
      className={`p-5 flex items-center justify-between cursor-pointer transition ${
        isSelected
          ? `bg-slate-50 dark:bg-slate-700 border-l-4 ${(GENDER_COLORS[student.gender as keyof typeof GENDER_COLORS] ?? GENDER_COLORS['M']).border}`
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${(GENDER_COLORS[student.gender as keyof typeof GENDER_COLORS] ?? GENDER_COLORS['M']).icon}`}>
          <User size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 dark:text-slate-100">{student.name}</p>
            <Link
              href={`/students/${student.id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition"
              title="프로필 보기"
            >
              <ExternalLink size={14} className="text-slate-600 dark:text-slate-400" />
            </Link>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {student.gender === 'M' ? '남' : student.gender === 'F' ? '여' : ''}
            {student.school && ` · ${student.school}`}
            {student.grade && ` ${student.grade}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {student.status === 'trial' && (
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            체험 {student.trial_total - student.trial_remaining}/{student.trial_total}
          </span>
        )}
        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${STATUS_MAP[student.status]?.color ?? 'bg-slate-100 text-slate-600'}`}>
          {STATUS_MAP[student.status]?.label ?? student.status}
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </div>
    </div>
  );
}
