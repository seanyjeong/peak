'use client';

import { X, Package } from 'lucide-react';
import { ExercisePack } from './types';

interface PackApplyModalProps {
  packs: ExercisePack[];
  applying: boolean;
  onApply: (packId: number, packName: string) => void;
  onClose: () => void;
}

export function PackApplyModal({ packs, applying, onApply, onClose }: PackApplyModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">팩 불러오기</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-4">
          팩을 불러오면 현재 운동 목록이 모두 삭제되고 선택한 팩의 운동으로 대체됩니다.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {packs.map(pack => (
            <button
              key={pack.id}
              onClick={() => onApply(pack.id, pack.name)}
              disabled={applying}
              className="w-full text-left p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-purple-300 transition disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-800">{pack.name}</h4>
                  <p className="text-sm text-slate-500">
                    {pack.exercise_count}개 운동 · {pack.author}
                  </p>
                  {pack.description && (
                    <p className="text-xs text-slate-400 mt-1">{pack.description}</p>
                  )}
                </div>
                <Package size={20} className="text-purple-400" />
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
