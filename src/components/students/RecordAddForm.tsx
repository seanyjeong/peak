'use client';

import { Calendar, Trophy, Save, RefreshCw } from 'lucide-react';
import { RecordType, RecordInput } from './types';

interface RecordAddFormProps {
  recordDate: string;
  setRecordDate: (date: string) => void;
  recordTypes: RecordType[];
  recordInputs: { [key: number]: RecordInput };
  onInputChange: (typeId: number, value: string) => void;
  onSave: () => void;
  saving: boolean;
  getDecimalPlaces: (typeId: number) => number;
}

export function RecordAddForm({
  recordDate,
  setRecordDate,
  recordTypes,
  recordInputs,
  onInputChange,
  onSave,
  saving,
  getDecimalPlaces,
}: RecordAddFormProps) {
  return (
    <div className="mb-4 rounded-xl bg-success-soft p-4">
      <div className="mb-3 flex items-center gap-2">
        <Calendar size={16} className="text-success" />
        <input
          type="date"
          value={recordDate}
          onChange={e => setRecordDate(e.target.value)}
          className="h-10 rounded-xl border border-transparent bg-card px-3 text-sm font-semibold outline-none focus:border-success"
        />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {recordTypes.map(type => {
          const inputData = recordInputs[type.id] || { value: '', score: null };
          const decimalPlaces = getDecimalPlaces(type.id);

          return (
            <div key={type.id}>
              <label className="mb-1 block text-xs font-bold text-secondary-foreground">
                {type.name} ({type.unit})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={Math.pow(10, -decimalPlaces)}
                  value={inputData.value}
                  onChange={e => onInputChange(type.id, e.target.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-transparent bg-card px-3 pr-14 text-sm font-semibold outline-none focus:border-primary"
                />
                {inputData.score !== null && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Trophy size={12} className="text-success" />
                    <span className="text-xs font-black text-success">{inputData.score}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
        저장
      </button>
    </div>
  );
}
