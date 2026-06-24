'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI, User as AuthUser } from '@/lib/api/auth';
import { useToast } from '@/hooks/useToast';
import {
  ExistingLog,
  Exercise,
  findTrainerForStudent,
  formatKoreanDate,
  getAvailableSlots,
  getStudentsForSelection,
  Plan,
  ScheduledInstructor,
  shiftIsoDate,
  SlotData,
  TimeSlot,
  todayIsoDate,
} from './training-model';
import { ChecklistPanel, EmptyState, SlotTabs, StudentConditionPanel } from './training-ui';

export default function TrainingPage() {
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(todayIsoDate);
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [planSlots, setPlanSlots] = useState<Record<string, ScheduledInstructor[]>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [existingLogs, setExistingLogs] = useState<ExistingLog[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | ''>('');
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseNote, setNewExerciseNote] = useState('');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const availableSlots = useMemo(() => getAvailableSlots(slots), [slots]);
  const currentSlotData = selectedSlot ? slots[selectedSlot] : undefined;
  const currentInstructors = selectedSlot ? planSlots[selectedSlot] || [] : [];
  const currentPlan = selectedSlot
    ? plans.find((plan) => plan.time_slot === selectedSlot && (selectedInstructorId ? plan.instructor_id === selectedInstructorId : true))
    : undefined;
  const students = useMemo(
    () => getStudentsForSelection(currentSlotData, isAdmin, selectedInstructorId),
    [currentSlotData, isAdmin, selectedInstructorId]
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);
      const [assignmentsRes, trainingRes, plansRes, exercisesRes] = await Promise.all([
        apiClient.get(`/assignments?date=${selectedDate}`),
        apiClient.get(`/training?date=${selectedDate}`),
        apiClient.get(`/plans?date=${selectedDate}`),
        apiClient.get('/exercises'),
      ]);

      const nextSlots = assignmentsRes.data.slots || {};
      const nextPlanSlots = plansRes.data.slots || {};
      setSlots(nextSlots);
      setPlanSlots(nextPlanSlots);
      setExistingLogs(trainingRes.data.logs || []);
      setPlans(plansRes.data.plans || []);
      setExercises(exercisesRes.data.exercises || []);
      applyDefaultSelection(nextSlots, nextPlanSlots, user);
    } catch {
      toast.error('수업 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const applyDefaultSelection = (
    nextSlots: Record<string, SlotData>,
    nextPlanSlots: Record<string, ScheduledInstructor[]>,
    user: AuthUser | null
  ) => {
    const slotsWithStudents = getAvailableSlots(nextSlots);
    const userInstructorId = user?.instructorId || null;
    const admin = user?.role === 'admin' || user?.role === 'owner';

    if (!admin && userInstructorId) {
      const mySlot = slotsWithStudents.find((slot) => (
        (nextPlanSlots[slot] || []).some((instructor) => instructor.id === userInstructorId)
      ));
      if (mySlot) {
        setSelectedSlot(mySlot);
        setSelectedInstructorId(userInstructorId);
        return;
      }
    }

    if (slotsWithStudents.length > 0) {
      setSelectedSlot((current) => (current && slotsWithStudents.includes(current) ? current : slotsWithStudents[0]));
      setSelectedInstructorId((current) => (admin ? current : null));
    } else {
      setSelectedSlot('');
      setSelectedInstructorId(null);
    }
  };

  useEffect(() => {
    void fetchData();
    // fetchData는 selectedDate 기준 API 호출이라 날짜 변경 때만 재호출합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    setTemperature(currentPlan?.temperature?.toString() || '');
    setHumidity(currentPlan?.humidity?.toString() || '');
  }, [currentPlan?.id, currentPlan?.temperature, currentPlan?.humidity]);

  const updatePlan = (planId: number, patch: Partial<Plan>) => {
    setPlans((current) => current.map((plan) => plan.id === planId ? { ...plan, ...patch } : plan));
  };

  const updateSlotPlans = (slot: TimeSlot, patch: Partial<Plan>) => {
    setPlans((current) => current.map((plan) => plan.time_slot === slot ? { ...plan, ...patch } : plan));
  };

  const saveConditions = async (checked?: boolean) => {
    if (!currentPlan) return;
    const nextChecked = checked ?? Boolean(temperature || humidity || currentPlan.conditions_checked);
    try {
      const response = await apiClient.put(`/plans/${currentPlan.id}/conditions`, {
        temperature: temperature ? Number(temperature) : null,
        humidity: humidity ? Number(humidity) : null,
        checked: nextChecked,
      });
      updateSlotPlans(currentPlan.time_slot, {
        temperature: temperature ? Number(temperature) : null,
        humidity: humidity ? Number(humidity) : null,
        conditions_checked: nextChecked ? 1 : 0,
        conditions_checked_at: response.data.checked_at,
      });
    } catch {
      toast.error('체육관 환경 정보를 저장하지 못했습니다.');
    }
  };

  const toggleExercise = async (exerciseId: number) => {
    if (!currentPlan) return;
    try {
      const response = await apiClient.put(`/plans/${currentPlan.id}/toggle-exercise`, { exercise_id: exerciseId });
      updatePlan(currentPlan.id, {
        completed_exercises: response.data.completed_exercises,
        exercise_times: response.data.exercise_times || {},
      });
    } catch {
      toast.error('운동 완료 상태를 저장하지 못했습니다.');
    }
  };

  const toggleExtraExercise = async (index: number) => {
    if (!currentPlan) return;
    try {
      const response = await apiClient.put(`/plans/${currentPlan.id}/toggle-extra`, { index });
      updatePlan(currentPlan.id, { extra_exercises: response.data.extra_exercises });
    } catch {
      toast.error('추가 운동 상태를 저장하지 못했습니다.');
    }
  };

  const addExtraExercise = async () => {
    if (!currentPlan || !newExerciseName.trim()) return;
    try {
      const response = await apiClient.post(`/plans/${currentPlan.id}/extra-exercise`, {
        name: newExerciseName.trim(),
        note: newExerciseNote.trim() || undefined,
      });
      updatePlan(currentPlan.id, { extra_exercises: response.data.extra_exercises });
      closeAddExercise();
    } catch {
      toast.error('추가 운동을 저장하지 못했습니다.');
    }
  };

  const closeAddExercise = () => {
    setShowAddExercise(false);
    setNewExerciseName('');
    setNewExerciseNote('');
  };

  const saveCondition = async (studentId: number, score: number | null) => {
    const existing = existingLogs.find((log) => log.student_id === studentId);
    const trainerId = selectedInstructorId || findTrainerForStudent(currentSlotData, studentId) || currentUser?.instructorId || null;

    if (!trainerId) {
      toast.error('컨디션을 저장할 담당 강사를 확인하지 못했습니다.');
      return;
    }

    try {
      if (existing) {
        await apiClient.put(`/training/${existing.id}`, { condition_score: score, notes: existing.notes || '' });
        setExistingLogs((current) => current.map((log) => log.student_id === studentId ? { ...log, condition_score: score } : log));
        return;
      }

      const response = await apiClient.post('/training', {
        date: selectedDate,
        student_id: studentId,
        trainer_id: trainerId,
        plan_id: currentPlan?.id || null,
        condition_score: score,
        notes: '',
      });
      setExistingLogs((current) => [...current, { id: response.data.logId, student_id: studentId, condition_score: score, notes: '' }]);
    } catch {
      toast.error('학생 컨디션을 저장하지 못했습니다.');
    }
  };

  const saveNotes = async (studentId: number, notes: string) => {
    const existing = existingLogs.find((log) => log.student_id === studentId);
    if (!existing) return;

    try {
      await apiClient.put(`/training/${existing.id}`, { condition_score: existing.condition_score, notes });
      setExistingLogs((current) => current.map((log) => log.student_id === studentId ? { ...log, notes } : log));
    } catch {
      toast.error('학생 메모를 저장하지 못했습니다.');
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-emerald-700">TRAINING LOG</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-slate-950">수업 기록</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">{formatKoreanDate(selectedDate)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button type="button" onClick={fetchData} disabled={loading} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {loading && <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">불러오는 중입니다.</div>}
      {!loading && availableSlots.length === 0 && (
        <EmptyState message="해당 날짜에 배정된 학생이 없습니다." subMessage="반 배치에서 학생을 먼저 배정해주세요." />
      )}
      {!loading && availableSlots.length > 0 && (
        <>
          <SlotTabs
            activeSlot={selectedSlot}
            availableSlots={availableSlots}
            onSelect={(slot) => {
              setSelectedSlot(slot);
              if (isAdmin) setSelectedInstructorId(null);
            }}
          />

          {isAdmin && selectedSlot && currentInstructors.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <label className="block text-sm font-bold text-slate-700">
                강사 선택
                <select
                  value={selectedInstructorId || ''}
                  onChange={(event) => setSelectedInstructorId(event.target.value ? Number(event.target.value) : null)}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-slate-900"
                >
                  <option value="">전체 보기</option>
                  {currentInstructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {!isAdmin && !selectedInstructorId ? (
            <EmptyState message="해당 시간대에 배정된 반이 없습니다." subMessage="반 배치에서 담당 반을 확인해주세요." />
          ) : students.length === 0 ? (
            <EmptyState message="배정된 학생이 없습니다." subMessage="반 배치에서 학생을 먼저 배정해주세요." />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <ChecklistPanel
                currentPlan={currentPlan}
                exercises={exercises}
                humidity={humidity}
                newExerciseName={newExerciseName}
                newExerciseNote={newExerciseNote}
                onAddExtraExercise={addExtraExercise}
                onCloseAddExercise={closeAddExercise}
                onHumidityChange={setHumidity}
                onSaveConditions={() => saveConditions()}
                onShowAddExercise={() => setShowAddExercise(true)}
                onTemperatureChange={setTemperature}
                onToggleConditions={(checked) => saveConditions(checked)}
                onToggleExercise={toggleExercise}
                onToggleExtraExercise={toggleExtraExercise}
                setNewExerciseName={setNewExerciseName}
                setNewExerciseNote={setNewExerciseNote}
                showAddExercise={showAddExercise}
                temperature={temperature}
              />
              <StudentConditionPanel
                logs={existingLogs}
                onSaveCondition={saveCondition}
                onSaveNotes={saveNotes}
                students={students}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
