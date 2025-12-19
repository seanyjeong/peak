'use client';

import { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, RefreshCw, Tag, Edit2, Check, X, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI, User } from '@/lib/api/auth';

interface Trainer {
  id: number;
  name: string;
  paca_user_id?: number;
}

interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets: number | null;
  default_reps: number | null;
  description: string | null;
}

interface SelectedExercise {
  exercise_id: number;
  note: string;
}

interface Plan {
  id: number;
  trainer_id: number;
  trainer_name: string;
  tags: string[];
  exercises: SelectedExercise[];
  description: string;
  date: string;
}

// 훈련 태그 목록
const TRAINING_TAGS = [
  { id: 'lower-power', label: '하체 파워', color: 'bg-red-100 text-red-700 border-red-300' },
  { id: 'upper-power', label: '상체 파워', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'agility', label: '민첩성', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { id: 'flexibility', label: '유연성', color: 'bg-green-100 text-green-700 border-green-300' },
  { id: 'technique', label: '기술/자세', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'conditioning', label: '컨디셔닝', color: 'bg-purple-100 text-purple-700 border-purple-300' },
];

function TagBadge({ tagId, small = false }: { tagId: string; small?: boolean }) {
  // tagId가 영문 ID인지 한글 라벨인지 확인
  let tag = TRAINING_TAGS.find(t => t.id === tagId);
  if (!tag) {
    // 한글 라벨로 검색
    tag = TRAINING_TAGS.find(t => t.label === tagId);
  }
  if (!tag) return <span className={`${small ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'} rounded-full font-medium bg-slate-100 text-slate-600`}>{tagId}</span>;
  return (
    <span className={`${small ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'} rounded-full font-medium ${tag.color}`}>
      {tag.label}
    </span>
  );
}

export default function PlansPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  // 현재 로그인 사용자 정보
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [myTrainerId, setMyTrainerId] = useState<number | null>(null);
  // admin 또는 owner는 관리자 권한
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  // Form state
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [description, setDescription] = useState('');

  // 로컬 날짜 (KST)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateStr = getLocalDateString();

      // 현재 사용자 정보 가져오기
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);

      const [trainersRes, plansRes, exercisesRes] = await Promise.all([
        apiClient.get('/trainers'),
        apiClient.get(`/plans?date=${dateStr}`),
        apiClient.get('/exercises')
      ]);

      const trainerList = trainersRes.data.trainers || [];
      setTrainers(trainerList);
      setExercises(exercisesRes.data.exercises || []);
      setPlans(plansRes.data.plans || []);

      // 현재 사용자의 trainer_id 찾기 (paca_user_id로 매칭)
      if (user && user.role !== 'admin') {
        const myTrainer = trainerList.find((t: Trainer) => t.paca_user_id === user.id);
        if (myTrainer) {
          setMyTrainerId(myTrainer.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 선택된 태그에 해당하는 운동만 필터링 (DB에 영문 ID로 저장됨)
  const filteredExercises = useMemo(() => {
    if (selectedTags.length === 0) return exercises;
    return exercises.filter(ex =>
      ex.tags.some(t => selectedTags.includes(t))
    );
  }, [exercises, selectedTags]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const toggleExercise = (exerciseId: number) => {
    setSelectedExercises(prev => {
      const exists = prev.find(e => e.exercise_id === exerciseId);
      if (exists) {
        return prev.filter(e => e.exercise_id !== exerciseId);
      } else {
        return [...prev, { exercise_id: exerciseId, note: '' }];
      }
    });
  };

  const updateExerciseNote = (exerciseId: number, note: string) => {
    setSelectedExercises(prev =>
      prev.map(e =>
        e.exercise_id === exerciseId ? { ...e, note } : e
      )
    );
  };

  const isExerciseSelected = (exerciseId: number) => {
    return selectedExercises.some(e => e.exercise_id === exerciseId);
  };

  const getExerciseNote = (exerciseId: number) => {
    return selectedExercises.find(e => e.exercise_id === exerciseId)?.note || '';
  };

  const resetForm = () => {
    setSelectedTrainer(null);
    setSelectedTags([]);
    setSelectedExercises([]);
    setDescription('');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!selectedTrainer) {
      alert('트레이너를 선택하세요.');
      return;
    }

    if (selectedExercises.length === 0) {
      alert('최소 1개 이상의 운동을 선택하세요.');
      return;
    }

    try {
      const dateStr = getLocalDateString();

      if (editingId) {
        await apiClient.put(`/plans/${editingId}`, {
          tags: selectedTags,
          exercises: selectedExercises,
          description
        });
      } else {
        await apiClient.post('/plans', {
          date: dateStr,
          trainer_id: selectedTrainer,
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
    setEditingId(plan.id);
    setSelectedTrainer(plan.trainer_id);
    setSelectedTags(plan.tags || []);
    setSelectedExercises(plan.exercises || []);
    setDescription(plan.description || '');
    setShowAddForm(true);
  };

  const getExerciseName = (exerciseId: number) => {
    return exercises.find(e => e.id === exerciseId)?.name || '알 수 없는 운동';
  };

  // 계획이 없는 트레이너 목록
  const trainersWithoutPlan = trainers.filter(
    t => !plans.some(p => p.trainer_id === t.id)
  );

  // 현재 사용자가 계획 추가 가능한지 확인
  const canAddPlan = isAdmin
    ? trainersWithoutPlan.length > 0
    : (myTrainerId && !plans.some(p => p.trainer_id === myTrainerId));

  // 내 계획 이미 있는지 확인
  const myPlanExists = myTrainerId && plans.some(p => p.trainer_id === myTrainerId);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">훈련 계획</h1>
          <p className="text-slate-500 mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {canAddPlan && (
            <button
              onClick={() => {
                resetForm();
                // 트레이너는 자동으로 자기 ID 선택
                if (!isAdmin && myTrainerId) {
                  setSelectedTrainer(myTrainerId);
                }
                setShowAddForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <Plus size={18} />
              <span>{isAdmin ? '계획 추가' : '내 계획 작성'}</span>
            </button>
          )}
          {!isAdmin && myPlanExists && (
            <span className="text-sm text-green-600 font-medium">✓ 오늘 계획 작성 완료</span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">
              {editingId ? '계획 수정' : '새 계획 작성'}
            </h2>
            <button
              onClick={resetForm}
              className="p-2 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Trainer Select */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              트레이너
            </label>
            {isAdmin ? (
              <select
                value={selectedTrainer || ''}
                onChange={e => setSelectedTrainer(Number(e.target.value))}
                disabled={!!editingId}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-slate-100"
              >
                <option value="">선택하세요</option>
                {(editingId ? trainers : trainersWithoutPlan).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : (
              <div className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                {trainers.find(t => t.id === selectedTrainer)?.name || currentUser?.name}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Tag size={16} className="inline mr-1" />
              훈련 태그 (운동 필터)
            </label>
            <div className="flex flex-wrap gap-2">
              {TRAINING_TAGS.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition border ${
                    selectedTags.includes(tag.id)
                      ? tag.color + ' ring-2 ring-offset-1 ring-slate-300'
                      : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Dumbbell size={16} className="inline mr-1" />
              운동 선택 {selectedTags.length > 0 && `(${filteredExercises.length}개)`}
            </label>
            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
              {filteredExercises.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  {selectedTags.length === 0 ? '태그를 선택하면 운동이 표시됩니다' : '해당 태그의 운동이 없습니다'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredExercises.map(ex => (
                    <div
                      key={ex.id}
                      className={`p-3 cursor-pointer transition ${
                        isExerciseSelected(ex.id)
                          ? 'bg-orange-50'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => toggleExercise(ex.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isExerciseSelected(ex.id)
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'border-slate-300'
                          }`}>
                            {isExerciseSelected(ex.id) && <Check size={14} />}
                          </div>
                          <span className="font-medium text-slate-800">{ex.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {ex.tags.map(t => (
                            <TagBadge key={t} tagId={t} small />
                          ))}
                        </div>
                      </div>
                      {ex.description && (
                        <p className="text-xs text-slate-500 mt-1 ml-7">{ex.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Exercises with Notes */}
          {selectedExercises.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                선택된 운동 ({selectedExercises.length}개) - 세부사항 입력
              </label>
              <div className="space-y-2">
                {selectedExercises.map(sel => {
                  const ex = exercises.find(e => e.id === sel.exercise_id);
                  if (!ex) return null;
                  return (
                    <div key={sel.exercise_id} className="flex items-center gap-2 bg-orange-50 p-2 rounded-lg">
                      <button
                        onClick={() => toggleExercise(sel.exercise_id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                      <span className="font-medium text-slate-700 min-w-[100px]">{ex.name}</span>
                      <input
                        type="text"
                        value={sel.note}
                        onChange={e => updateExerciseNote(sel.exercise_id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder={ex.default_sets && ex.default_reps ? `예: ${ex.default_reps}회 ${ex.default_sets}세트` : '세부사항 입력...'}
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              추가 메모 (선택)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="전체적인 훈련 방향이나 주의사항..."
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <Check size={18} />
              <span>{editingId ? '수정' : '저장'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Plans List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">오늘의 훈련 계획이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">계획 추가 버튼을 눌러 작성하세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map(plan => (
            <div
              key={plan.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Plan Header */}
              <div className="bg-orange-50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-medium">
                    {plan.trainer_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{plan.trainer_name}</p>
                    <p className="text-sm text-slate-500">{plan.exercises?.length || 0}개 운동</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition"
                  >
                    {expandedPlanId === plan.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <button
                    onClick={() => startEdit(plan)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              </div>

              {/* Plan Content */}
              <div className="px-6 py-4">
                {/* Tags */}
                {plan.tags && plan.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {plan.tags.map(tagId => (
                      <TagBadge key={tagId} tagId={tagId} />
                    ))}
                  </div>
                )}

                {/* Exercises Summary */}
                {plan.exercises && plan.exercises.length > 0 && (
                  <div className={expandedPlanId === plan.id ? '' : 'line-clamp-2'}>
                    <div className="space-y-1">
                      {plan.exercises.map((sel, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Dumbbell size={14} className="text-orange-500 flex-shrink-0" />
                          <span className="font-medium text-slate-700">{getExerciseName(sel.exercise_id)}</span>
                          {sel.note && <span className="text-slate-500">- {sel.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {plan.description && (
                  <p className="text-slate-600 text-sm mt-3 pt-3 border-t border-slate-100">
                    {plan.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 bg-slate-50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">계획 작성 현황</span>
          <span className="font-medium text-slate-800">
            {plans.length}/{trainers.length}명 완료
          </span>
        </div>
        {trainersWithoutPlan.length > 0 && (
          <p className="text-sm text-slate-500 mt-2">
            미작성: {trainersWithoutPlan.map(t => t.name).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
