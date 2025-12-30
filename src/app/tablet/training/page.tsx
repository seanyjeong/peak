'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, RefreshCw, Check, User, Smile, Meh, Frown, AlertCircle, ThumbsUp, Thermometer, Droplets, Plus, ClipboardList, X, Calendar, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI, User as AuthUser } from '@/lib/api/auth';
import { useOrientation } from '../layout';

interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F' | string;
  status: string;
}

interface ClassInstructor {
  id: number;
  name: string;
  isOwner?: boolean;
  isMain?: boolean;
}

interface ClassData {
  class_num: number;
  instructors: ClassInstructor[];
  students: Student[];
}

interface SlotData {
  waitingStudents: Student[];
  waitingInstructors: ClassInstructor[];
  classes: ClassData[];
}

interface Exercise {
  id: number;
  name: string;
  tags: string[];
}

interface PlanExercise {
  exercise_id: number;
  note?: string;
}

interface ExtraExercise {
  exercise_id?: number;
  name: string;
  note?: string;
  completed: boolean;
}

interface Plan {
  id: number;
  date: string;
  time_slot: string;
  instructor_id: number;
  instructor_name: string;
  exercises: PlanExercise[];
  completed_exercises: number[];
  extra_exercises: ExtraExercise[];
  exercise_times: Record<string, string>;
  conditions_checked: boolean | number;
  conditions_checked_at: string | null;
  temperature: number | null;
  humidity: number | null;
}

interface ExistingLog {
  id: number;
  student_id: number;
  condition_score: number | null;
  notes: string;
}

const CONDITION_OPTIONS = [
  { score: 1, icon: Frown, label: '매우 나쁨', color: 'text-red-500 bg-red-50 border-red-200' },
  { score: 2, icon: Frown, label: '나쁨', color: 'text-orange-500 bg-orange-50 border-orange-200' },
  { score: 3, icon: Meh, label: '보통', color: 'text-yellow-500 bg-yellow-50 border-yellow-200' },
  { score: 4, icon: Smile, label: '좋음', color: 'text-green-500 bg-green-50 border-green-200' },
  { score: 5, icon: ThumbsUp, label: '최상', color: 'text-blue-500 bg-blue-50 border-blue-200' },
];

const SLOT_LABELS: Record<string, string> = {
  morning: '오전반',
  afternoon: '오후반',
  evening: '저녁반'
};

