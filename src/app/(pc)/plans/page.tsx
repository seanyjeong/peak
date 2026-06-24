'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI, User } from '@/lib/api/auth';
import { useToast } from '@/hooks/useToast';
import { ReorderButtons } from '@/components/ui/reorder-buttons';
import {
  EMPTY_SLOTS,
  Exercise,
  ExerciseTag,
  filterExercises,
  formatKoreanDate,
  getSlotStats,
  Plan,
  SelectedExercise,
  shiftIsoDate,
  SLOT_LABELS,
  TimeSlot,
  TIME_SLOTS,
  todayIsoDate,
} from './plans-model';
import { ExerciseVideoLink, PlanCard, SlotButton, TagBadge } from './plans-ui';

export default function PlansPage() {
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(todayIsoDate);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [slotsData, setSlotsData] = useState(EMPTY_SLOTS);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseTags, setExerciseTags] = useState<ExerciseTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [description, setDescription] = useState('');
  const [exerciseSearch, setExerciseSearch] = useState('');

  const isOwner = currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const myInstructorId = currentUser?.instructorId || null;
  const currentInstructors = slotsData[activeSlot];
  const currentPlans = plans.filter((plan) => plan.time_slot === activeSlot);
  const instructorsWithoutPlan = currentInstructors.filter(
    (instructor) => !currentPlans.some((plan) => plan.instructor_id === instructor.id)
  );
  const amIScheduled = myInstructorId ? currentInstructors.some((instructor) => instructor.id === myInstructorId) : false;
  const myPlanExists = myInstructorId ? currentPlans.some((plan) => plan.instructor_id === myInstructorId) : false;
  const canAddPlan = isOwner ? instructorsWithoutPlan.length > 0 : amIScheduled && !myPlanExists;

  const visibleExercises = useMemo(
    () => filterExercises(exercises, selectedTags, exerciseSearch),
    [exercises, exerciseSearch, selectedTags]
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      setCurrentUser(authAPI.getCurrentUser());
      const [plansRes, exercisesRes, tagsRes] = await Promise.all([
        apiClient.get(`/plans?date=${selectedDate}`),
        apiClient.get('/exercises'),
        apiClient.get('/exercise-tags'),
      ]);

      const nextSlots = plansRes.data.slots || EMPTY_SLOTS;
      setSlotsData(nextSlots);
      setPlans(plansRes.data.plans || []);
      setExercises(exercisesRes.data.exercises || []);
      setExerciseTags(tagsRes.data.tags || []);

      const firstSlot = TIME_SLOTS.find((slot) => nextSlots[slot]?.length > 0);
      if (firstSlot) setActiveSlot((current) => (nextSlots[current]?.length ? current : firstSlot));
    } catch {
      toast.error('수업 계획을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // fetchData는 selectedDate 기준 API 호출이라 날짜 변경 때만 재호출합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSelectedInstructor(null);
    setSelectedTags([]);
    setSelectedExercises([]);
    setDescription('');
    setExerciseSearch('');
  };

  const startCreate = () => {
    resetForm();
    setSelectedInstructor(!isOwner && myInstructorId ? myInstructorId : null);
    setShowForm(true);
  };

  const startEdit = (plan: Plan) => {
    if (!isOwner && plan.instructor_id !== myInstructorId) {
      toast.error('내가 작성한 계획만 수정할 수 있습니다.');
      return;
    }
    setEditingId(plan.id);
    setSelectedInstructor(plan.instructor_id);
    setSelectedTags(plan.tags || []);
    setSelectedExercises(plan.exercises || []);
    setDescription(plan.description || '');
    setShowForm(true);
  };

  const savePlan = async () => {
    const instructorId = isOwner ? selectedInstructor : myInstructorId;
    if (!instructorId) {
      toast.error('강사를 선택해주세요.');
      return;
    }
    if (selectedExercises.length === 0) {
      toast.error('운동을 1개 이상 선택해주세요.');
      return;
    }

    try {
      if (editingId) {
        await apiClient.put(`/plans/${editingId}`, { tags: selectedTags, exercises: selectedExercises, description });
        toast.success('수업 계획을 수정했습니다.');
      } else {
        await apiClient.post('/plans', {
          date: selectedDate,
          time_slot: activeSlot,
          instructor_id: instructorId,
          tags: selectedTags,
          exercises: selectedExercises,
          description,
        });
        toast.success('수업 계획을 저장했습니다.');
      }
      resetForm();
      await fetchData();
    } catch {
      toast.error('수업 계획을 저장하지 못했습니다. 입력 내용을 확인해주세요.');
    }
  };

  const deletePlan = async (plan: Plan) => {
    if (!isOwner && plan.instructor_id !== myInstructorId) {
      toast.error('내가 작성한 계획만 삭제할 수 있습니다.');
      return;
    }
    if (!window.confirm(`${plan.instructor_name} ${SLOT_LABELS[plan.time_slot]} 계획을 삭제할까요?`)) return;

    try {
      await apiClient.delete(`/plans/${plan.id}`);
      toast.success('수업 계획을 삭제했습니다.');
      await fetchData();
    } catch {
      toast.error('수업 계획을 삭제하지 못했습니다.');
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((current) => current.includes(tagId) ? current.filter((tag) => tag !== tagId) : [...current, tagId]);
  };

  const toggleExercise = (exerciseId: number) => {
    setSelectedExercises((current) => {
      if (current.some((exercise) => exercise.exercise_id === exerciseId)) {
        return current.filter((exercise) => exercise.exercise_id !== exerciseId);
      }
      return [...current, { exercise_id: exerciseId, note: '' }];
    });
  };

  const updateSelectedExercise = (exerciseId: number, patch: Partial<SelectedExercise>) => {
    setSelectedExercises((current) => (
      current.map((exercise) => exercise.exercise_id === exerciseId ? { ...exercise, ...patch } : exercise)
    ));
  };

  const moveSelectedExercise = (index: number, direction: -1 | 1) => {
    setSelectedExercises((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-emerald-700">LESSON PLAN</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-slate-950">수업 계획</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelectedDate(shiftIsoDate(selectedDate, -1))} className="rounded-lg border border-slate-200 bg-white p-2">
              <ChevronLeft className="size-4" />
            </button>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              <Calendar className="size-4 text-slate-400" />
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="bg-transparent outline-none" />
            </label>
            <button type="button" onClick={() => setSelectedDate(shiftIsoDate(selectedDate, 1))} className="rounded-lg border border-slate-200 bg-white p-2">
              <ChevronRight className="size-4" />
            </button>
            <span className="text-sm font-semibold text-slate-500">{formatKoreanDate(selectedDate)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAddPlan && (
            <button type="button" onClick={startCreate} className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800">
              <Plus className="size-4" />
              {isOwner ? '계획 추가' : '내 계획 작성'}
            </button>
          )}
          <Link href="/exercises" className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Settings2 className="size-4" />
            운동 관리
          </Link>
          <button type="button" onClick={fetchData} disabled={loading} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-3">
        {TIME_SLOTS.map((slot) => {
          const stats = getSlotStats(slotsData, plans, slot);
          return (
            <SlotButton
              key={slot}
              active={activeSlot === slot}
              onClick={() => setActiveSlot(slot)}
              planned={stats.planned}
              scheduled={stats.scheduled}
              slot={slot}
            />
          );
        })}
      </section>

      {showForm && (
        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950">{editingId ? '계획 수정' : `${SLOT_LABELS[activeSlot]} 계획 작성`}</h2>
              <button type="button" onClick={resetForm} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">강사</span>
              {isOwner ? (
                <select
                  value={selectedInstructor || ''}
                  onChange={(event) => setSelectedInstructor(event.target.value ? Number(event.target.value) : null)}
                  disabled={!!editingId}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-slate-900 disabled:bg-slate-100"
                >
                  <option value="">선택하세요</option>
                  {(editingId ? currentInstructors : instructorsWithoutPlan).map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                  ))}
                </select>
              ) : (
                <div className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">{currentUser?.name || '내 계정'}</div>
              )}
            </label>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">훈련 태그</p>
              <div className="flex flex-wrap gap-2">
                {exerciseTags.map((tag) => (
                  <button
                    key={tag.tag_id}
                    type="button"
                    onClick={() => toggleTag(tag.tag_id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                      selectedTags.includes(tag.tag_id) ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">운동 선택</label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={exerciseSearch}
                  onChange={(event) => setExerciseSearch(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-900"
                  placeholder="운동명 검색"
                />
              </div>
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {visibleExercises.map((exercise) => {
                  const selected = selectedExercises.some((item) => item.exercise_id === exercise.id);
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => toggleExercise(exercise.id)}
                      className={`rounded-lg border p-3 text-left transition ${selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-bold text-slate-900">{exercise.name}</span>
                        <ExerciseVideoLink url={exercise.video_url} />
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1">
                        {exercise.tags.map((tagId) => <TagBadge key={tagId} tagId={tagId} tags={exerciseTags} small />)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg bg-slate-50 p-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">선택된 운동 {selectedExercises.length}개</h3>
              <div className="mt-3 space-y-3">
                {selectedExercises.map((selected, index) => {
                  const exercise = exercises.find((item) => item.id === selected.exercise_id);
                  if (!exercise) return null;
                  return (
                    <div key={selected.exercise_id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-bold text-slate-900"><Dumbbell className="size-4 text-emerald-600" />{exercise.name}</span>
                        <div className="flex items-center gap-1">
                          <ReorderButtons index={index} total={selectedExercises.length} onMoveUp={() => moveSelectedExercise(index, -1)} onMoveDown={() => moveSelectedExercise(index, 1)} size="sm" />
                          <button type="button" onClick={() => toggleExercise(selected.exercise_id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50"><X className="size-4" /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_84px] gap-2">
                        <input value={selected.weight || ''} onChange={(event) => updateSelectedExercise(selected.exercise_id, { weight: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900" placeholder="무게/개수" />
                        <input type="number" value={selected.reps || ''} onChange={(event) => updateSelectedExercise(selected.exercise_id, { reps: event.target.value ? Number(event.target.value) : undefined })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900" placeholder="횟수" />
                      </div>
                      <input value={selected.note} onChange={(event) => updateSelectedExercise(selected.exercise_id, { note: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900" placeholder="세부사항" />
                    </div>
                  );
                })}
                {selectedExercises.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">왼쪽에서 운동을 선택하세요.</p>}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">추가 메모</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-900" placeholder="수업 방향이나 주의사항" />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">취소</button>
              <button type="button" onClick={savePlan} className="flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                <Check className="size-4" />
                {editingId ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950">{SLOT_LABELS[activeSlot]} 수업 계획</h2>
            <span className="text-sm font-semibold text-slate-500">{currentPlans.length} / {currentInstructors.length}명 작성</span>
          </div>
          {loading && <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500">불러오는 중입니다.</div>}
          {!loading && currentInstructors.length === 0 && <EmptyState message={`${SLOT_LABELS[activeSlot]}에 스케줄된 강사가 없습니다.`} />}
          {!loading && currentInstructors.length > 0 && currentPlans.length === 0 && <EmptyState message="아직 작성된 수업 계획이 없습니다." />}
          {!loading && currentPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              canManage={isOwner || plan.instructor_id === myInstructorId}
              exerciseTags={exerciseTags}
              exercises={exercises}
              expanded={expandedPlanId === plan.id}
              onDelete={() => deletePlan(plan)}
              onEdit={() => startEdit(plan)}
              onToggle={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
              plan={plan}
            />
          ))}
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-normal text-slate-500">PLAN STATUS</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">작성 현황</h3>
          <div className="mt-4 space-y-2">
            {currentInstructors.map((instructor) => {
              const done = currentPlans.some((plan) => plan.instructor_id === instructor.id);
              return (
                <div key={instructor.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-slate-800">{instructor.name}</span>
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {done ? '작성' : '미작성'}
                  </span>
                </div>
              );
            })}
          </div>
          {!isOwner && amIScheduled && !myPlanExists && !showForm && (
            <button type="button" onClick={startCreate} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-bold text-white">
              <Plus className="size-4" />
              내 계획 작성
            </button>
          )}
        </aside>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <ClipboardList className="mx-auto size-10 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-500">{message}</p>
    </div>
  );
}
