'use client';

import { useState } from 'react';
import { Plus, Upload, Download, Trash2, Save, X, Package, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Exercise, ExerciseTag, ExercisePack, PackFormData } from './types';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import { getExerciseErrorMessage } from './exercise-errors';

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
  const toast = useToast();
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
      const response = await apiClient.get(`/exercise-packs/${pack.id}`);
      const packExerciseIds = response.data.exercises.map((ex: PackExercise) => ex.id);
      setEditingPack(pack);
      setForm({
        name: pack.name,
        description: pack.description || '',
        exercise_ids: packExerciseIds
      });
      setShowForm(true);
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 팩 상세를 불러오지 못했습니다.'));
    }
  };

  const handleSave = async () => {
    if (editingPack) {
      // 수정 모드
      try {
        await apiClient.put(`/exercise-packs/${editingPack.id}`, {
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
        toast.error(getExerciseErrorMessage(error, '운동 팩을 수정하지 못했습니다.'));
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
      const response = await apiClient.get(`/exercise-packs/${packId}`);
      setPackExercises(prev => ({
        ...prev,
        [packId]: response.data.exercises
      }));
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 팩에 포함된 운동을 불러오지 못했습니다.'));
    } finally {
      setLoadingPackId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={openNewForm}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus size={18} />
          <span>팩 만들기</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-secondary-foreground rounded-lg hover:bg-border transition"
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
        <div className="bg-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">
              {editingPack ? '팩 수정' : '새 운동 팩 만들기'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingPack(null); }} className="p-2 text-muted-foreground hover:text-secondary-foreground">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">팩 이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="하체 훈련 팩"
                  className="w-full px-3 py-2 border border-transparent bg-muted text-foreground rounded-xl focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">설명</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="제멀, 스쿼트 관련 운동들"
                  className="w-full px-3 py-2 border border-transparent bg-muted text-foreground rounded-xl focus:border-primary"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-secondary-foreground">
                  포함할 운동 선택 ({form.exercise_ids.length}개)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, exercise_ids: exercises.map(e => e.id) })}
                    className="text-xs px-2 py-1 bg-primary-soft text-primary rounded hover:bg-primary/20"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, exercise_ids: [] })}
                    className="text-xs px-2 py-1 bg-muted text-secondary-foreground rounded hover:bg-border"
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
                        allSelected ? tag.color : 'bg-muted text-muted-foreground hover:bg-border'
                      }`}
                    >
                      {tag.label} ({tagExerciseIds.length})
                    </button>
                  );
                })}
              </div>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border/60">
                {exercises.map(ex => (
                  <label
                    key={ex.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.exercise_ids.includes(ex.id)}
                      onChange={() => togglePackExercise(ex.id)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-secondary-foreground">{ex.name}</span>
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
              className="h-10 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || form.exercise_ids.length === 0}
              className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {editingPack ? '수정' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* Packs List */}
      {packs.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center">
          <Package size={48} className="mx-auto text-muted-foreground/60 mb-4" />
          <p className="text-muted-foreground">생성된 운동 팩이 없습니다.</p>
          <p className="text-muted-foreground text-sm mt-1">팩을 만들어 다른 학원과 공유해보세요!</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/60">
            {packs.map(pack => {
              const isExpanded = expandedPackId === pack.id;
              const isLoading = loadingPackId === pack.id;
              const exercises = packExercises[pack.id] || [];
              const isSystem = pack.is_system;

              return (
                <div key={pack.id}>
                  {/* Pack Header */}
                  <div
                    className="p-4 flex items-center justify-between hover:bg-muted cursor-pointer"
                    onClick={() => toggleExpand(pack.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{pack.name}</h4>
                          {isSystem && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-primary-soft text-primary rounded font-medium">
                              기본
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pack.exercise_count}개 운동 · {pack.author} · v{pack.version}
                        </p>
                        {pack.description && (
                          <p className="text-xs text-muted-foreground mt-1">{pack.description}</p>
                        )}
                      </div>
                    </div>
                    {!isSystem && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditForm(pack)}
                          className="p-2 text-muted-foreground hover:text-primary"
                          title="수정"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => onExport(pack.id, pack.name)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary bg-primary-soft rounded-lg hover:bg-primary-soft"
                        >
                          <Download size={14} />
                          내보내기
                        </button>
                        <button
                          onClick={() => onDelete(pack.id)}
                          className="p-2 text-muted-foreground hover:text-destructive"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pack Exercises (Expanded) */}
                  {isExpanded && (
                    <div className="bg-muted px-4 py-3 border-t border-border">
                      {isLoading ? (
                        <div className="text-sm text-muted-foreground text-center py-4">로딩 중...</div>
                      ) : exercises.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">운동이 없습니다</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {exercises.map(ex => (
                            <div
                              key={ex.id}
                              className="px-3 py-1.5 bg-card rounded-lg text-sm text-secondary-foreground border border-border flex items-center gap-2"
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
