'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/useToast';
import { Dumbbell, Plus, RefreshCw, Tag, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, chipClass, toolbarButtonClass } from '@/components/ui/page';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import {
  ExerciseList,
  ExerciseForm,
  TagManager,
  PackManager,
  PackApplyModal,
  Exercise,
  ExerciseTag,
  ExercisePack,
  ExerciseFormData,
  TagFormData,
  PackFormData,
} from '@/components/exercises';
import { getExerciseErrorMessage } from '@/components/exercises/exercise-errors';

export default function ExercisesPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'tags' | 'packs'>('list');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseTags, setExerciseTags] = useState<ExerciseTag[]>([]);
  const [exercisePacks, setExercisePacks] = useState<ExercisePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 운동 관리 상태
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [exerciseForm, setExerciseForm] = useState<ExerciseFormData>({
    name: '', tags: [], default_sets: '', default_reps: '', description: '', video_url: ''
  });

  // 태그 관리 상태
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ExerciseTag | null>(null);
  const [tagForm, setTagForm] = useState<TagFormData>({
    tag_id: '', label: '', color: 'bg-muted text-secondary-foreground'
  });

  // 팩 관리 상태
  const [showPackForm, setShowPackForm] = useState(false);
  const [packForm, setPackForm] = useState<PackFormData>({
    name: '', description: '', exercise_ids: []
  });
  const [showPackApplyModal, setShowPackApplyModal] = useState(false);
  const [applyingPack, setApplyingPack] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [exercisesRes, tagsRes, packsRes] = await Promise.all([
        apiClient.get('/exercises'),
        apiClient.get('/exercise-tags'),
        apiClient.get('/exercise-packs')
      ]);
      setExercises(exercisesRes.data.exercises || []);
      setExerciseTags(tagsRes.data.tags || []);
      setExercisePacks(packsRes.data.packs || []);
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    setIsAdmin(currentUser?.role === 'admin' || currentUser?.role === 'owner');
    fetchData();
  }, []);

  // 태그 필터링된 운동 목록
  const filteredExercises = useMemo(() => {
    if (selectedTagFilter === 'all') {
      return exercises;
    }
    if (selectedTagFilter === 'no-tag') {
      return exercises.filter(ex => ex.tags.length === 0);
    }
    return exercises.filter(ex => ex.tags.includes(selectedTagFilter));
  }, [exercises, selectedTagFilter]);

  // 운동 CRUD
  const saveExercise = async () => {
    try {
      const payload = {
        name: exerciseForm.name,
        tags: exerciseForm.tags,
        default_sets: exerciseForm.default_sets ? parseInt(exerciseForm.default_sets) : null,
        default_reps: exerciseForm.default_reps ? parseInt(exerciseForm.default_reps) : null,
        description: exerciseForm.description || null,
        video_url: exerciseForm.video_url || null
      };
      if (editingExercise) {
        await apiClient.put(`/exercises/${editingExercise.id}`, payload);
      } else {
        await apiClient.post('/exercises', payload);
      }
      setShowExerciseForm(false);
      setEditingExercise(null);
      setExerciseForm({ name: '', tags: [], default_sets: '', default_reps: '', description: '', video_url: '' });
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동을 저장하지 못했습니다.'));
    }
  };

  const deleteExercise = async (id: number) => {
    if (!confirm('이 운동을 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/exercises/${id}`);
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동을 삭제하지 못했습니다.'));
    }
  };

  const startEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setExerciseForm({
      name: exercise.name,
      tags: exercise.tags,
      default_sets: exercise.default_sets?.toString() || '',
      default_reps: exercise.default_reps?.toString() || '',
      description: exercise.description || '',
      video_url: exercise.video_url || ''
    });
    setShowExerciseForm(true);
  };

  // 태그 CRUD
  const saveTag = async () => {
    try {
      if (editingTag) {
        await apiClient.put(`/exercise-tags/${editingTag.id}`, {
          label: tagForm.label,
          color: tagForm.color
        });
      } else {
        await apiClient.post('/exercise-tags', tagForm);
      }
      setShowTagForm(false);
      setEditingTag(null);
      setTagForm({ tag_id: '', label: '', color: 'bg-muted text-secondary-foreground' });
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '태그를 저장하지 못했습니다.'));
    }
  };

  const deleteTag = async (id: number) => {
    if (!confirm('이 태그를 비활성화하시겠습니까?')) return;
    try {
      await apiClient.delete(`/exercise-tags/${id}`);
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '태그 상태를 바꾸지 못했습니다.'));
    }
  };

  // 팩 CRUD
  const savePack = async () => {
    try {
      await apiClient.post('/exercise-packs', {
        name: packForm.name,
        description: packForm.description || null,
        exercise_ids: packForm.exercise_ids
      });
      setShowPackForm(false);
      setPackForm({ name: '', description: '', exercise_ids: [] });
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 팩을 저장하지 못했습니다.'));
    }
  };

  const deletePack = async (id: number) => {
    if (!confirm('이 팩을 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/exercise-packs/${id}`);
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 팩을 삭제하지 못했습니다.'));
    }
  };

  const exportPack = async (id: number, name: string) => {
    try {
      const res = await apiClient.get(`/exercise-packs/${id}/export`);
      const dataStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `peak-pack-${name.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 팩을 내보내지 못했습니다.'));
    }
  };

  const importPack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.format !== 'peak-exercise-pack') {
        toast.error('올바른 P-EAK 운동 팩 파일이 아닙니다.');
        return;
      }
      const res = await apiClient.post('/exercise-packs/import', data);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 팩을 가져오지 못했습니다.'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const applyPack = async (packId: number, packName: string) => {
    if (!confirm(`"${packName}" 팩을 불러오면 현재 운동 목록이 모두 대체됩니다.\n\n정말 진행하시겠습니까?`)) {
      return;
    }
    try {
      setApplyingPack(true);
      const res = await apiClient.post(`/exercise-packs/${packId}/apply`);
      toast.success(res.data.message);
      setShowPackApplyModal(false);
      fetchData();
    } catch (error) {
      toast.error(getExerciseErrorMessage(error, '운동 팩을 불러오지 못했습니다.'));
    } finally {
      setApplyingPack(false);
    }
  };

  const openNewExerciseForm = () => {
    setEditingExercise(null);
    setExerciseForm({ name: '', tags: [], default_sets: '', default_reps: '', description: '', video_url: '' });
    setShowExerciseForm(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Link href="/plans" className={`${toolbarButtonClass()} mt-2.5 w-10 px-0`} aria-label="수업 계획으로">
          <ArrowLeft size={20} />
        </Link>
        <PageHeader
          className="min-w-0 flex-1"
          title="운동 관리"
          description="수업에서 사용할 운동 목록"
          actions={(
            <button onClick={fetchData} disabled={loading} className={toolbarButtonClass()}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>새로고침</span>
            </button>
          )}
        />
      </div>

      {/* Tabs */}
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-card p-1">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
            activeTab === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Dumbbell size={16} />
          운동 목록
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
              activeTab === 'tags' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Tag size={16} />
            태그 관리
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('packs')}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
              activeTab === 'packs' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Package size={16} />
            운동 팩
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-card rounded-2xl">
          <RefreshCw size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : activeTab === 'list' ? (
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={openNewExerciseForm}
              className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus size={18} />
              <span>운동 추가</span>
            </button>
            {isAdmin && exercisePacks.length > 0 && (
              <button
                onClick={() => setShowPackApplyModal(true)}
                className="flex h-10 items-center gap-2 rounded-xl bg-primary-soft px-4 text-sm font-semibold text-primary transition hover:bg-primary-soft/70"
              >
                <Package size={18} />
                <span>팩 불러오기</span>
              </button>
            )}
          </div>

          {/* Tag Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTagFilter('all')}
              aria-pressed={selectedTagFilter === 'all'}
              className={chipClass(selectedTagFilter === 'all')}
            >
              전체 ({exercises.length})
            </button>
            {exerciseTags.map(tag => {
              const count = exercises.filter(ex => ex.tags.includes(tag.tag_id)).length;
              return (
                <button
                  key={tag.tag_id}
                  onClick={() => setSelectedTagFilter(tag.tag_id)}
                  aria-pressed={selectedTagFilter === tag.tag_id}
                  className={`inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold transition ${tag.color} ${
                    selectedTagFilter === tag.tag_id
                      ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {tag.label} ({count})
                </button>
              );
            })}
            <button
              onClick={() => setSelectedTagFilter('no-tag')}
              aria-pressed={selectedTagFilter === 'no-tag'}
              className={chipClass(selectedTagFilter === 'no-tag')}
            >
              기타 ({exercises.filter(ex => ex.tags.length === 0).length})
            </button>
          </div>

          {showPackApplyModal && (
            <PackApplyModal
              packs={exercisePacks}
              applying={applyingPack}
              onApply={applyPack}
              onClose={() => setShowPackApplyModal(false)}
            />
          )}

          {showExerciseForm && (
            <ExerciseForm
              form={exerciseForm}
              setForm={setExerciseForm}
              tags={exerciseTags}
              editingExercise={editingExercise}
              onSave={saveExercise}
              onClose={() => setShowExerciseForm(false)}
            />
          )}

          <ExerciseList
            exercises={filteredExercises}
            tags={exerciseTags}
            onEdit={startEditExercise}
            onDelete={deleteExercise}
          />
        </div>
      ) : activeTab === 'tags' && isAdmin ? (
        <TagManager
          tags={exerciseTags}
          form={tagForm}
          setForm={setTagForm}
          showForm={showTagForm}
          setShowForm={setShowTagForm}
          editingTag={editingTag}
          setEditingTag={setEditingTag}
          onSave={saveTag}
          onDelete={deleteTag}
        />
      ) : activeTab === 'packs' && isAdmin ? (
        <PackManager
          packs={exercisePacks}
          exercises={exercises}
          tags={exerciseTags}
          form={packForm}
          setForm={setPackForm}
          showForm={showPackForm}
          setShowForm={setShowPackForm}
          fileInputRef={fileInputRef}
          onSave={savePack}
          onDelete={deletePack}
          onExport={exportPack}
          onImport={importPack}
          onUpdate={fetchData}
        />
      ) : null}
    </div>
  );
}
