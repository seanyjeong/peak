'use client';

import { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, RefreshCw, Tag, Edit2, Check, X, Dumbbell, ChevronDown, ChevronUp, Sunrise, Sun, Moon, Calendar, ChevronLeft, ChevronRight, Settings2, Trash2, Video } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api/client';
import { authAPI, User } from '@/lib/api/auth';
import { useOrientation } from '../layout';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface Instructor {
  id: number;
  name: string;
  user_id: number | null;
  time_slot: TimeSlot;
}

interface SlotsData {
  morning: Instructor[];
  afternoon: Instructor[];
  evening: Instructor[];
}

interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets: number | null;
  default_reps: number | null;
  description: string | null;
  video_url?: string | null;
}

interface SelectedExercise {
  exercise_id: number;
  note: string;
  weight?: string;
  reps?: number;
}

interface Plan {
  id: number;
  instructor_id: number;
  instructor_name: string;
  time_slot: TimeSlot;
  tags: string[];
  exercises: SelectedExercise[];
  description: string;
  date: string;
}

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: typeof Sun; color: string; bgColor: string }> = {
  morning: { label: '오전', icon: Sunrise, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  afternoon: { label: '오후', icon: Sun, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  evening: { label: '저녁', icon: Moon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

const TRAINING_TAGS = [
  { id: 'lower-power', label: '하체 파워', color: 'bg-red-100 text-red-700 border-red-300' },
  { id: 'upper-power', label: '상체 파워', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'agility', label: '민첩성', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { id: 'flexibility', label: '유연성', color: 'bg-green-100 text-green-700 border-green-300' },
  { id: 'technique', label: '기술/자세', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'conditioning', label: '컨디셔닝', color: 'bg-purple-100 text-purple-700 border-purple-300' },
];

function TagBadge({ tagId, small = false }: { tagId: string; small?: boolean }) {
  let tag = TRAINING_TAGS.find(t => t.id === tagId);
  if (!tag) tag = TRAINING_TAGS.find(t => t.label === tagId);
  if (!tag) return <span className={`${small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-full font-medium bg-slate-100 text-slate-600`}>{tagId}</span>;
  return (
    <span className={`${small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-full font-medium ${tag.color}`}>
      {tag.label}
    </span>
  );
}

export default function TabletPlansPage() {
  const orientation = useOrientation();
  const [slotsData, setSlotsData] = useState<SlotsData>({ morning: [], afternoon: [], evening: [] });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isOwner = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const [selectedInstructor, setSelectedInstructor] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [description, setDescription] = useState('');

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const changeDate = (delta: number) => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + delta);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(newDate);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);

      const [plansRes, exercisesRes] = await Promise.all([
        apiClient.get(`/plans?date=${selectedDate}`),
        apiClient.get('/exercises')
      ]);

      setSlotsData(plansRes.data.slots || { morning: [], afternoon: [], evening: [] });
      setPlans(plansRes.data.plans || []);
      setExercises(exercisesRes.data.exercises || []);

      const slots = plansRes.data.slots;
      if (slots.evening?.length > 0) setActiveSlot('evening');
      else if (slots.afternoon?.length > 0) setActiveSlot('afternoon');
      else if (slots.morning?.length > 0) setActiveSlot('morning');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const myInstructorId = currentUser?.instructorId || null;
  const currentInstructors = slotsData[activeSlot];
  const currentPlans = plans.filter(p => p.time_slot === activeSlot);
  const instructorsWithoutPlan = currentInstructors.filter(
    i => !currentPlans.some(p => p.instructor_id === i.id)
  );
  const amIScheduled = myInstructorId ? currentInstructors.some(i => i.id === myInstructorId) : false;
  const myPlanExists = myInstructorId ? currentPlans.some(p => p.instructor_id === myInstructorId) : false;
  const canAddPlan = isOwner ? instructorsWithoutPlan.length > 0 : (amIScheduled && !myPlanExists);

  const filteredExercises = useMemo(() => {
    if (selectedTags.length === 0) return exercises;
    return exercises.filter(ex => ex.tags.some(t => selectedTags.includes(t)));
  }, [exercises, selectedTags]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const toggleExercise = (exerciseId: number) => {
    setSelectedExercises(prev => {
      const exists = prev.find(e => e.exercise_id === exerciseId);
      if (exists) return prev.filter(e => e.exercise_id !== exerciseId);
      return [...prev, { exercise_id: exerciseId, note: '' }];
    });
  };

  const updateExerciseNote = (exerciseId: number, note: string) => {
    setSelectedExercises(prev => prev.map(e => e.exercise_id === exerciseId ? { ...e, note } : e));
  };

  const updateExerciseWeight = (exerciseId: number, weight: string) => {
    setSelectedExercises(prev => prev.map(e => e.exercise_id === exerciseId ? { ...e, weight } : e));
  };

  const updateExerciseReps = (exerciseId: number, reps: number | undefined) => {
    setSelectedExercises(prev => prev.map(e => e.exercise_id === exerciseId ? { ...e, reps } : e));
  };

  const isExerciseSelected = (exerciseId: number) => selectedExercises.some(e => e.exercise_id === exerciseId);

  const resetForm = () => {
    setSelectedInstructor(null);
    setSelectedTags([]);
    setSelectedExercises([]);
    setDescription('');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const instructorId = isOwner ? selectedInstructor : myInstructorId;
    if (!instructorId) {
      alert('강사를 선택하세요.');
      return;
    }
    if (selectedExercises.length === 0) {
      alert('최소 1개 이상의 운동을 선택하세요.');
      return;
    }

    try {
      if (editingId) {
        await apiClient.put(`/plans/${editingId}`, { tags: selectedTags, exercises: selectedExercises, description });
      } else {
        await apiClient.post('/plans', {
          date: selectedDate,
          time_slot: activeSlot,
          instructor_id: instructorId,
          tags: selectedTags,
          exercises: selectedExercises,
          description
        });
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const startEdit = (plan: Plan) => {
    if (!isOwner && plan.instructor_id !== myInstructorId) {
      alert('자신의 계획만 수정할 수 있습니다.');
      return;
    }
    setEditingId(plan.id);
    setSelectedInstructor(plan.instructor_id);
    setSelectedTags(plan.tags || []);
    setSelectedExercises(plan.exercises || []);
    setDescription(plan.description || '');
    setShowAddForm(true);
  };

  const handleDelete = async (plan: Plan) => {
    if (!isOwner && plan.instructor_id !== myInstructorId) {
      alert('자신의 계획만 삭제할 수 있습니다.');
      return;
    }
    if (!confirm(`${plan.instructor_name}의 ${TIME_SLOT_INFO[plan.time_slot].label} 계획을 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await apiClient.delete(`/plans/${plan.id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete plan:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const getExerciseName = (exerciseId: number) => {
    return exercises.find(e => e.id === exerciseId)?.name || '알 수 없는 운동';
  };

  const getSlotStats = (slot: TimeSlot) => {
    const scheduled = slotsData[slot].length;
    const planned = plans.filter(p => p.time_slot === slot).length;
    return { scheduled, planned };
  };

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">수업 계획</h1>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => changeDate(-1)} className="p-2 text-slate-400 hover:text-slate-600">
              <ChevronLeft size={24} />
            </button>
            <span className="text-slate-600 font-medium">{formatDateDisplay(selectedDate)}</span>
            <button onClick={() => changeDate(1)} className="p-2 text-slate-400 hover:text-slate-600">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAddPlan && (
            <button
              onClick={() => {
                resetForm();
                if (!isOwner && myInstructorId) setSelectedInstructor(myInstructorId);
                setShowAddForm(true);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">{isOwner ? '계획 추가' : '내 계획'}</span>
            </button>
          )}
          <Link
            href="/tablet/exercises"
            className="flex items-center gap-2 px-4 py-3 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition"
          >
            <Settings2 size={18} />
            <span className="text-sm font-medium">운동 관리</span>
          </Link>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Time Slot Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(Object.keys(TIME_SLOT_INFO) as TimeSlot[]).map((slot) => {
          const info = TIME_SLOT_INFO[slot];
          const Icon = info.icon;
          const stats = getSlotStats(slot);
          const isActive = activeSlot === slot;

          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition flex-shrink-0 ${
                isActive
                  ? `${info.bgColor} ${info.color} ring-2 ring-offset-2`
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{info.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-sm ${isActive ? 'bg-white/50' : 'bg-slate-100'}`}>
                {stats.planned}/{stats.scheduled}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                {editingId ? '계획 수정' : `${TIME_SLOT_INFO[activeSlot].label} 수업 계획`}
              </h2>
              <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Instructor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">강사</label>
                {isOwner ? (
                  <select
                    value={selectedInstructor || ''}
                    onChange={e => setSelectedInstructor(Number(e.target.value))}
                    disabled={!!editingId}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base disabled:bg-slate-100"
                  >
                    <option value="">선택하세요</option>
                    {(editingId ? currentInstructors : instructorsWithoutPlan).map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700">
                    {currentInstructors.find(i => i.id === selectedInstructor)?.name || currentUser?.name}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Tag size={16} className="inline mr-1" />
                  훈련 태그 (운동 필터)
                </label>
                <div className="flex flex-wrap gap-2">
                  {TRAINING_TAGS.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
                        selectedTags.includes(tag.id)
                          ? tag.color + ' ring-2 ring-offset-1 ring-slate-300'
                          : 'bg-slate-100 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exercise Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Dumbbell size={16} className="inline mr-1" />
                  운동 선택 {selectedTags.length > 0 && `(${filteredExercises.length}개)`}
                </label>
                <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                  {filteredExercises.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      {selectedTags.length === 0 ? '태그를 선택하면 운동이 표시됩니다' : '해당 태그의 운동이 없습니다'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredExercises.map(ex => (
                        <div
                          key={ex.id}
                          className={`p-4 cursor-pointer transition ${isExerciseSelected(ex.id) ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                          onClick={() => toggleExercise(ex.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                                isExerciseSelected(ex.id)
                                  ? 'bg-orange-500 border-orange-500 text-white'
                                  : 'border-slate-300'
                              }`}>
                                {isExerciseSelected(ex.id) && <Check size={16} />}
                              </div>
                              <span className="font-medium text-slate-800 dark:text-slate-100">{ex.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {ex.tags.map(t => <TagBadge key={t} tagId={t} small />)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Exercises with Notes */}
              {selectedExercises.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    선택된 운동 ({selectedExercises.length}개)
                  </label>
                  <div className="space-y-2">
                    {selectedExercises.map(sel => {
                      const ex = exercises.find(e => e.id === sel.exercise_id);
                      if (!ex) return null;
                      return (
                        <div key={sel.exercise_id} className="bg-orange-50 p-3 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              onClick={() => toggleExercise(sel.exercise_id)}
                              className="text-slate-400 hover:text-red-500 p-1"
                            >
                              <X size={18} />
                            </button>
                            <span className="font-medium text-slate-700">{ex.name}</span>
                            {ex.video_url && (
                              <a
                                href={ex.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="p-1 text-blue-500 hover:text-blue-600"
                                title="영상 보기"
                              >
                                <Video size={16} />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-8">
                            <input
                              type="text"
                              value={sel.weight || ''}
                              onChange={e => updateExerciseWeight(sel.exercise_id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder="무게/갯수"
                              className="w-24 px-2 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-orange-500"
                            />
                            <span className="text-slate-400 text-sm">×</span>
                            <input
                              type="number"
                              value={sel.reps || ''}
                              onChange={e => updateExerciseReps(sel.exercise_id, e.target.value ? parseInt(e.target.value) : undefined)}
                              onClick={e => e.stopPropagation()}
                              placeholder="횟수"
                              className="w-20 px-2 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-orange-500"
                            />
                            <span className="text-slate-400 text-sm">회</span>
                            <input
                              type="text"
                              value={sel.note}
                              onChange={e => updateExerciseNote(sel.exercise_id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder="세부사항..."
                              className="flex-1 px-2 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-orange-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">추가 메모</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="수업 방향이나 주의사항..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 resize-none text-base"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-6 py-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded-xl hover:bg-slate-200"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
              >
                <Check size={18} />
                <span>{editingId ? '수정' : '저장'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plans List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
            {TIME_SLOT_INFO[activeSlot].label} 수업 계획 ({currentPlans.length}/{currentInstructors.length}명)
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={40} className="animate-spin mx-auto mb-2" />
            <p className="text-lg">로딩 중...</p>
          </div>
        ) : currentInstructors.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-lg">{TIME_SLOT_INFO[activeSlot].label}에 스케줄된 강사가 없습니다.</p>
            <p className="text-sm mt-2">P-ACA에서 강사 스케줄을 등록하세요.</p>
          </div>
        ) : currentPlans.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ClipboardList size={48} className="mx-auto mb-4" />
            <p className="text-lg">아직 작성된 수업 계획이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto">
            {currentPlans.map(plan => (
              <div key={plan.id} className="p-5">
                {/* Plan Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                      {plan.instructor_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{plan.instructor_name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{plan.exercises?.length || 0}개 운동</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                      className="p-3 text-slate-400 hover:text-slate-600"
                    >
                      {expandedPlanId === plan.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {(isOwner || plan.instructor_id === myInstructorId) && (
                      <>
                        <button
                          onClick={() => startEdit(plan)}
                          className="p-3 text-slate-400 hover:text-slate-600"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => handleDelete(plan)}
                          className="p-3 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={20} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {plan.tags && plan.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {plan.tags.map(tagId => <TagBadge key={tagId} tagId={tagId} />)}
                  </div>
                )}

                {/* Exercises */}
                {plan.exercises && plan.exercises.length > 0 && (
                  <div className={expandedPlanId === plan.id ? '' : 'line-clamp-2'}>
                    <div className="space-y-1">
                      {plan.exercises.map((sel, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Dumbbell size={16} className="text-orange-500 flex-shrink-0" />
                          <span className="font-medium text-slate-700">{getExerciseName(sel.exercise_id)}</span>
                          {(sel.weight || sel.reps) && (
                            <span className="text-orange-600 font-medium">
                              {sel.weight && sel.weight}{sel.weight && sel.reps && ' × '}{sel.reps && `${sel.reps}회`}
                            </span>
                          )}
                          {sel.note && <span className="text-slate-500 dark:text-slate-400">- {sel.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {plan.description && (
                  <p className="text-slate-600 text-sm mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    {plan.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {currentInstructors.length > 0 && instructorsWithoutPlan.length > 0 && (
        <div className="mt-4 bg-slate-100 rounded-xl p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            미작성: {instructorsWithoutPlan.map(i => i.name).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
