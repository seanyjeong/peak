'use client';

import { Users, List } from 'lucide-react';
import { InputMode, RecordType } from './types';
import { chipClass } from '@/components/ui/page';

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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setInputMode('student')}
            className={`flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
              inputMode === 'student'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users size={18} />
            학생별 입력
          </button>
          <button
            type="button"
            onClick={() => setInputMode('event')}
            className={`flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
              inputMode === 'event'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
                aria-pressed={selectedRecordType === type.id}
                className={chipClass(selectedRecordType === type.id, 'card')}
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
              className="h-9 rounded-xl bg-muted px-3 text-sm font-semibold text-secondary-foreground transition hover:bg-border hover:text-foreground"
            >
              전체 펼치기
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              className="h-9 rounded-xl bg-muted px-3 text-sm font-semibold text-secondary-foreground transition hover:bg-border hover:text-foreground"
            >
              전체 접기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
