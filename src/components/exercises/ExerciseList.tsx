'use client';

import { Dumbbell, Edit2, Trash2 } from 'lucide-react';
import { Exercise, ExerciseTag } from './types';

interface ExerciseListProps {
  exercises: Exercise[];
  tags: ExerciseTag[];
  onEdit: (exercise: Exercise) => void;
  onDelete: (id: number) => void;
}

export function ExerciseList({ exercises, tags, onEdit, onDelete }: ExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-12 text-center">
        <Dumbbell size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400">등록된 운동이 없습니다.</p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">운동 추가 버튼을 눌러 만들어보세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {exercises.map(exercise => (
          <div key={exercise.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium text-slate-800 dark:text-slate-100">{exercise.name}</h4>
                  {(exercise.default_sets || exercise.default_reps) && (
                    <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                      {exercise.default_sets && `${exercise.default_sets}세트`}
                      {exercise.default_sets && exercise.default_reps && ' × '}
                      {exercise.default_reps && `${exercise.default_reps}회`}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {exercise.tags.map(tagId => {
                    const tag = tags.find(t => t.tag_id === tagId);
                    return tag ? (
                      <span
                        key={tagId}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${tag.color}`}
                      >
                        {tag.label}
                      </span>
                    ) : null;
                  })}
                  {exercise.tags.length === 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">태그 없음</span>
                  )}
                </div>
                {exercise.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{exercise.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(exercise)}
                  className="p-2 text-slate-400 hover:text-orange-500 dark:text-slate-500 dark:hover:text-orange-400"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(exercise.id)}
                  className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
