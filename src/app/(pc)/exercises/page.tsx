'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/useToast';
import { Dumbbell, Plus, RefreshCw, Tag, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
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
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/plans" className="p-2 text-muted-foreground hover:text-secondary-foreground hover:bg-muted rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">운동 관리</h1>
            <p className="text-muted-foreground mt-1">수업에서 사용할 운동 목록</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-secondary-foreground bg-card border border-border rounded-lg hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-card rounded-lg p-1 shadow-sm mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'list' ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Dumbbell size={16} />
          운동 목록
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'tags' ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Tag size={16} />
            태그 관리
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('packs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'packs' ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Package size={16} />
            운동 팩
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-card rounded-2xl shadow-sm">
          <RefreshCw size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : activeTab === 'list' ? (
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={openNewExerciseForm}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
            >
              <Plus size={18} />
              <span>운동 추가</span>
            </button>
            {isAdmin && exercisePacks.length > 0 && (
              <button
                onClick={() => setShowPackApplyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
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
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                selectedTagFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-card text-secondary-foreground border border-border hover:border-primary/30'
              }`}
            >
              전체 ({exercises.length})
            </button>
            {exerciseTags.map(tag => {
              const count = exercises.filter(ex => ex.tags.includes(tag.tag_id)).length;
              return (
                <button
                  key={tag.tag_id}
                  onClick={() => setSelectedTagFilter(tag.tag_id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${tag.color} ${
                    selectedTagFilter === tag.tag_id
                      ? 'ring-2 ring-offset-2 ring-muted-foreground/40'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {tag.label} ({count})
                </button>
              );
            })}
            <button
              onClick={() => setSelectedTagFilter('no-tag')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                selectedTagFilter === 'no-tag'
                  ? 'bg-muted-foreground text-white'
                  : 'bg-card text-secondary-foreground border border-border hover:border-primary/30'
              }`}
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
