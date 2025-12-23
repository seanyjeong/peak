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
}: StudentRecordCardProps) {
  const inputCount = Object.values(inputs).filter(d => d.value && d.value.trim() !== '').length;
  const scores = Object.values(inputs).filter(d => d.score !== null).map(d => d.score as number);
  const totalScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) : null;

  return (
    <div
      className={`bg-white rounded-lg shadow-sm overflow-hidden transition ${
        isSaved ? 'ring-2 ring-green-400' : ''
      }`}
    >
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
            student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
          }`}>
            {student.gender === 'M' ? '남' : '여'}
          </span>
          <span className="font-medium text-slate-800 truncate">{student.student_name}</span>
          {isSaved && <Check size={14} className="text-green-500 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {inputCount > 0 && (
            <span className="text-xs text-orange-500 font-medium">
              {totalScore !== null ? `${totalScore}점` : `${inputCount}개`}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-slate-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 px-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            {recordTypes.map(type => {
              const inputData = inputs[type.id] || { value: '', score: null };
              const decimalPlaces = getDecimalPlaces(type.id);

              return (
                <div key={type.id} className="relative">
                  <label className="block text-xs text-slate-500 mb-0.5 truncate">
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
                      className="w-full px-2 py-1.5 pr-12 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    {inputData.score !== null && (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <Trophy size={12} className="text-orange-500" />
                        <span className="text-xs font-bold text-orange-600">{inputData.score}</span>
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
