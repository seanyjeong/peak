'use client';

import { X, Save } from 'lucide-react';
import { Exercise, ExerciseTag, ExerciseFormData } from './types';

interface ExerciseFormProps {
  form: ExerciseFormData;
  setForm: (form: ExerciseFormData) => void;
  tags: ExerciseTag[];
  editingExercise: Exercise | null;
  onSave: () => void;
  onClose: () => void;
}

export function ExerciseForm({
  form,
  setForm,
  tags,
  editingExercise,
  onSave,
  onClose,
}: ExerciseFormProps) {
  const toggleTag = (tagId: string) => {
    setForm({
      ...form,
      tags: form.tags.includes(tagId)
        ? form.tags.filter(t => t !== tagId)
        : [...form.tags, tagId]
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          {editingExercise ? '운동 수정' : '새 운동 추가'}
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">운동명</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="박스점프, 메디신볼 던지기..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">기본 세트</label>
              <input
                type="number"
                value={form.default_sets}
                onChange={e => setForm({ ...form, default_sets: e.target.value })}
                placeholder="3"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">기본 횟수</label>
              <input
                type="number"
                value={form.default_reps}
                onChange={e => setForm({ ...form, default_reps: e.target.value })}
                placeholder="10"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">태그 선택</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.tag_id}
                type="button"
                onClick={() => toggleTag(tag.tag_id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  form.tags.includes(tag.tag_id)
                    ? tag.color
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">설명 (선택)</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="운동 방법이나 주의사항..."
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
        >
          취소
        </button>
        <button
          onClick={onSave}
          disabled={!form.name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          저장
        </button>
      </div>
    </div>
  );
}
