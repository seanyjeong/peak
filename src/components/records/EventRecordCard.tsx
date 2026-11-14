'use client';

import { Trophy, Check } from 'lucide-react';
import { Student, RecordInput } from './types';
import { decorTone } from '@/components/ui/page';

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
      className={`flex items-center gap-3 rounded-2xl bg-card px-4 py-3 ${
        isSaved ? 'ring-1 ring-inset ring-success/40' : ''
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      {isAbsent ? (
        <span className="shrink-0 rounded-md bg-destructive-soft px-2 py-1 text-xs font-bold text-destructive">
          결석
        </span>
      ) : (
        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
          student.gender === 'M' ? 'bg-primary-soft text-primary' : decorTone.pink
        }`}>
          {student.gender === 'M' ? '남' : '여'}
        </span>
      )}
      <span className={`min-w-0 flex-1 truncate text-[15px] font-bold ${isAbsent ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
        {student.student_name}
      </span>
      <input
        type="number"
        step={Math.pow(10, -decimalPlaces)}
        value={inputData.value}
        onChange={e => onInputChange(e.target.value)}
        onBlur={onInputBlur}
        placeholder="0"
        className={`h-11 w-24 shrink-0 rounded-xl border px-3 text-center text-[15px] font-semibold tabular-nums outline-none transition focus:ring-4 ${
          isOutOfRange
            ? 'border-destructive bg-destructive-soft focus:ring-destructive/15'
            : 'border-transparent bg-muted focus:border-primary focus:ring-primary/10'
        }`}
      />
      {inputData.score !== null ? (
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold tabular-nums text-success">
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
