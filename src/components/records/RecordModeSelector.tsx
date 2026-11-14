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
    <section className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInputMode('student')}
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-black transition ${
              inputMode === 'student'
                ? 'bg-foreground text-background'
                : 'border border-border bg-card text-secondary-foreground hover:bg-muted'
            }`}
          >
            <Users size={18} />
            학생별 입력
          </button>
          <button
            type="button"
            onClick={() => setInputMode('event')}
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-black transition ${
              inputMode === 'event'
                ? 'bg-foreground text-background'
                : 'border border-border bg-card text-secondary-foreground hover:bg-muted'
            }`}
          >
            <List size={18} />
            종목별 입력
          </button>
        </div>

        {inputMode === 'event' && (
          <div className="flex flex-wrap gap-2">
            {recordTypes.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedRecordType(type.id)}
                className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                  selectedRecordType === type.id
                    ? 'bg-success text-white'
                    : 'border border-border bg-card text-secondary-foreground hover:bg-muted'
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
              type="button"
              onClick={onExpandAll}
              className="h-9 rounded-lg border border-border px-3 text-sm font-bold text-secondary-foreground hover:bg-muted"
            >
              전체 펼치기
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              className="h-9 rounded-lg border border-border px-3 text-sm font-bold text-secondary-foreground hover:bg-muted"
            >
              전체 접기
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
