'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, RefreshCw, Check, User, Smile, Meh, Frown, AlertCircle, ThumbsUp, Thermometer, Droplets, Plus, ClipboardList, X, Calendar, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI, User as AuthUser } from '@/lib/api/auth';

interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
  status: string;
}

interface ClassInstructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain: boolean;
}

interface ClassData {
  class_num: number;
  instructors: ClassInstructor[];
  students: Student[];
}

interface SlotData {
  waitingStudents: Student[];
  waitingInstructors: { id: number; name: string; isOwner: boolean }[];
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

// plans API에서 받은 강사 목록 타입
interface ScheduledInstructor {
  id: number;
  name: string;
  user_id: number;
  time_slot: string;
  isOwner?: boolean;
}

export default function TrainingPage() {
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [planSlots, setPlanSlots] = useState<Record<string, ScheduledInstructor[]>>({});  // plans API의 강사 목록
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);  // instructor_id로 변경
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

  // 선택된 날짜를 한글로 표시
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
      const planSlotsData = plansRes.data.slots || {};  // plans API의 강사 목록
      setSlots(slotsData);
      setPlanSlots(planSlotsData);
      setExistingLogs(trainingRes.data.logs || []);
      setPlans(plansRes.data.plans || []);
      setExercises(exercisesRes.data.exercises || []);

      // 자동 시간대 선택 (학생이 있는 시간대)
      const myInstructorId = user?.instructorId;
      const availableSlots: string[] = [];
      let mySlot: string | null = null;
      let myInstructorIdInSlot: number | null = null;

      ['morning', 'afternoon', 'evening'].forEach(slot => {
        const slotData = slotsData[slot] as SlotData;
        if (!slotData) return;

        // 학생이 있는지 확인 (반에 배치된 학생 + 대기 학생)
        const hasStudentsInClasses = slotData.classes?.some(c => c.students && c.students.length > 0);
        const hasWaitingStudents = slotData.waitingStudents && slotData.waitingStudents.length > 0;

        if (hasStudentsInClasses || hasWaitingStudents) {
          availableSlots.push(slot);

          // 내가 해당 시간대에 스케줄되어 있는지 확인 (plans slots 기준)
          const planInstructors = planSlotsData[slot] || [];
          const mySchedule = planInstructors.find((i: ScheduledInstructor) => i.id === myInstructorId);
          if (mySchedule) {
            mySlot = slot;
            myInstructorIdInSlot = mySchedule.id;
          }
        }
      });

