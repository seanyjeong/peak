'use client';

import { useState } from 'react';
import { Plus, Upload, Download, Trash2, Save, X, Package, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Exercise, ExerciseTag, ExercisePack, PackFormData } from './types';
import apiClient from '@/lib/api/client';

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
  onUpdate?: () => void; // 팩 목록 새로고침
}

interface PackExercise {
  id: number;
  name: string;
  tags: string[];
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
  onUpdate,
}: PackManagerProps) {
  const [expandedPackId, setExpandedPackId] = useState<number | null>(null);
  const [packExercises, setPackExercises] = useState<Record<number, PackExercise[]>>({});
  const [loadingPackId, setLoadingPackId] = useState<number | null>(null);
  const [editingPack, setEditingPack] = useState<ExercisePack | null>(null);

  const togglePackExercise = (exerciseId: number) => {
    setForm({
      ...form,
      exercise_ids: form.exercise_ids.includes(exerciseId)
        ? form.exercise_ids.filter(id => id !== exerciseId)
        : [...form.exercise_ids, exerciseId]
    });
  };

  const openNewForm = () => {
    setEditingPack(null);
    setForm({ name: '', description: '', exercise_ids: [] });
    setShowForm(true);
  };

  const openEditForm = async (pack: ExercisePack) => {
    // 팩 상세 정보 가져오기
    try {
      const response = await apiClient.get(`/peak/exercise-packs/${pack.id}`);
      const packExerciseIds = response.data.exercises.map((ex: PackExercise) => ex.id);
      setEditingPack(pack);
      setForm({
        name: pack.name,
        description: pack.description || '',
        exercise_ids: packExerciseIds
      });
      setShowForm(true);
    } catch (error) {
      console.error('Failed to load pack details:', error);
    }
  };

  const handleSave = async () => {
    if (editingPack) {
      // 수정 모드
      try {
        await apiClient.put(`/peak/exercise-packs/${editingPack.id}`, {
          name: form.name,
          description: form.description,
          exercise_ids: form.exercise_ids
        });
        setShowForm(false);
        setEditingPack(null);
        // 팩 목록 및 캐시된 운동 새로고침
        if (expandedPackId === editingPack.id) {
          delete packExercises[editingPack.id];
          setPackExercises({ ...packExercises });
        }
        onUpdate?.();
      } catch (error) {
        console.error('Failed to update pack:', error);
      }
    } else {
      // 새로 만들기 모드
      onSave();
    }
  };

  const toggleExpand = async (packId: number) => {
    if (expandedPackId === packId) {
      // 접기
      setExpandedPackId(null);
      return;
    }

    // 펼치기
    setExpandedPackId(packId);

    // 이미 캐시되어 있으면 다시 로드 안 함
    if (packExercises[packId]) return;

    // 팩 운동 목록 로드
    setLoadingPackId(packId);
    try {
      const response = await apiClient.get(`/peak/exercise-packs/${packId}`);
      setPackExercises(prev => ({
        ...prev,
        [packId]: response.data.exercises
      }));
    } catch (error) {
      console.error('Failed to load pack exercises:', error);
    } finally {
      setLoadingPackId(null);
    }
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
            <h3 className="font-semibold text-slate-800">
              {editingPack ? '팩 수정' : '새 운동 팩 만들기'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingPack(null); }} className="p-2 text-slate-400 hover:text-slate-600">
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
              onClick={() => { setShowForm(false); setEditingPack(null); }}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || form.exercise_ids.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              <Save size={16} />
              {editingPack ? '수정' : '저장'}
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
            {packs.map(pack => {
              const isExpanded = expandedPackId === pack.id;
              const isLoading = loadingPackId === pack.id;
              const exercises = packExercises[pack.id] || [];
              const isSystem = pack.is_system;

              return (
                <div key={pack.id}>
                  {/* Pack Header */}
                  <div
                    className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                    onClick={() => toggleExpand(pack.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-800">{pack.name}</h4>
                          {isSystem && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded font-medium">
                              기본
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          {pack.exercise_count}개 운동 · {pack.author} · v{pack.version}
                        </p>
                        {pack.description && (
                          <p className="text-xs text-slate-400 mt-1">{pack.description}</p>
                        )}
                      </div>
                    </div>
                    {!isSystem && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditForm(pack)}
                          className="p-2 text-slate-400 hover:text-orange-500"
                          title="수정"
                        >
                          <Pencil size={16} />
                        </button>
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
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pack Exercises (Expanded) */}
                  {isExpanded && (
                    <div className="bg-slate-50 px-4 py-3 border-t border-slate-100">
                      {isLoading ? (
                        <div className="text-sm text-slate-400 text-center py-4">로딩 중...</div>
                      ) : exercises.length === 0 ? (
                        <div className="text-sm text-slate-400 text-center py-4">운동이 없습니다</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {exercises.map(ex => (
                            <div
                              key={ex.id}
                              className="px-3 py-1.5 bg-white rounded-lg text-sm text-slate-700 border border-slate-200 flex items-center gap-2"
                            >
                              <span>{ex.name}</span>
                              {ex.tags?.map(tagId => {
                                const tag = tags.find(t => t.tag_id === tagId);
                                return tag ? (
                                  <span key={tagId} className={`px-1 py-0.5 rounded text-[10px] font-medium ${tag.color}`}>
                                    {tag.label}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
