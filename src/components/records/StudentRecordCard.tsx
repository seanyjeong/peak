'use client';

import { ChevronDown, ChevronUp, Check, Trophy } from 'lucide-react';
import { Student, RecordType, RecordInput } from './types';

interface StudentRecordCardProps {
  student: Student;
  recordTypes: RecordType[];
  inputs: { [key: number]: RecordInput };
  isExpanded: boolean;
  isSaved: boolean;
  onToggle: () => void;
  onInputChange: (recordTypeId: number, value: string) => void;
  onInputBlur: (recordTypeId: number) => void;
  getDecimalPlaces: (recordTypeId: number) => number;
  isOutOfRange?: (recordTypeId: number, value: string) => boolean;
}

export function StudentRecordCard({
  student,
  recordTypes,
  inputs,
  isExpanded,
  isSaved,
  onToggle,
  onInputChange,
  onInputBlur,
  getDecimalPlaces,
  isOutOfRange,
}: StudentRecordCardProps) {
  const inputCount = Object.values(inputs).filter(d => d.value && d.value.trim() !== '').length;
  const scores = Object.values(inputs).filter(d => d.score !== null).map(d => d.score as number);
  const totalScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) : null;
  const isAbsent = student.attendance_status === 'absent';

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-card shadow-sm transition ${
        isSaved ? 'border-success/30' : 'border-border'
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-muted"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-3">
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
          <span className={`truncate text-base font-black ${isAbsent ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{student.student_name}</span>
          {isSaved && <Check size={14} className="shrink-0 text-success" />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {inputCount > 0 && (
            <span className="rounded-md bg-success-soft px-2 py-1 text-xs font-black text-success">
              {totalScore !== null ? `${totalScore}점` : `${inputCount}개`}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {recordTypes.map(type => {
              const inputData = inputs[type.id] || { value: '', score: null };
              const decimalPlaces = getDecimalPlaces(type.id);
              const outOfRange = isOutOfRange?.(type.id, inputData.value) ?? false;

              return (
                <div key={type.id} className="relative">
                  <label className="mb-1 block truncate text-xs font-bold text-muted-foreground">
                    {type.name}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={Math.pow(10, -decimalPlaces)}
                      value={inputData.value}
                      onChange={e => onInputChange(type.id, e.target.value)}
                      onBlur={() => onInputBlur(type.id)}
                      placeholder="0"
                      className={`h-10 w-full rounded-lg border bg-card px-3 pr-12 text-sm font-semibold outline-none focus:ring-1 ${
                        outOfRange
                          ? 'border-destructive bg-destructive-soft focus:border-destructive focus:ring-destructive'
                          : 'border-border focus:border-foreground focus:ring-border'
                      }`}
                    />
                    {inputData.score !== null && (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <Trophy size={12} className="text-success" />
                        <span className="text-xs font-black text-success">{inputData.score}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
