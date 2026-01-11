'use client';

import Link from 'next/link';
import { User, ChevronRight, ExternalLink } from 'lucide-react';
import { Student, STATUS_MAP } from './types';

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
          ? 'bg-slate-50 border-l-4 border-slate-900'
          : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          student.gender === 'M' ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'
        }`}>
          <User size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{student.name}</p>
            <Link
              href={`/students/${student.id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-slate-200 rounded transition"
              title="프로필 보기"
            >
              <ExternalLink size={14} className="text-slate-600" />
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {student.gender === 'M' ? '남' : '여'}
            {student.school && ` · ${student.school}`}
            {student.grade && ` ${student.grade}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!!student.is_trial && (
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
            체험 {student.trial_total - student.trial_remaining}/{student.trial_total}
          </span>
        )}
        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${STATUS_MAP[student.status].color}`}>
          {STATUS_MAP[student.status].label}
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </div>
    </div>
  );
}
