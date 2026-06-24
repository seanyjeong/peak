'use client';

import { Trophy, Check } from 'lucide-react';
import { Student, RecordInput } from './types';

interface EventRecordCardProps {
  student: Student;
  recordTypeId: number;
  inputData: RecordInput;
  decimalPlaces: number;
  isSaved: boolean;
  onInputChange: (value: string) => void;
  onInputBlur: () => void;
  isOutOfRange?: boolean;
}

export function EventRecordCard({
  student,
  inputData,
  decimalPlaces,
  isSaved,
  onInputChange,
  onInputBlur,
  isOutOfRange,
}: EventRecordCardProps) {
  const isAbsent = student.attendance_status === 'absent';

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-white px-3 py-3 shadow-sm ${
        isSaved ? 'border-emerald-300' : 'border-slate-200'
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      {isAbsent ? (
        <span className="shrink-0 rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-600">
          결석
        </span>
      ) : (
        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
          student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
        }`}>
          {student.gender === 'M' ? '남' : '여'}
        </span>
      )}
      <span className={`min-w-0 flex-1 truncate font-black ${isAbsent ? 'text-slate-400 line-through' : 'text-slate-950'}`}>
        {student.student_name}
      </span>
      <input
        type="number"
        step={Math.pow(10, -decimalPlaces)}
        value={inputData.value}
        onChange={e => onInputChange(e.target.value)}
        onBlur={onInputBlur}
        placeholder="0"
        className={`h-10 w-24 shrink-0 rounded-lg border px-3 text-center text-sm font-semibold outline-none focus:ring-1 ${
          isOutOfRange
            ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-200'
        }`}
      />
      {inputData.score !== null ? (
        <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">
          <Trophy size={12} />
          {inputData.score}
        </span>
      ) : (
        <span className="w-12 shrink-0"></span>
      )}
      {isSaved && <Check size={14} className="shrink-0 text-emerald-600" />}
    </div>
  );
}
