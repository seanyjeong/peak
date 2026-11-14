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
      <div className="bg-card rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">팩 불러오기</h3>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-secondary-foreground"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-warning bg-warning-soft px-3 py-2 rounded-lg mb-4">
          팩을 불러오면 현재 운동 목록이 모두 삭제되고 선택한 팩의 운동으로 대체됩니다.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {packs.map(pack => (
            <button
              key={pack.id}
              onClick={() => onApply(pack.id, pack.name)}
              disabled={applying}
              className="w-full text-left p-4 border border-border rounded-lg hover:bg-muted hover:border-purple-300 dark:hover:border-purple-600 transition disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">{pack.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {pack.exercise_count}개 운동 · {pack.author}
                  </p>
                  {pack.description && (
                    <p className="text-xs text-muted-foreground mt-1">{pack.description}</p>
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
            className="h-10 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