      const admin = user?.role === 'admin' || user?.role === 'owner';
      if (!admin && mySlot) {
        setSelectedSlot(mySlot);
        setSelectedInstructorId(myInstructorIdInSlot);  // 내 instructor_id
      } else if (availableSlots.length > 0) {
        setSelectedSlot(availableSlots[0]);
        setSelectedInstructorId(null);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  // 학생이 배치된 시간대 목록 (반배치 기준)
  const availableSlots = ['morning', 'afternoon', 'evening'].filter(slot => {
    const slotData = slots[slot] as SlotData;
    if (!slotData) return false;
    const hasStudentsInClasses = slotData.classes?.some(c => c.students && c.students.length > 0);
    const hasWaitingStudents = slotData.waitingStudents && slotData.waitingStudents.length > 0;
    return hasStudentsInClasses || hasWaitingStudents;
  });

  const currentSlotData = slots[selectedSlot] as SlotData | undefined;
  const currentClasses = currentSlotData?.classes || [];

  // 현재 시간대/강사의 플랜 찾기 (직접 instructor_id 사용)
  const currentPlan = plans.find(p =>
    p.time_slot === selectedSlot &&
    (selectedInstructorId ? p.instructor_id === selectedInstructorId : true)
  );

  // 현재 시간대의 강사 목록 (plans API 기준)
  const currentInstructors = planSlots[selectedSlot] || [];

  // 온습도 로드
  useEffect(() => {
    if (currentPlan) {
      setTemperature(currentPlan.temperature?.toString() || '');
      setHumidity(currentPlan.humidity?.toString() || '');
    }
  }, [currentPlan?.id]);

  // 학생 목록 가져오기 (원장은 전체, 강사는 자기 반)
  const getMyStudents = (): Student[] => {
    if (!currentSlotData) return [];

    if (isAdmin) {
      // 원장/admin: 해당 시간대 전체 학생 (반 배치 + 대기)
      const allStudents: Student[] = [];
      currentSlotData.classes?.forEach(c => {
        if (c.students) {
          allStudents.push(...c.students);
        }
      });
      if (currentSlotData.waitingStudents) {
        allStudents.push(...currentSlotData.waitingStudents);
      }
      return allStudents;
    } else {
      // 일반 강사: 자기 반 학생만 (instructor_id로 찾기)
      if (!selectedInstructorId) return [];
      const myClass = currentClasses.find(c =>
        c.instructors?.some(i => i.id === selectedInstructorId)
      );
      return myClass?.students || [];
    }
  };

  const myStudents = getMyStudents();

  // 운동 이름 조회
  const getExerciseName = (exerciseId: number): string => {
    return exercises.find(e => e.id === exerciseId)?.name || `운동 #${exerciseId}`;
  };

  // === 즉시 저장 함수들 ===

  // 온습도 체크 토글
  const toggleConditions = async (checked: boolean) => {
    if (!currentPlan) return;
    try {
      const res = await apiClient.put(`/plans/${currentPlan.id}/conditions`, {
        temperature: temperature ? parseFloat(temperature) : null,
        humidity: humidity ? parseInt(humidity) : null,
        checked
      });
      // 로컬 상태 업데이트 (스크롤 유지)
      setPlans(prev => prev.map(p =>
        p.id === currentPlan.id
          ? { ...p, conditions_checked: checked ? 1 : 0, conditions_checked_at: res.data.checked_at }
          : p
      ));
    } catch (error) {
      console.error('Failed to save conditions:', error);
    }
  };

  // 온습도 값 저장 (blur시) - 값 있으면 자동 체크
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
      // 로컬 상태 업데이트 (자동 체크 반영)
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

  // 계획 운동 토글
  const toggleExercise = async (exerciseId: number) => {
    if (!currentPlan) return;
    try {
      const res = await apiClient.put(`/plans/${currentPlan.id}/toggle-exercise`, { exercise_id: exerciseId });
      // 로컬 상태 업데이트 (스크롤 유지)
      setPlans(prev => prev.map(p =>
        p.id === currentPlan.id
          ? { ...p, completed_exercises: res.data.completed_exercises, exercise_times: res.data.exercise_times || {} }
          : p
      ));
    } catch (error) {
      console.error('Failed to toggle exercise:', error);
    }
  };

  // 추가 운동 토글
  const toggleExtraExercise = async (index: number) => {
    if (!currentPlan) return;
    try {
      const res = await apiClient.put(`/plans/${currentPlan.id}/toggle-extra`, { index });
      // 로컬 상태 업데이트 (스크롤 유지)
      setPlans(prev => prev.map(p =>
        p.id === currentPlan.id
          ? { ...p, extra_exercises: res.data.extra_exercises }
          : p
      ));
    } catch (error) {
      console.error('Failed to toggle extra exercise:', error);
    }
  };

  // 추가 운동 등록
  const addExtraExercise = async () => {
    if (!currentPlan || !newExerciseName.trim()) return;
    try {
      const res = await apiClient.post(`/plans/${currentPlan.id}/extra-exercise`, {
        name: newExerciseName.trim(),
        note: newExerciseNote.trim() || undefined
      });
      // 로컬 상태 업데이트 (스크롤 유지)
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

  // 컨디션 즉시 저장 (스크롤 유지를 위해 로컬 state 업데이트)
  const saveCondition = async (studentId: number, score: number | null) => {
    const existing = existingLogs.find(l => l.student_id === studentId);
    const dateStr = selectedDate;

    try {
      if (existing) {
        await apiClient.put(`/training/${existing.id}`, {
          condition_score: score,
          notes: existing.notes || ''
        });
        // 로컬 state 업데이트 (스크롤 유지)
        setExistingLogs(prev => prev.map(l =>
          l.student_id === studentId ? { ...l, condition_score: score } : l
        ));
      } else {
        const res = await apiClient.post('/training', {
          date: dateStr,
          student_id: studentId,
          trainer_id: selectedInstructorId,
          plan_id: currentPlan?.id || null,
          condition_score: score,
          notes: ''
        });
        // 새 로그 추가 (스크롤 유지) - API는 logId 반환
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

  // 메모 저장 (blur시)
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">수업 기록</h1>
          <p className="text-slate-500 mt-1">{formatDateKorean(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 날짜 선택 */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border-none focus:ring-0 text-slate-700"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">해당 날짜에 배정된 학생이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 학생을 배치해주세요.</p>
        </div>
      ) : (
        <>
          {/* 시간대 탭 */}
          <div className="flex gap-2 mb-4">
            {availableSlots.map(slot => (
              <button
                key={slot}
                onClick={() => { setSelectedSlot(slot); if (isAdmin) setSelectedInstructorId(null); }}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedSlot === slot ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>

          {/* 강사 선택 (관리자용) */}
          {isAdmin && selectedSlot && currentInstructors.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <select
                value={selectedInstructorId || ''}
                onChange={e => setSelectedInstructorId(Number(e.target.value) || null)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">전체 보기</option>
                {currentInstructors.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}{inst.isOwner ? '' : 'T'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 강사가 스케줄되지 않은 경우 (일반 강사만) */}
          {!isAdmin && !selectedInstructorId ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">해당 시간대에 배정된 반이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 반에 배정되어야 합니다.</p>
            </div>
          ) : myStudents.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
              <p className="text-slate-600 font-medium">배정된 학생이 없습니다</p>
              <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 학생을 배치해주세요</p>
            </div>
          ) : !currentPlan ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">수업 계획이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">수업 계획 페이지에서 먼저 계획을 작성하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 체크리스트 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <ClipboardList size={20} />
                    오늘의 수업 체크리스트
                  </h2>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* 온습도 체크 (첫 번째 항목) */}
                  <div
                    className={`p-4 cursor-pointer transition ${currentPlan.conditions_checked ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                    onClick={() => toggleConditions(!currentPlan.conditions_checked)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                        currentPlan.conditions_checked ? 'bg-green-500 border-green-500' : 'border-slate-300'
                      }`}>
                        {currentPlan.conditions_checked && <Check size={14} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <span className={`font-medium ${currentPlan.conditions_checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
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
                    <div className="mt-3 ml-9 flex items-center gap-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Thermometer size={16} className="text-orange-500" />
                        <input
                          type="number"
                          step="0.1"
                          value={temperature}
                          onChange={e => setTemperature(e.target.value)}
                          onBlur={saveConditions}
                          placeholder="온도"
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                        <span className="text-slate-500 text-sm">°C</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets size={16} className="text-blue-500" />
                        <input
                          type="number"
                          value={humidity}
                          onChange={e => setHumidity(e.target.value)}
                          onBlur={saveConditions}
                          placeholder="습도"
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                        />
                        <span className="text-slate-500 text-sm">%</span>
                      </div>
                    </div>
                  </div>

                  {/* 계획된 운동들 */}
                  {currentPlan.exercises.map((ex) => {
                    const isCompleted = currentPlan.completed_exercises.includes(ex.exercise_id);
                    const completedTime = currentPlan.exercise_times?.[ex.exercise_id];
                    return (
                      <div
                        key={ex.exercise_id}
                        className={`p-4 cursor-pointer transition ${isCompleted ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                        onClick={() => toggleExercise(ex.exercise_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                            isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-300'
                          }`}>
                            {isCompleted && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1">
                            <span className={`font-medium ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {getExerciseName(ex.exercise_id)}
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
                      className={`p-4 cursor-pointer transition ${ex.completed ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                      onClick={() => toggleExtraExercise(idx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                          ex.completed ? 'bg-blue-500 border-blue-500' : 'border-blue-300'
                        }`}>
                          {ex.completed && <Check size={14} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <span className={`font-medium ${ex.completed ? 'line-through text-slate-400' : 'text-blue-700'}`}>
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newExerciseName}
                            onChange={e => setNewExerciseName(e.target.value)}
                            placeholder="운동 이름"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => { setShowAddExercise(false); setNewExerciseName(''); setNewExerciseNote(''); }}
                            className="p-2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newExerciseNote}
                            onChange={e => setNewExerciseNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addExtraExercise()}
                            placeholder="메모 (선택)"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                          <button
                            onClick={addExtraExercise}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                          >
                            추가
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddExercise(true)}
                        className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium"
                      >
                        <Plus size={18} />
                        운동 추가
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 학생 컨디션 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-slate-100 px-6 py-4">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <User size={20} />
                    학생 컨디션 ({myStudents.length}명)
                  </h2>
                </div>

                {myStudents.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p>배정된 학생이 없습니다.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myStudents.map(student => {
                      const log = getStudentLog(student.student_id);
                      return (
                        <div key={student.id} className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                            }`}>
                              <User size={16} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{student.student_name}</span>
                              <Link
                                href={`/students/${student.student_id}`}
                                className="p-1 hover:bg-orange-100 rounded transition"
                                title="프로필 보기"
                              >
                                <ExternalLink size={12} className="text-orange-500" />
                              </Link>
                            </div>
                            {log?.condition_score && (
                              <span className="ml-auto flex items-center gap-1 text-green-600 text-sm">
                                <Check size={14} /> 저장됨
                              </span>
                            )}
                          </div>

                          {/* 컨디션 버튼 */}
                          <div className="flex gap-2 mb-3">
                            {CONDITION_OPTIONS.map(option => {
                              const Icon = option.icon;
                              const isSelected = log?.condition_score === option.score;
                              return (
                                <button
                                  key={option.score}
                                  onClick={() => saveCondition(student.student_id, isSelected ? null : option.score)}
                                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition ${
                                    isSelected ? option.color : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                  }`}
                                >
                                  <Icon size={18} />
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
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
