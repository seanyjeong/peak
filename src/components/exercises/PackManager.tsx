'use client';

import { Plus, Upload, Download, Trash2, Save, X, Package } from 'lucide-react';
import { Exercise, ExerciseTag, ExercisePack, PackFormData } from './types';

interface PackManagerProps {
  packs: ExercisePack[];
  exercises: Exercise[];
  tags: ExerciseTag[];
  form: PackFormData;
  setForm: (form: PackFormData) => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onDelete: (id: number) => void;
  onExport: (id: number, name: string) => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PackManager({
  packs,
  exercises,
  tags,
  form,
  setForm,
  showForm,
  setShowForm,
  fileInputRef,
  onSave,
  onDelete,
  onExport,
  onImport,
}: PackManagerProps) {
  const togglePackExercise = (exerciseId: number) => {
    setForm({
      ...form,
      exercise_ids: form.exercise_ids.includes(exerciseId)
        ? form.exercise_ids.filter(id => id !== exerciseId)
        : [...form.exercise_ids, exerciseId]
    });
  };

  const openNewForm = () => {
    setForm({ name: '', description: '', exercise_ids: [] });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          <Plus size={18} />
          <span>팩 만들기</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
        >
          <Upload size={18} />
          <span>팩 가져오기</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={onImport}
          className="hidden"
        />
      </div>

      {/* Pack Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">새 운동 팩 만들기</h3>
            <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">팩 이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="하체 훈련 팩"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">설명</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="제멀, 스쿼트 관련 운동들"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  포함할 운동 선택 ({form.exercise_ids.length}개)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, exercise_ids: exercises.map(e => e.id) })}
                    className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded hover:bg-orange-200"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, exercise_ids: [] })}
                    className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
              {/* 태그별 빠른 선택 */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(tag => {
                  const tagExerciseIds = exercises.filter(e => e.tags.includes(tag.tag_id)).map(e => e.id);
                  const allSelected = tagExerciseIds.length > 0 && tagExerciseIds.every(id => form.exercise_ids.includes(id));
                  return (
                    <button
                      key={tag.tag_id}
                      type="button"
                      onClick={() => {
                        if (allSelected) {
                          setForm({ ...form, exercise_ids: form.exercise_ids.filter(id => !tagExerciseIds.includes(id)) });
                        } else {
                          setForm({ ...form, exercise_ids: [...new Set([...form.exercise_ids, ...tagExerciseIds])] });
                        }
                      }}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition ${
                        allSelected ? tag.color : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {tag.label} ({tagExerciseIds.length})
                    </button>
                  );
                })}
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y">
                {exercises.map(ex => (
                  <label
                    key={ex.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.exercise_ids.includes(ex.id)}
                      onChange={() => togglePackExercise(ex.id)}
                      className="rounded text-orange-500 focus:ring-orange-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700">{ex.name}</span>
                      {ex.tags.map(tagId => {
                        const tag = tags.find(t => t.tag_id === tagId);
                        return tag ? (
                          <span key={tagId} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tag.color}`}>
                            {tag.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              취소
            </button>
            <button
              onClick={onSave}
              disabled={!form.name.trim() || form.exercise_ids.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              <Save size={16} />
              저장
            </button>
          </div>
        </div>
      )}

      {/* Packs List */}
      {packs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">생성된 운동 팩이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">팩을 만들어 다른 학원과 공유해보세요!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {packs.map(pack => (
              <div key={pack.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <h4 className="font-medium text-slate-800">{pack.name}</h4>
                  <p className="text-sm text-slate-500">
                    {pack.exercise_count}개 운동 · {pack.author} · v{pack.version}
                  </p>
                  {pack.description && (
                    <p className="text-xs text-slate-400 mt-1">{pack.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onExport(pack.id, pack.name)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    <Download size={14} />
                    내보내기
                  </button>
                  <button
                    onClick={() => onDelete(pack.id)}
                    className="p-2 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
