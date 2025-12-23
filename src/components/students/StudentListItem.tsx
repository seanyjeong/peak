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
      className={`p-4 flex items-center justify-between cursor-pointer transition ${
        isSelected
          ? 'bg-orange-50 border-l-4 border-orange-500'
          : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
        }`}>
          <User size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800">{student.name}</p>
            <Link
              href={`/students/${student.id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-orange-100 rounded transition"
              title="프로필 보기"
            >
              <ExternalLink size={14} className="text-orange-500" />
            </Link>
          </div>
          <p className="text-xs text-slate-400">
            {student.gender === 'M' ? '남' : '여'}
            {student.school && ` · ${student.school}`}
            {student.grade && ` ${student.grade}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!!student.is_trial && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            체험 {student.trial_total - student.trial_remaining}/{student.trial_total}
          </span>
        )}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_MAP[student.status].color}`}>
          {STATUS_MAP[student.status].label}
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </div>
    </div>
  );
}
