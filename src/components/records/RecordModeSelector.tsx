'use client';

import { Users, List } from 'lucide-react';
import { InputMode, RecordType } from './types';

interface RecordModeSelectorProps {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  recordTypes: RecordType[];
  selectedRecordType: number | null;
  setSelectedRecordType: (id: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function RecordModeSelector({
  inputMode,
  setInputMode,
  recordTypes,
  selectedRecordType,
  setSelectedRecordType,
  onExpandAll,
  onCollapseAll,
}: RecordModeSelectorProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setInputMode('student')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              inputMode === 'student'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users size={18} />
            학생별 입력
          </button>
          <button
            onClick={() => setInputMode('event')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              inputMode === 'event'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <List size={18} />
            종목별 입력
          </button>
        </div>

        {inputMode === 'event' && (
          <div className="flex gap-2">
            {recordTypes.map(type => (
              <button
                key={type.id}
                onClick={() => setSelectedRecordType(type.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedRecordType === type.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type.name}
              </button>
            ))}
          </div>
        )}

        {inputMode === 'student' && (
          <div className="flex gap-2">
            <button
              onClick={onExpandAll}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1"
            >
              전체 펼치기
            </button>
            <button
              onClick={onCollapseAll}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1"
            >
              전체 접기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
