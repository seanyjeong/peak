'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Sunrise,
  Sun,
  Moon,
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw
} from 'lucide-react';
import { authAPI } from '@/lib/api/auth';

interface ExerciseTag {
  id: number;
  tag_id: string;
  label: string;
  color: string;
}

interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets?: number;
  default_reps?: number;
}

interface DailyPlan {
  id: number;
  date: string;
  time_slot: string;
  instructor_id: number;
  instructor_name: string;
  focus_areas: string;
  exercises: { id: number; name: string; sets?: number; reps?: number; notes?: string }[];
  notes: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com';

const timeSlotConfig = [
  { key: 'morning', label: '오전', icon: Sunrise },
  { key: 'afternoon', label: '오후', icon: Sun },
  { key: 'evening', label: '저녁', icon: Moon },
];

export default function MobilePlansPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('morning');
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [tags, setTags] = useState<ExerciseTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DailyPlan | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tags', 'exercises']));

  // 폼 상태
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<{ id: number; name: string; sets?: number; reps?: number; notes?: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // 유저 정보
  const [user, setUser] = useState<{ id: number; name: string; role?: string } | null>(null);

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    setUser(currentUser);
  }, []);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = authAPI.getToken();
      const headers = { Authorization: `Bearer ${token}` };

      // 계획 로드
      const planRes = await fetch(
        `${API_BASE}/peak/daily-plans?date=${selectedDate}&time_slot=${selectedTimeSlot}`,
        { headers }
      );
      const planData = await planRes.json();
      setPlans(planData.plans || []);

      // 태그 로드
      const tagRes = await fetch(`${API_BASE}/peak/exercise-tags`, { headers });
      const tagData = await tagRes.json();
      setTags((tagData.tags || []).filter((t: ExerciseTag) => t.tag_id));

      // 운동 로드
      const exRes = await fetch(`${API_BASE}/peak/exercises`, { headers });
      const exData = await exRes.json();
      setExercises(exData.exercises || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTimeSlot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 날짜 변경
  const changeDate = (delta: number) => {
    const newDate = delta > 0
      ? addDays(new Date(selectedDate), 1)
      : subDays(new Date(selectedDate), 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  // 섹션 토글
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // 폼 열기
  const openForm = (plan?: DailyPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setSelectedTags(plan.focus_areas ? plan.focus_areas.split(',').map(t => t.trim()) : []);
      setSelectedExercises(plan.exercises || []);
      setNotes(plan.notes || '');
    } else {
      setEditingPlan(null);
      setSelectedTags([]);
      setSelectedExercises([]);
      setNotes('');
    }
    setShowForm(true);
  };

  // 폼 닫기
  const closeForm = () => {
    setShowForm(false);
    setEditingPlan(null);
  };

  // 태그 토글
  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  // 운동 토글
  const toggleExercise = (exercise: Exercise) => {
    setSelectedExercises(prev => {
      const exists = prev.find(e => e.id === exercise.id);
      if (exists) {
        return prev.filter(e => e.id !== exercise.id);
      }
      return [...prev, {
        id: exercise.id,
        name: exercise.name,
        sets: exercise.default_sets,
        reps: exercise.default_reps,
      }];
    });
  };

  // 저장
  const savePlan = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const token = authAPI.getToken();
      const body = {
        date: selectedDate,
        time_slot: selectedTimeSlot,
        instructor_id: user.id,
        focus_areas: selectedTags.join(', '),
        exercises: selectedExercises,
        notes,
      };

      const url = editingPlan
        ? `${API_BASE}/peak/daily-plans/${editingPlan.id}`
        : `${API_BASE}/peak/daily-plans`;

      const response = await fetch(url, {
        method: editingPlan ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        closeForm();
        loadData();
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const deletePlan = async (planId: number) => {
    if (!confirm('삭제하시겠습니까?')) return;

    try {
      const token = authAPI.getToken();
      await fetch(`${API_BASE}/peak/daily-plans/${planId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const koreanDate = format(new Date(selectedDate), 'M월 d일 (E)', { locale: ko });

  // 선택된 태그에 해당하는 운동 필터링
  const filteredExercises = selectedTags.length > 0
    ? exercises.filter(ex => ex.tags?.some(t => selectedTags.includes(t)))
    : exercises;

  return (
    <div className="space-y-3">
      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
        <button
          onClick={() => changeDate(-1)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <div className="text-center">
          <p className="font-bold text-slate-800">{koreanDate}</p>
          <p className="text-xs text-slate-500">{selectedDate}</p>
        </div>
        <button
          onClick={() => changeDate(1)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* 시간대 탭 */}
      <div className="flex gap-2">
        {timeSlotConfig.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSelectedTimeSlot(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl font-medium text-sm transition ${
              selectedTimeSlot === key
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {/* 계획 리스트 */}
          <div className="space-y-2">
            {plans.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <p className="text-slate-500 text-sm">등록된 계획이 없습니다</p>
              </div>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{plan.instructor_name}</p>
                      {plan.focus_areas && (
                        <p className="text-xs text-orange-600 mt-1">{plan.focus_areas}</p>
                      )}
                      {plan.exercises && plan.exercises.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          {plan.exercises.map(e => e.name).join(', ')}
                        </p>
                      )}
                      {plan.notes && (
                        <p className="text-xs text-slate-400 mt-2">{plan.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openForm(plan)}
                        className="p-2 text-slate-400 hover:text-slate-600"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id)}
                        className="p-2 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 추가 버튼 */}
          <button
            onClick={() => openForm()}
            className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-md"
          >
            <Plus size={18} />
            <span>계획 추가</span>
          </button>
        </>
      )}

      {/* 바텀시트 폼 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={closeForm}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto safe-area-pb"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 핸들 & 헤더 */}
            <div className="sticky top-0 bg-white pt-3 pb-2 px-4 border-b border-slate-100">
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-slate-800">
                  {editingPlan ? '계획 수정' : '계획 추가'}
                </h2>
                <button onClick={closeForm} className="p-2 text-slate-400">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* 태그 선택 */}
              <div>
                <button
                  onClick={() => toggleSection('tags')}
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="font-medium text-slate-800">태그 선택</span>
                  {expandedSections.has('tags') ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>
                {expandedSections.has('tags') && (
                  <div className="space-y-2 mt-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.tag_id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${
                          selectedTags.includes(tag.tag_id)
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-slate-200'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm font-medium text-slate-700">{tag.label}</span>
                        {selectedTags.includes(tag.tag_id) && (
                          <Check size={16} className="ml-auto text-orange-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 운동 선택 */}
              <div>
                <button
                  onClick={() => toggleSection('exercises')}
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="font-medium text-slate-800">
                    운동 선택 ({selectedExercises.length}개)
                  </span>
                  {expandedSections.has('exercises') ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>
                {expandedSections.has('exercises') && (
                  <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                    {filteredExercises.map((ex) => {
                      const isSelected = selectedExercises.some(e => e.id === ex.id);
                      return (
                        <button
                          key={ex.id}
                          onClick={() => toggleExercise(ex)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-slate-200'
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-700">{ex.name}</span>
                          {isSelected && (
                            <Check size={16} className="ml-auto text-orange-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 메모 */}
              <div>
                <label className="block font-medium text-slate-800 mb-2">메모</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="추가 메모..."
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm resize-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={savePlan}
                disabled={saving}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                <span>{saving ? '저장 중...' : '저장'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
