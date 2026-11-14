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
      className={`flex items-center gap-3 rounded-lg border bg-card px-3 py-3 shadow-sm ${
        isSaved ? 'border-success/30' : 'border-border'
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      {isAbsent ? (
        <span className="shrink-0 rounded-md bg-destructive-soft px-2 py-1 text-xs font-bold text-destructive">
          결석
        </span>
      ) : (
        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
          student.gender === 'M' ? 'bg-primary-soft text-primary' : 'bg-pink-100 text-pink-600'
        }`}>
          {student.gender === 'M' ? '남' : '여'}
        </span>
      )}
      <span className={`min-w-0 flex-1 truncate font-black ${isAbsent ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
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
            ? 'border-destructive bg-destructive-soft focus:border-destructive focus:ring-destructive'
            : 'border-border focus:border-foreground focus:ring-border'
        }`}
      />
      {inputData.score !== null ? (
        <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-success-soft px-2 py-1 text-xs font-black text-success">
          <Trophy size={12} />
          {inputData.score}
        </span>
      ) : (
        <span className="w-12 shrink-0"></span>
      )}
      {isSaved && <Check size={14} className="shrink-0 text-success" />}
    </div>
  );
}