export default function TabletTrainingPage() {
  const orientation = useOrientation();
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [existingLogs, setExistingLogs] = useState<ExistingLog[]>([]);

  // 날짜 선택
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // 온습도
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');

  // 추가 운동 모달
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseNote, setNewExerciseNote] = useState('');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const formatDateKorean = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateStr = selectedDate;
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);

      const [assignmentsRes, trainingRes, plansRes, exercisesRes] = await Promise.all([
        apiClient.get(`/assignments?date=${dateStr}`),
        apiClient.get(`/training?date=${dateStr}`),
        apiClient.get(`/plans?date=${dateStr}`),
        apiClient.get('/exercises')
      ]);

      const slotsData = assignmentsRes.data.slots || {};
      setSlots(slotsData);
      setExistingLogs(trainingRes.data.logs || []);
      setPlans(plansRes.data.plans || []);
      setExercises(exercisesRes.data.exercises || []);

      // 자동 시간대 선택 (v2.0.0 classes 구조)
      const myInstructorId = user?.instructorId;
      // 원장의 경우 음수 ID 사용
      const myNegativeId = user?.role === 'owner' ? -(user?.id || 0) : null;
      const availableSlots: string[] = [];
      let mySlot: string | null = null;
      let myTrainerId: number | null = null;

      ['morning', 'afternoon', 'evening'].forEach(slot => {
        const slotData = slotsData[slot] as SlotData;
        if (!slotData) return;

        // classes에 학생이 있는지 확인
        const hasData = slotData.classes?.some(cls => cls.students?.length > 0);
        if (hasData) {
          availableSlots.push(slot);

          // 내가 배치된 반 찾기
          const myClass = slotData.classes?.find(cls =>
            cls.instructors?.some(inst =>
              inst.id === myInstructorId || inst.id === myNegativeId
            )
          );
          if (myClass) {
            mySlot = slot;
            // 첫 번째 강사 ID를 trainer로 사용
            const myInst = myClass.instructors?.find(inst =>
              inst.id === myInstructorId || inst.id === myNegativeId
            );
            if (myInst) myTrainerId = myInst.id;
          }
        }
      });

      if (mySlot) {
        setSelectedSlot(mySlot);
        setSelectedTrainerId(myTrainerId);
      } else if (availableSlots.length > 0) {
        setSelectedSlot(availableSlots[0]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  // 현재 시간대/강사의 플랜 찾기
  const currentPlan = plans.find(p =>
    p.time_slot === selectedSlot &&
    (selectedTrainerId ? p.instructor_id === selectedTrainerId : true)
  );

  // 온습도 로드
  useEffect(() => {
    if (currentPlan) {
      setTemperature(currentPlan.temperature?.toString() || '');
      setHumidity(currentPlan.humidity?.toString() || '');
    }
  }, [currentPlan?.id]);

  const availableSlots = ['morning', 'afternoon', 'evening'].filter(slot => {
    const slotData = slots[slot] as SlotData;
    if (!slotData) return false;
    return slotData.classes?.some(cls => cls.students?.length > 0);
  });

  const currentSlotData = slots[selectedSlot] as SlotData | undefined;

  // 현재 시간대의 강사 목록 (반별로)
  const currentTrainers = (() => {
    if (!currentSlotData) return [];
    const trainers: { trainer_id: number; trainer_name: string; students: Student[] }[] = [];
    currentSlotData.classes?.forEach(cls => {
      cls.instructors?.forEach(inst => {
        trainers.push({
          trainer_id: inst.id,
          trainer_name: inst.name,
          students: cls.students || []
        });
      });
    });
    return trainers;
  })();

  // 내 반의 학생들 가져오기
  const myStudents = (() => {
    if (!currentSlotData || !selectedTrainerId) return [];
    const myClass = currentSlotData.classes?.find(cls =>
      cls.instructors?.some(inst => inst.id === selectedTrainerId)
    );
    return myClass?.students || [];
  })();

  // 운동 이름 조회 (exercise_id 또는 id 둘 다 지원)
  const getExerciseName = (exercise: PlanExercise | { id?: number; name?: string; exercise_id?: number }): string => {
    // 모바일에서 저장된 형식 (id, name) 또는 PC에서 저장된 형식 (exercise_id)
    if ('name' in exercise && exercise.name) {
      return exercise.name;
    }
    const exerciseId = exercise.exercise_id || ('id' in exercise ? exercise.id : undefined);
    if (!exerciseId) return '알 수 없음';
    return exercises.find(e => e.id === exerciseId)?.name || `운동 #${exerciseId}`;
  };

  // === 즉시 저장 함수들 ===

  const toggleConditions = async (checked: boolean) => {
    if (!currentPlan) return;
    try {
      const res = await apiClient.put(`/plans/${currentPlan.id}/conditions`, {
        temperature: temperature ? parseFloat(temperature) : null,
        humidity: humidity ? parseInt(humidity) : null,
        checked
      });
      setPlans(prev => prev.map(p =>
        p.id === currentPlan.id
          ? { ...p, conditions_checked: checked ? 1 : 0, conditions_checked_at: res.data.checked_at }
          : p
      ));
    } catch (error) {
      console.error('Failed to save conditions:', error);
    }
  };

  const saveConditions = async () => {
    if (!currentPlan) return;
    const hasValues = temperature || humidity;
    const shouldCheck = hasValues ? true : currentPlan.conditions_checked ? true : false;

    try {
      const res = await apiClient.put(`/plans/${currentPlan.id}/conditions`, {
        temperature: temperature ? parseFloat(temperature) : null,
        humidity: humidity ? parseInt(humidity) : null,
        checked: shouldCheck
      });
      if (hasValues && !currentPlan.conditions_checked) {
        setPlans(prev => prev.map(p =>
          p.id === currentPlan.id
            ? { ...p, conditions_checked: 1, conditions_checked_at: res.data.checked_at }
            : p
        ));
      }
    } catch (error) {
      console.error('Failed to save conditions:', error);
    }
  };

  const toggleExercise = async (exerciseId: number) => {
    if (!currentPlan) return;
    try {
      const res = await apiClient.put(`/plans/${currentPlan.id}/toggle-exercise`, { exercise_id: exerciseId });
      setPlans(prev => prev.map(p =>
        p.id === currentPlan.id
          ? { ...p, completed_exercises: res.data.completed_exercises, exercise_times: res.data.exercise_times || {} }
          : p
      ));
    } catch (error) {
      console.error('Failed to toggle exercise:', error);
    }
  };

  const toggleExtraExercise = async (index: number) => {
    if (!currentPlan) return;
    try {
      const res = await apiClient.put(`/plans/${currentPlan.id}/toggle-extra`, { index });
      setPlans(prev => prev.map(p =>
        p.id === currentPlan.id
          ? { ...p, extra_exercises: res.data.extra_exercises }
          : p
      ));
    } catch (error) {
      console.error('Failed to toggle extra exercise:', error);
    }
  };

  const addExtraExercise = async () => {
    if (!currentPlan || !newExerciseName.trim()) return;
    try {
      const res = await apiClient.post(`/plans/${currentPlan.id}/extra-exercise`, {
        name: newExerciseName.trim(),
        note: newExerciseNote.trim() || undefined
      });
      setPlans(prev => prev.map(p =>
        p.id === currentPlan.id
          ? { ...p, extra_exercises: res.data.extra_exercises }
          : p
      ));
      setNewExerciseName('');
      setNewExerciseNote('');
      setShowAddExercise(false);
    } catch (error) {
      console.error('Failed to add exercise:', error);
    }
  };

  const saveCondition = async (studentId: number, score: number | null) => {
    const existing = existingLogs.find(l => l.student_id === studentId);
    const dateStr = selectedDate;

    try {
      if (existing) {
        await apiClient.put(`/training/${existing.id}`, {
          condition_score: score,
          notes: existing.notes || ''
        });
        setExistingLogs(prev => prev.map(l =>
          l.student_id === studentId ? { ...l, condition_score: score } : l
        ));
      } else {
        const res = await apiClient.post('/training', {
          date: dateStr,
          student_id: studentId,
          trainer_id: selectedTrainerId,
          plan_id: currentPlan?.id || null,
          condition_score: score,
          notes: ''
        });
        if (res.data.logId) {
          setExistingLogs(prev => [...prev, {
            id: res.data.logId,
            student_id: studentId,
            condition_score: score,
            notes: ''
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to save condition:', error);
    }
  };

  const saveNotes = async (studentId: number, notes: string) => {
    const existing = existingLogs.find(l => l.student_id === studentId);
    if (!existing) return;

    try {
      await apiClient.put(`/training/${existing.id}`, {
        condition_score: existing.condition_score,
        notes
      });
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  const getStudentLog = (studentId: number) => existingLogs.find(l => l.student_id === studentId);

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">수업 기록</h1>
          <p className="text-slate-500 text-sm mt-1">{formatDateKorean(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border-none focus:ring-0 text-slate-700 text-sm bg-transparent"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={40} className="animate-spin text-slate-400" />
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg">오늘 수업 스케줄이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 시간대 탭 */}
          <div className="flex gap-2 mb-4">
            {availableSlots.map(slot => (
              <button
                key={slot}
                onClick={() => { setSelectedSlot(slot); if (isAdmin) setSelectedTrainerId(null); }}
                className={`px-5 py-3 rounded-xl font-medium transition text-base ${
                  selectedSlot === slot ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>

          {/* 강사 선택 (관리자) */}
          {isAdmin && selectedSlot && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <select
                value={selectedTrainerId || ''}
                onChange={e => setSelectedTrainerId(Number(e.target.value) || null)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base"
              >
                <option value="">강사 선택</option>
                {currentTrainers.map(t => (
                  <option key={t.trainer_id} value={t.trainer_id!}>{t.trainer_name} ({t.students.length}명)</option>
                ))}
              </select>
            </div>
          )}

          {!selectedTrainerId ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-lg">강사를 선택하세요.</p>
            </div>
          ) : (
            <div className={`${orientation === 'landscape' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}`}>
              {/* 체크리스트 - 수업 계획이 있을 때만 표시 */}
              {currentPlan ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4">
                  <h2 className="text-white font-bold flex items-center gap-2 text-lg">
                    <ClipboardList size={22} />
                    오늘의 수업 체크리스트
                  </h2>
                </div>

                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                  {/* 온습도 체크 */}
                  <div
                    className={`p-4 cursor-pointer transition ${currentPlan.conditions_checked ? 'bg-green-50' : 'active:bg-slate-50'}`}
                    onClick={() => toggleConditions(!currentPlan.conditions_checked)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                        currentPlan.conditions_checked ? 'bg-green-500 border-green-500' : 'border-slate-300'
                      }`}>
                        {currentPlan.conditions_checked && <Check size={18} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <span className={`font-medium text-base ${currentPlan.conditions_checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          체육관 환경 체크
                        </span>
                        {currentPlan.conditions_checked && currentPlan.conditions_checked_at && (
                          <span className="ml-2 text-xs text-green-600">
                            ✓ {new Date(currentPlan.conditions_checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 온습도 입력 */}
                    <div className="mt-3 ml-11 flex items-center gap-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Thermometer size={18} className="text-orange-500" />
                        <input
                          type="number"
                          step="0.1"
                          value={temperature}
                          onChange={e => setTemperature(e.target.value)}
                          onBlur={saveConditions}
                          placeholder="온도"
                          className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-base"
                        />
                        <span className="text-slate-500">°C</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets size={18} className="text-blue-500" />
                        <input
                          type="number"
                          value={humidity}
                          onChange={e => setHumidity(e.target.value)}
                          onBlur={saveConditions}
                          placeholder="습도"
                          className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-base"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </div>
                  </div>

                  {/* 계획된 운동들 */}
                  {currentPlan.exercises.map((ex: PlanExercise & { id?: number }) => {
                    const exId = ex.exercise_id || ex.id;
                    const isCompleted = exId ? currentPlan.completed_exercises.includes(exId) : false;
                    const completedTime = exId ? currentPlan.exercise_times?.[exId] : undefined;
                    return (
                      <div
                        key={exId || Math.random()}
                        className={`p-4 cursor-pointer transition ${isCompleted ? 'bg-green-50' : 'active:bg-slate-50'}`}
                        onClick={() => exId && toggleExercise(exId)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                            isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-300'
                          }`}>
                            {isCompleted && <Check size={18} className="text-white" />}
                          </div>
                          <div className="flex-1">
                            <span className={`font-medium text-base ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {getExerciseName(ex)}
                            </span>
                            {ex.note && (
                              <span className={`ml-2 text-sm ${isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                                ({ex.note})
                              </span>
                            )}
                            {isCompleted && completedTime && (
                              <span className="ml-2 text-xs text-green-600">
                                ✓ {new Date(completedTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* 추가된 운동들 */}
                  {currentPlan.extra_exercises.map((ex, idx) => (
                    <div
                      key={`extra-${idx}`}
                      className={`p-4 cursor-pointer transition ${ex.completed ? 'bg-blue-50' : 'active:bg-slate-50'}`}
                      onClick={() => toggleExtraExercise(idx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                          ex.completed ? 'bg-blue-500 border-blue-500' : 'border-blue-300'
                        }`}>
                          {ex.completed && <Check size={18} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <span className={`font-medium text-base ${ex.completed ? 'line-through text-slate-400' : 'text-blue-700'}`}>
                            {ex.name}
                          </span>
                          {ex.note && (
                            <span className={`ml-2 text-sm ${ex.completed ? 'text-slate-300' : 'text-slate-500'}`}>
                              ({ex.note})
                            </span>
                          )}
                          <span className="ml-2 text-xs text-blue-400">(추가)</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 운동 추가 버튼 */}
                  <div className="p-4">
                    {showAddExercise ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newExerciseName}
                            onChange={e => setNewExerciseName(e.target.value)}
                            placeholder="운동 이름"
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-base"
                            autoFocus
                          />
                          <button
                            onClick={() => { setShowAddExercise(false); setNewExerciseName(''); setNewExerciseNote(''); }}
                            className="p-3 text-slate-400 hover:text-slate-600"
                          >
                            <X size={22} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newExerciseNote}
                            onChange={e => setNewExerciseNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addExtraExercise()}
                            placeholder="메모 (선택)"
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-base"
                          />
                          <button
                            onClick={addExtraExercise}
                            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600"
                          >
                            추가
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddExercise(true)}
                        className="flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium py-2"
                      >
                        <Plus size={22} />
                        운동 추가
                      </button>
                    )}
                  </div>
                </div>
              </div>
              ) : (
                /* 수업 계획 없을 때 안내 */
                <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                  <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">수업 계획이 없습니다.</p>
                  <p className="text-slate-400 text-sm mt-1">수업 계획 페이지에서 계획을 작성하면 체크리스트가 표시됩니다.</p>
                </div>
              )}

              {/* 학생 컨디션 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                    <User size={22} />
                    학생 컨디션 ({myStudents.length}명)
                  </h2>
                </div>

                {myStudents.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-lg">배정된 학생이 없습니다.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {myStudents.map(student => {
                      const log = getStudentLog(student.student_id);
                      return (
                        <div key={student.id} className="p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                            }`}>
                              <User size={20} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800 text-lg">{student.student_name}</span>
                              <Link
                                href={`/tablet/students/${student.student_id}`}
                                className="p-2 hover:bg-orange-100 rounded-lg transition"
                                title="프로필 보기"
                              >
                                <ExternalLink size={16} className="text-orange-500" />
                              </Link>
                            </div>
                            {log?.condition_score && (
                              <span className="ml-auto flex items-center gap-1 text-green-600 text-sm">
                                <Check size={16} /> 저장됨
                              </span>
                            )}
                          </div>

                          {/* 컨디션 버튼 (터치 최적화) */}
                          <div className="flex gap-2 mb-4">
                            {CONDITION_OPTIONS.map(option => {
                              const Icon = option.icon;
                              const isSelected = log?.condition_score === option.score;
                              return (
                                <button
                                  key={option.score}
                                  onClick={() => saveCondition(student.student_id, isSelected ? null : option.score)}
                                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition ${
                                    isSelected ? option.color : 'border-slate-200 text-slate-400 active:border-slate-300'
                                  }`}
                                >
                                  <Icon size={24} />
                                  <span className="text-xs">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* 메모 */}
                          <input
                            type="text"
                            defaultValue={log?.notes || ''}
                            onBlur={e => saveNotes(student.student_id, e.target.value)}
                            placeholder="메모..."
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
