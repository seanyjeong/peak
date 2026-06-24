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
      className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
        isSaved ? 'border-emerald-300' : 'border-slate-200'
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-3">
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
          <span className={`truncate text-base font-black ${isAbsent ? 'text-slate-400 line-through' : 'text-slate-950'}`}>{student.student_name}</span>
          {isSaved && <Check size={14} className="shrink-0 text-emerald-600" />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {inputCount > 0 && (
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">
              {totalScore !== null ? `${totalScore}점` : `${inputCount}개`}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-slate-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {recordTypes.map(type => {
              const inputData = inputs[type.id] || { value: '', score: null };
              const decimalPlaces = getDecimalPlaces(type.id);
              const outOfRange = isOutOfRange?.(type.id, inputData.value) ?? false;

              return (
                <div key={type.id} className="relative">
                  <label className="mb-1 block truncate text-xs font-bold text-slate-500">
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
                      className={`h-10 w-full rounded-lg border bg-white px-3 pr-12 text-sm font-semibold outline-none focus:ring-1 ${
                        outOfRange
                          ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-slate-200'
                      }`}
                    />
                    {inputData.score !== null && (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <Trophy size={12} className="text-emerald-600" />
                        <span className="text-xs font-black text-emerald-700">{inputData.score}</span>
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
