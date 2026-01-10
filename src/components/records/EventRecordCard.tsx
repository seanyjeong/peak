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
}

export function EventRecordCard({
  student,
  inputData,
  decimalPlaces,
  isSaved,
  onInputChange,
  onInputBlur,
}: EventRecordCardProps) {
  const isAbsent = student.attendance_status === 'absent';

  return (
    <div
      className={`bg-white rounded-lg shadow-sm px-3 py-2 flex items-center gap-2 ${
        isSaved ? 'ring-2 ring-green-400' : ''
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      {isAbsent ? (
        <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 bg-red-100 text-red-600">
          결석
        </span>
      ) : (
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
          student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
        }`}>
          {student.gender === 'M' ? '남' : '여'}
        </span>
      )}
      <span className={`font-medium truncate min-w-0 flex-shrink ${isAbsent ? 'line-through text-slate-400' : 'text-slate-800'}`}>
        {student.student_name}
      </span>
      <input
        type="number"
        step={Math.pow(10, -decimalPlaces)}
        value={inputData.value}
        onChange={e => onInputChange(e.target.value)}
        onBlur={onInputBlur}
        placeholder="0"
        className="w-20 px-2 py-1 text-sm border border-slate-200 rounded text-center focus:ring-1 focus:ring-orange-500 flex-shrink-0"
      />
      {inputData.score !== null ? (
        <span className="flex items-center gap-0.5 text-xs text-orange-600 font-bold flex-shrink-0">
          <Trophy size={12} />
          {inputData.score}
        </span>
      ) : (
        <span className="w-8 flex-shrink-0"></span>
      )}
      {isSaved && <Check size={14} className="text-green-500 flex-shrink-0" />}
    </div>
  );
}
