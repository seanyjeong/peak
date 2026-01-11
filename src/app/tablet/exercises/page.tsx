'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Dumbbell, Plus, Edit2, Trash2, Save, X, RefreshCw, Tag, Package, Download, Upload, ArrowLeft, Video } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import { useOrientation } from '../layout';

interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets: number | null;
  default_reps: number | null;
  description: string | null;
  video_url?: string | null;
}

interface ExerciseTag {
  id: number;
  tag_id: string;
  label: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

interface ExercisePack {
  id: number;
  name: string;
  description: string | null;
  version: string;
  author: string;
  exercise_count: number;
  created_at: string;
}

const TAG_COLORS = [
  { value: 'bg-red-100 text-red-700', label: '빨강' },
  { value: 'bg-orange-100 text-orange-700', label: '주황' },
  { value: 'bg-yellow-100 text-yellow-700', label: '노랑' },
  { value: 'bg-green-100 text-green-700', label: '초록' },
  { value: 'bg-blue-100 text-blue-700', label: '파랑' },
  { value: 'bg-purple-100 text-purple-700', label: '보라' },
  { value: 'bg-pink-100 text-pink-700', label: '분홍' },
  { value: 'bg-slate-100 text-slate-700', label: '회색' },
];

export default function TabletExercisesPage() {
  const orientation = useOrientation();
  const [activeTab, setActiveTab] = useState<'list' | 'tags' | 'packs'>('list');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseTags, setExerciseTags] = useState<ExerciseTag[]>([]);
  const [exercisePacks, setExercisePacks] = useState<ExercisePack[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = authAPI.getCurrentUser();
  const isSystemAdmin = currentUser?.role === 'admin';

  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [exerciseForm, setExerciseForm] = useState<{ name: string; tags: string[]; default_sets: string; default_reps: string; description: string; video_url: string }>({
    name: '', tags: [], default_sets: '', default_reps: '', description: '', video_url: ''
  });

  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ExerciseTag | null>(null);
  const [tagForm, setTagForm] = useState<{ tag_id: string; label: string; color: string }>({
    tag_id: '', label: '', color: 'bg-slate-100 text-slate-700'
  });

  const [showPackForm, setShowPackForm] = useState(false);
  const [packForm, setPackForm] = useState<{ name: string; description: string; exercise_ids: number[] }>({
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
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const toggleExerciseTag = (tagId: string) => {
    setExerciseForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId) ? prev.tags.filter(t => t !== tagId) : [...prev.tags, tagId]
    }));
  };

  const saveTag = async () => {
    try {
      if (editingTag) {
        await apiClient.put(`/exercise-tags/${editingTag.id}`, { label: tagForm.label, color: tagForm.color });
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

  const startEditTag = (tag: ExerciseTag) => {
    setEditingTag(tag);
    setTagForm({ tag_id: tag.tag_id, label: tag.label, color: tag.color });
    setShowTagForm(true);
  };

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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const togglePackExercise = (exerciseId: number) => {
    setPackForm(prev => ({
      ...prev,
      exercise_ids: prev.exercise_ids.includes(exerciseId)
        ? prev.exercise_ids.filter(id => id !== exerciseId)
        : [...prev.exercise_ids, exerciseId]
    }));
  };

  const applyPack = async (packId: number, packName: string) => {
    if (!confirm(`"${packName}" 팩을 불러오면 현재 운동 목록이 모두 대체됩니다.\n\n정말 진행하시겠습니까?`)) return;

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

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/tablet/plans"
            className="p-3 text-slate-400 hover:text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-900 rounded-xl transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">운동 관리</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">수업에서 사용할 운동 목록</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-3 text-slate-600 dark:text-slate-300 bg-white border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm mb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition flex-shrink-0 ${
            activeTab === 'list' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Dumbbell size={18} />
          운동 목록
        </button>
        {isSystemAdmin && (
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition flex-shrink-0 ${
              activeTab === 'tags' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Tag size={18} />
            태그 관리
          </button>
        )}
        <button
          onClick={() => setActiveTab('packs')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition flex-shrink-0 ${
            activeTab === 'packs' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Package size={18} />
          운동 팩
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
          <RefreshCw size={40} className="animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'list' ? (
        <div className="space-y-4">
          {/* Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setEditingExercise(null);
                setExerciseForm({ name: '', tags: [], default_sets: '', default_reps: '', description: '', video_url: '' });
                setShowExerciseForm(true);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition"
            >
              <Plus size={18} />
              <span className="font-medium">운동 추가</span>
            </button>
            {exercisePacks.length > 0 && (
              <button
                onClick={() => setShowPackApplyModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
              >
                <Package size={18} />
                <span className="font-medium">팩 불러오기</span>
              </button>
            )}
          </div>

          {/* Tag Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTagFilter('all')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                selectedTagFilter === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-orange-300'
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
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                    selectedTagFilter === tag.tag_id
                      ? tag.color
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  {tag.label} ({count})
                </button>
              );
            })}
            <button
              onClick={() => setSelectedTagFilter('no-tag')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                selectedTagFilter === 'no-tag'
                  ? 'bg-slate-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-orange-300'
              }`}
            >
              기타 ({exercises.filter(ex => ex.tags.length === 0).length})
            </button>
          </div>

          {/* Exercise Form Modal */}
          {showExerciseForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                    {editingExercise ? '운동 수정' : '새 운동 추가'}
                  </h3>
                  <button onClick={() => setShowExerciseForm(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-300">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">운동명</label>
                    <input
                      type="text"
                      value={exerciseForm.name}
                      onChange={e => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                      placeholder="박스점프, 메디신볼 던지기..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">기본 세트</label>
                      <input
                        type="number"
                        value={exerciseForm.default_sets}
                        onChange={e => setExerciseForm({ ...exerciseForm, default_sets: e.target.value })}
                        placeholder="3"
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">기본 횟수</label>
                      <input
                        type="number"
                        value={exerciseForm.default_reps}
                        onChange={e => setExerciseForm({ ...exerciseForm, default_reps: e.target.value })}
                        placeholder="10"
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">태그 선택</label>
                    <div className="flex flex-wrap gap-2">
                      {exerciseTags.map(tag => (
                        <button
                          key={tag.tag_id}
                          type="button"
                          onClick={() => toggleExerciseTag(tag.tag_id)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                            exerciseForm.tags.includes(tag.tag_id)
                              ? tag.color
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">설명 (선택)</label>
                    <textarea
                      value={exerciseForm.description}
                      onChange={e => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                      placeholder="운동 방법이나 주의사항..."
                      rows={2}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <Video size={16} />
                      영상 링크 (선택)
                    </label>
                    <input
                      type="url"
                      value={exerciseForm.video_url}
                      onChange={e => setExerciseForm({ ...exerciseForm, video_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    />
                    <p className="text-xs text-slate-400 mt-1">유튜브, 네이버TV, 비메오 등 모든 영상 링크 가능</p>
                  </div>
                </div>
                <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    onClick={() => setShowExerciseForm(false)}
                    className="px-6 py-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded-xl hover:bg-slate-200"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveExercise}
                    disabled={!exerciseForm.name.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50"
                  >
                    <Save size={18} />
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pack Apply Modal */}
          {showPackApplyModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">팩 불러오기</h3>
                  <button onClick={() => setShowPackApplyModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-300">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl mb-4">
                  팩을 불러오면 현재 운동 목록이 모두 삭제되고 선택한 팩의 운동으로 대체됩니다.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {exercisePacks.map(pack => (
                    <button
                      key={pack.id}
                      onClick={() => applyPack(pack.id, pack.name)}
                      disabled={applyingPack}
                      className="w-full text-left p-4 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 hover:border-purple-300 transition disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-slate-800 dark:text-slate-100">{pack.name}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{pack.exercise_count}개 운동 · {pack.author}</p>
                        </div>
                        <Package size={24} className="text-purple-400" />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowPackApplyModal(false)}
                    className="px-6 py-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded-xl hover:bg-slate-200"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Exercises List */}
          {exercises.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-12 text-center">
              <Dumbbell size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-lg">등록된 운동이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">운동 추가 버튼을 눌러 만들어보세요.</p>
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-12 text-center">
              <Tag size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-lg">선택한 태그에 해당하는 운동이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">다른 태그를 선택하거나 운동을 추가해보세요.</p>
            </div>
          ) : (
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden ${orientation === 'landscape' ? 'max-h-[calc(100vh-360px)] overflow-y-auto' : ''}`}>
              <div className={`divide-y divide-slate-100 ${orientation === 'landscape' ? 'grid grid-cols-2' : ''}`}>
                {filteredExercises.map(exercise => (
                  <div key={exercise.id} className={`p-4 hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 ${orientation === 'landscape' ? 'border-b border-slate-100' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-slate-800 dark:text-slate-100 text-lg">{exercise.name}</h4>
                          {(exercise.default_sets || exercise.default_reps) && (
                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 dark:text-slate-300 rounded-lg">
                              {exercise.default_sets && `${exercise.default_sets}세트`}
                              {exercise.default_sets && exercise.default_reps && ' × '}
                              {exercise.default_reps && `${exercise.default_reps}회`}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {exercise.tags.map(tagId => {
                            const tag = exerciseTags.find(t => t.tag_id === tagId);
                            return tag ? (
                              <span key={tagId} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${tag.color}`}>
                                {tag.label}
                              </span>
                            ) : null;
                          })}
                          {exercise.tags.length === 0 && <span className="text-xs text-slate-400">태그 없음</span>}
                        </div>
                        {exercise.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{exercise.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        {exercise.video_url && (
                          <a
                            href={exercise.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 text-slate-400 hover:text-blue-500 dark:text-slate-300 dark:hover:text-blue-400"
                            title="영상 보기"
                          >
                            <Video size={18} />
                          </a>
                        )}
                        <button onClick={() => startEditExercise(exercise)} className="p-3 text-slate-400 hover:text-orange-500">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => deleteExercise(exercise.id)} className="p-3 text-slate-400 hover:text-red-500">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'tags' && isSystemAdmin ? (
        <div className="space-y-4">
          <button
            onClick={() => {
              setEditingTag(null);
              setTagForm({ tag_id: '', label: '', color: 'bg-slate-100 text-slate-700' });
              setShowTagForm(true);
            }}
            className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition"
          >
            <Plus size={18} />
            <span className="font-medium">태그 추가</span>
          </button>

          {/* Tag Form Modal */}
          {showTagForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                    {editingTag ? '태그 수정' : '새 태그 추가'}
                  </h3>
                  <button onClick={() => setShowTagForm(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-300">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">태그 ID</label>
                    <input
                      type="text"
                      value={tagForm.tag_id}
                      onChange={e => setTagForm({ ...tagForm, tag_id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      placeholder="lower-power"
                      disabled={!!editingTag}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">표시 이름</label>
                    <input
                      type="text"
                      value={tagForm.label}
                      onChange={e => setTagForm({ ...tagForm, label: e.target.value })}
                      placeholder="하체 파워"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">색상</label>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setTagForm({ ...tagForm, color: c.value })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium ${c.value} ${tagForm.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">미리보기:</span>
                    <span className={`px-4 py-2 rounded-xl text-sm font-medium ${tagForm.color}`}>
                      {tagForm.label || '태그'}
                    </span>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                  <button onClick={() => setShowTagForm(false)} className="px-6 py-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded-xl hover:bg-slate-200">
                    취소
                  </button>
                  <button
                    onClick={saveTag}
                    disabled={!tagForm.label.trim() || (!editingTag && !tagForm.tag_id.trim())}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50"
                  >
                    <Save size={18} />
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tags List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {exerciseTags.map(tag => (
                <div key={tag.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700">
                  <div className="flex items-center gap-4">
                    <span className={`px-4 py-2 rounded-xl text-sm font-medium ${tag.color}`}>{tag.label}</span>
                    <span className="text-xs text-slate-400">{tag.tag_id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEditTag(tag)} className="p-3 text-slate-400 hover:text-orange-500">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => deleteTag(tag.id)} className="p-3 text-slate-400 hover:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setPackForm({ name: '', description: '', exercise_ids: [] });
                setShowPackForm(true);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition"
            >
              <Plus size={18} />
              <span className="font-medium">팩 만들기</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition"
            >
              <Upload size={18} />
              <span className="font-medium">팩 가져오기</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={importPack} className="hidden" />
          </div>

          {/* Pack Form Modal */}
          {showPackForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">새 운동 팩 만들기</h3>
                  <button onClick={() => setShowPackForm(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-300">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">팩 이름</label>
                    <input
                      type="text"
                      value={packForm.name}
                      onChange={e => setPackForm({ ...packForm, name: e.target.value })}
                      placeholder="하체 훈련 팩"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">설명</label>
                    <input
                      type="text"
                      value={packForm.description}
                      onChange={e => setPackForm({ ...packForm, description: e.target.value })}
                      placeholder="제멀, 스쿼트 관련 운동들"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700">
                        포함할 운동 ({packForm.exercise_ids.length}개)
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPackForm({ ...packForm, exercise_ids: exercises.map(e => e.id) })}
                          className="text-xs px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200"
                        >
                          전체 선택
                        </button>
                        <button
                          type="button"
                          onClick={() => setPackForm({ ...packForm, exercise_ids: [] })}
                          className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 dark:text-slate-300 rounded-lg hover:bg-slate-200"
                        >
                          전체 해제
                        </button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 dark:border-slate-700 rounded-xl divide-y">
                      {exercises.map(ex => (
                        <label key={ex.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={packForm.exercise_ids.includes(ex.id)}
                            onChange={() => togglePackExercise(ex.id)}
                            className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-slate-700">{ex.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                  <button onClick={() => setShowPackForm(false)} className="px-6 py-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded-xl hover:bg-slate-200">
                    취소
                  </button>
                  <button
                    onClick={savePack}
                    disabled={!packForm.name.trim() || packForm.exercise_ids.length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50"
                  >
                    <Save size={18} />
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Packs List */}
          {exercisePacks.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-12 text-center">
              <Package size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-lg">생성된 운동 팩이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">팩을 만들어 다른 학원과 공유해보세요!</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {exercisePacks.map(pack => (
                  <div key={pack.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700">
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-100 text-lg">{pack.name}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {pack.exercise_count}개 운동 · {pack.author} · v{pack.version}
                      </p>
                      {pack.description && <p className="text-xs text-slate-400 mt-1">{pack.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => exportPack(pack.id, pack.name)}
                        className="flex items-center gap-1 px-4 py-2.5 text-sm text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100"
                      >
                        <Download size={16} />
                        내보내기
                      </button>
                      <button onClick={() => deletePack(pack.id)} className="p-3 text-slate-400 hover:text-red-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
