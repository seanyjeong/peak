'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function ExercisesPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'tags' | 'packs'>('list');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseTags, setExerciseTags] = useState<ExerciseTag[]>([]);
  const [exercisePacks, setExercisePacks] = useState<ExercisePack[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = authAPI.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const isSystemAdmin = currentUser?.role === 'admin'; // 태그 관리는 시스템 관리자만

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
    tag_id: '', label: '', color: 'bg-slate-100 text-slate-700'
  });

  // 팩 관리 상태
  const [showPackForm, setShowPackForm] = useState(false);
  const [packForm, setPackForm] = useState<PackFormData>({
    name: '', description: '', exercise_ids: []
  });
  const [showPackApplyModal, setShowPackApplyModal] = useState(false);
  const [applyingPack, setApplyingPack] = useState(false);

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
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      console.error('Failed to save exercise:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const deleteExercise = async (id: number) => {
    if (!confirm('이 운동을 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/exercises/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete exercise:', error);
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
      setTagForm({ tag_id: '', label: '', color: 'bg-slate-100 text-slate-700' });
      fetchData();
    } catch (error) {
      console.error('Failed to save tag:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const deleteTag = async (id: number) => {
    if (!confirm('이 태그를 비활성화하시겠습니까?')) return;
    try {
      await apiClient.delete(`/exercise-tags/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete tag:', error);
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
      console.error('Failed to save pack:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const deletePack = async (id: number) => {
    if (!confirm('이 팩을 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/exercise-packs/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete pack:', error);
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
      console.error('Failed to export pack:', error);
      alert('내보내기에 실패했습니다.');
    }
  };

  const importPack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.format !== 'peak-exercise-pack') {
        alert('올바른 P-EAK 팩 파일이 아닙니다.');
        return;
      }
      const res = await apiClient.post('/exercise-packs/import', data);
      alert(res.data.message);
      fetchData();
    } catch (error) {
      console.error('Failed to import pack:', error);
      alert('가져오기에 실패했습니다.');
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
      alert(res.data.message);
      setShowPackApplyModal(false);
      fetchData();
    } catch (error) {
      console.error('Apply pack error:', error);
      alert('팩 불러오기에 실패했습니다.');
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
          <Link href="/plans" className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">운동 관리</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">수업에서 사용할 운동 목록</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'list' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Dumbbell size={16} />
          운동 목록
        </button>
        {isSystemAdmin && (
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'tags' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
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
              activeTab === 'packs' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Package size={16} />
            운동 팩
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'list' ? (
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={openNewExerciseForm}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
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
            exercises={exercises}
            tags={exerciseTags}
            onEdit={startEditExercise}
            onDelete={deleteExercise}
          />
        </div>
      ) : activeTab === 'tags' && isSystemAdmin ? (
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
