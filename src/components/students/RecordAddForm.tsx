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
    <div className="bg-orange-50 rounded-xl p-4 mb-4 border border-orange-200">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={16} className="text-orange-500" />
        <input
          type="date"
          value={recordDate}
          onChange={e => setRecordDate(e.target.value)}
          className="px-2 py-1 border border-orange-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {recordTypes.map(type => {
          const inputData = recordInputs[type.id] || { value: '', score: null };
          const decimalPlaces = getDecimalPlaces(type.id);

          return (
            <div key={type.id}>
              <label className="block text-xs text-slate-600 mb-1">
                {type.name} ({type.unit})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={Math.pow(10, -decimalPlaces)}
                  value={inputData.value}
                  onChange={e => onInputChange(type.id, e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 pr-14 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                />
                {inputData.score !== null && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Trophy size={12} className="text-orange-500" />
                    <span className="text-xs font-bold text-orange-600">{inputData.score}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
      >
        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
        저장
      </button>
    </div>
  );
}
