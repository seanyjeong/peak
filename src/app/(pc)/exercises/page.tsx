'use client';

import { useState, useEffect, useRef } from 'react';
import { Dumbbell, Plus, Edit2, Trash2, Save, X, RefreshCw, Tag, Package, Download, Upload, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';

interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets: number | null;
  default_reps: number | null;
  description: string | null;
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

// 태그 색상 옵션
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

export default function ExercisesPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'tags' | 'packs'>('list');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseTags, setExerciseTags] = useState<ExerciseTag[]>([]);
  const [exercisePacks, setExercisePacks] = useState<ExercisePack[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 현재 사용자가 시스템 admin인지 확인 (태그 관리 권한)
  const currentUser = authAPI.getCurrentUser();
  const isSystemAdmin = currentUser?.role === 'admin';

  // 운동 관리 상태
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [exerciseForm, setExerciseForm] = useState<{ name: string; tags: string[]; default_sets: string; default_reps: string; description: string }>({
    name: '', tags: [], default_sets: '', default_reps: '', description: ''
  });

  // 태그 관리 상태
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ExerciseTag | null>(null);
  const [tagForm, setTagForm] = useState<{ tag_id: string; label: string; color: string }>({
    tag_id: '', label: '', color: 'bg-slate-100 text-slate-700'
  });

  // 팩 관리 상태
  const [showPackForm, setShowPackForm] = useState(false);
  const [packForm, setPackForm] = useState<{ name: string; description: string; exercise_ids: number[] }>({
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

  // 운동 저장
  const saveExercise = async () => {
    try {
      const payload = {
        name: exerciseForm.name,
        tags: exerciseForm.tags,
        default_sets: exerciseForm.default_sets ? parseInt(exerciseForm.default_sets) : null,
        default_reps: exerciseForm.default_reps ? parseInt(exerciseForm.default_reps) : null,
        description: exerciseForm.description || null
      };

      if (editingExercise) {
        await apiClient.put(`/exercises/${editingExercise.id}`, payload);
      } else {
        await apiClient.post('/exercises', payload);
      }
      setShowExerciseForm(false);
      setEditingExercise(null);
      setExerciseForm({ name: '', tags: [], default_sets: '', default_reps: '', description: '' });
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
      description: exercise.description || ''
    });
    setShowExerciseForm(true);
  };

  const toggleExerciseTag = (tagId: string) => {
    setExerciseForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(t => t !== tagId)
        : [...prev.tags, tagId]
    }));
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

  const startEditTag = (tag: ExerciseTag) => {
    setEditingTag(tag);
    setTagForm({ tag_id: tag.tag_id, label: tag.label, color: tag.color });
    setShowTagForm(true);
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

  const togglePackExercise = (exerciseId: number) => {
    setPackForm(prev => ({
      ...prev,
      exercise_ids: prev.exercise_ids.includes(exerciseId)
        ? prev.exercise_ids.filter(id => id !== exerciseId)
        : [...prev.exercise_ids, exerciseId]
    }));
  };

  // 팩 불러오기 (운동 목록 대체)
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/plans"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">운동 관리</h1>
            <p className="text-slate-500 mt-1">수업에서 사용할 운동 목록</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'list'
              ? 'bg-orange-100 text-orange-700'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Dumbbell size={16} />
          운동 목록
        </button>
        {isSystemAdmin && (
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'tags'
                ? 'bg-orange-100 text-orange-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Tag size={16} />
            태그 관리
          </button>
        )}
        <button
          onClick={() => setActiveTab('packs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'packs'
              ? 'bg-orange-100 text-orange-700'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Package size={16} />
          운동 팩
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl shadow-sm">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'list' ? (
        /* 운동 목록 탭 */
        <div className="space-y-4">
          {/* Add Button & Pack Apply Button */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingExercise(null);
                setExerciseForm({ name: '', tags: [], default_sets: '', default_reps: '', description: '' });
                setShowExerciseForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <Plus size={18} />
              <span>운동 추가</span>
            </button>
            {exercisePacks.length > 0 && (
              <button
                onClick={() => setShowPackApplyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
              >
                <Package size={18} />
                <span>팩 불러오기</span>
              </button>
            )}
          </div>

          {/* Pack Apply Modal */}
          {showPackApplyModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">팩 불러오기</h3>
                  <button
                    onClick={() => setShowPackApplyModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-4">
                  팩을 불러오면 현재 운동 목록이 모두 삭제되고 선택한 팩의 운동으로 대체됩니다.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {exercisePacks.map(pack => (
                    <button
                      key={pack.id}
                      onClick={() => applyPack(pack.id, pack.name)}
                      disabled={applyingPack}
                      className="w-full text-left p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-purple-300 transition disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-slate-800">{pack.name}</h4>
                          <p className="text-sm text-slate-500">
                            {pack.exercise_count}개 운동 · {pack.author}
                          </p>
                          {pack.description && (
                            <p className="text-xs text-slate-400 mt-1">{pack.description}</p>
                          )}
                        </div>
                        <Package size={20} className="text-purple-400" />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowPackApplyModal(false)}
                    className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Exercise Form */}
          {showExerciseForm && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">
                  {editingExercise ? '운동 수정' : '새 운동 추가'}
                </h3>
                <button onClick={() => setShowExerciseForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">운동명</label>
                    <input
                      type="text"
                      value={exerciseForm.name}
                      onChange={e => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                      placeholder="박스점프, 메디신볼 던지기..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">기본 세트</label>
                      <input
                        type="number"
                        value={exerciseForm.default_sets}
                        onChange={e => setExerciseForm({ ...exerciseForm, default_sets: e.target.value })}
                        placeholder="3"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">기본 횟수</label>
                      <input
                        type="number"
                        value={exerciseForm.default_reps}
                        onChange={e => setExerciseForm({ ...exerciseForm, default_reps: e.target.value })}
                        placeholder="10"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
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
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">설명 (선택)</label>
                  <textarea
                    value={exerciseForm.description}
                    onChange={e => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                    placeholder="운동 방법이나 주의사항..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowExerciseForm(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  onClick={saveExercise}
                  disabled={!exerciseForm.name.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  저장
                </button>
              </div>
            </div>
          )}

          {/* Exercises List */}
          {exercises.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Dumbbell size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">등록된 운동이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">운동 추가 버튼을 눌러 만들어보세요.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {exercises.map(exercise => (
                  <div key={exercise.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-slate-800">{exercise.name}</h4>
                          {(exercise.default_sets || exercise.default_reps) && (
                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
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
                              <span
                                key={tagId}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${tag.color}`}
                              >
                                {tag.label}
                              </span>
                            ) : null;
                          })}
                          {exercise.tags.length === 0 && (
                            <span className="text-xs text-slate-400">태그 없음</span>
                          )}
                        </div>
                        {exercise.description && (
                          <p className="text-sm text-slate-500 mt-1">{exercise.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditExercise(exercise)}
                          className="p-2 text-slate-400 hover:text-orange-500"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteExercise(exercise.id)}
                          className="p-2 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
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
        /* 태그 관리 탭 (시스템 admin 전용) */
        <div className="space-y-4">
          <button
            onClick={() => {
              setEditingTag(null);
              setTagForm({ tag_id: '', label: '', color: 'bg-slate-100 text-slate-700' });
              setShowTagForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
          >
            <Plus size={18} />
            <span>태그 추가</span>
          </button>

          {/* Tag Form */}
          {showTagForm && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">
                  {editingTag ? '태그 수정' : '새 태그 추가'}
                </h3>
                <button onClick={() => setShowTagForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">태그 ID</label>
                  <input
                    type="text"
                    value={tagForm.tag_id}
                    onChange={e => setTagForm({ ...tagForm, tag_id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="lower-power"
                    disabled={!!editingTag}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">표시 이름</label>
                  <input
                    type="text"
                    value={tagForm.label}
                    onChange={e => setTagForm({ ...tagForm, label: e.target.value })}
                    placeholder="하체 파워"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">색상</label>
                  <select
                    value={tagForm.color}
                    onChange={e => setTagForm({ ...tagForm, color: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {TAG_COLORS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <span className="text-sm text-slate-500">미리보기:</span>
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${tagForm.color}`}>
                  {tagForm.label || '태그'}
                </span>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowTagForm(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  onClick={saveTag}
                  disabled={!tagForm.label.trim() || (!editingTag && !tagForm.tag_id.trim())}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  <Save size={16} />
                  저장
                </button>
              </div>
            </div>
          )}

          {/* Tags List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {exerciseTags.map(tag => (
                <div key={tag.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${tag.color}`}>
                      {tag.label}
                    </span>
                    <span className="text-xs text-slate-400">{tag.tag_id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditTag(tag)}
                      className="p-2 text-slate-400 hover:text-orange-500"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="p-2 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 팩 관리 탭 */
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPackForm({ name: '', description: '', exercise_ids: [] });
                setShowPackForm(true);
              }}
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
              onChange={importPack}
              className="hidden"
            />
          </div>

          {/* Pack Form */}
          {showPackForm && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">새 운동 팩 만들기</h3>
                <button onClick={() => setShowPackForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">팩 이름</label>
                    <input
                      type="text"
                      value={packForm.name}
                      onChange={e => setPackForm({ ...packForm, name: e.target.value })}
                      placeholder="하체 훈련 팩"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">설명</label>
                    <input
                      type="text"
                      value={packForm.description}
                      onChange={e => setPackForm({ ...packForm, description: e.target.value })}
                      placeholder="제멀, 스쿼트 관련 운동들"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      포함할 운동 선택 ({packForm.exercise_ids.length}개)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPackForm({ ...packForm, exercise_ids: exercises.map(e => e.id) })}
                        className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded hover:bg-orange-200"
                      >
                        전체 선택
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackForm({ ...packForm, exercise_ids: [] })}
                        className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                      >
                        전체 해제
                      </button>
                    </div>
                  </div>
                  {/* 태그별 빠른 선택 */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {exerciseTags.map(tag => {
                      const tagExerciseIds = exercises.filter(e => e.tags.includes(tag.tag_id)).map(e => e.id);
                      const allSelected = tagExerciseIds.length > 0 && tagExerciseIds.every(id => packForm.exercise_ids.includes(id));
                      return (
                        <button
                          key={tag.tag_id}
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setPackForm({ ...packForm, exercise_ids: packForm.exercise_ids.filter(id => !tagExerciseIds.includes(id)) });
                            } else {
                              setPackForm({ ...packForm, exercise_ids: [...new Set([...packForm.exercise_ids, ...tagExerciseIds])] });
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
                          checked={packForm.exercise_ids.includes(ex.id)}
                          onChange={() => togglePackExercise(ex.id)}
                          className="rounded text-orange-500 focus:ring-orange-500"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{ex.name}</span>
                          {ex.tags.map(tagId => {
                            const tag = exerciseTags.find(t => t.tag_id === tagId);
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
                  onClick={() => setShowPackForm(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  onClick={savePack}
                  disabled={!packForm.name.trim() || packForm.exercise_ids.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  <Save size={16} />
                  저장
                </button>
              </div>
            </div>
          )}

          {/* Packs List */}
          {exercisePacks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Package size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">생성된 운동 팩이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">팩을 만들어 다른 학원과 공유해보세요!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {exercisePacks.map(pack => (
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
                        onClick={() => exportPack(pack.id, pack.name)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                      >
                        <Download size={14} />
                        내보내기
                      </button>
                      <button
                        onClick={() => deletePack(pack.id)}
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
      )}
    </div>
  );
}
