'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar,
  Sunrise,
  Sun,
  Moon,
  RefreshCw,
  Check,
  Thermometer,
  Droplets,
  ClipboardList,
  Users,
  MessageSquare
} from 'lucide-react';
import { authAPI } from '@/lib/api/auth';

interface Student {
  id: number;
  assignment_id: number;
  training_log_id?: number;
  name: string;
  gender: 'male' | 'female';
  condition_score?: number;
  notes?: string;
  is_trial?: boolean;
  trial_total?: number;
  trial_remaining?: number;
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
  students: Array<{
    id: number;
    student_id: number;
    student_name: string;
    gender: string;
    is_trial?: boolean;
    trial_total?: number;
    trial_remaining?: number;
  }>;
}

interface PlannedExercise {
  id: number;
  name: string;
  sets?: number;
  reps?: number;
  completed?: boolean;
  completed_at?: string;
}

interface DailyPlan {
  id: number;
  exercises: PlannedExercise[];
  completed_exercises: number[];
  exercise_times: Record<number, string>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/peak';

const timeSlotConfig = [
  { key: 'morning', label: '오전', icon: Sunrise },
  { key: 'afternoon', label: '오후', icon: Sun },
  { key: 'evening', label: '저녁', icon: Moon },
];

const conditionEmojis = [
  { score: 1, emoji: '😞', label: '나쁨' },
  { score: 2, emoji: '😐', label: '보통' },
  { score: 3, emoji: '🙂', label: '좋음' },
  { score: 4, emoji: '😃', label: '매우좋음' },
  { score: 5, emoji: '👍', label: '최상' },
];

export default function MobileTrainingPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('morning');
  const [activeTab, setActiveTab] = useState<'checklist' | 'condition'>('condition');
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // 환경 체크
  const [envCheck, setEnvCheck] = useState({ checked: false, temperature: '', humidity: '' });

  // 유저 정보
  const [user, setUser] = useState<{ id: number; name: string } | null>(null);

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

      // 반배치에서 학생 목록 로드
      const assignmentsRes = await fetch(
        `${API_BASE}/assignments?date=${selectedDate}`,
        { headers }
      );
      const assignmentsData = await assignmentsRes.json();

      // 기존 수업 기록 로드
      const trainingRes = await fetch(
        `${API_BASE}/training?date=${selectedDate}`,
        { headers }
      );
      const trainingData = await trainingRes.json();
      const existingLogs = trainingData.logs || [];

      // 시간대별 학생 필터링
      const slotsData = assignmentsData.slots || {};
      const slotInfo = slotsData[selectedTimeSlot] || {};

      // 현재 유저 정보
      const currentUser = authAPI.getCurrentUser();
      const userInstructorId = currentUser?.instructorId;
      const userNegativeId = currentUser?.role === 'owner' ? -(currentUser?.id || 0) : null;

      // 내 반의 학생들만 필터링
      const myStudents: Array<{ id: number; student_id: number; student_name: string; gender: string; is_trial?: boolean; trial_total?: number; trial_remaining?: number }> = [];

      (slotInfo.classes as ClassData[] || []).forEach((cls) => {
        const isMyClass = cls.instructors?.some((inst: ClassInstructor) =>
          inst.id === userInstructorId || inst.id === userNegativeId
        );

        if (isMyClass) {
          cls.students?.forEach(s => {
            myStudents.push(s);
          });
        }
      });

      const slotData = myStudents.map((s) => {
        const existingLog = existingLogs.find((l: { student_id: number }) => l.student_id === s.student_id);
        return {
          id: s.student_id,
          assignment_id: s.id,
          training_log_id: existingLog?.id,
          name: s.student_name,
          gender: (s.gender === 'M' || s.gender === 'male' ? 'male' : 'female') as 'male' | 'female',
          condition_score: existingLog?.condition_score,
          notes: existingLog?.notes,
          is_trial: s.is_trial,
          trial_total: s.trial_total,
          trial_remaining: s.trial_remaining,
        };
      });

      setStudents(slotData);

      // 수업 계획 로드 (내 계획만 필터링)
      const planRes = await fetch(
        `${API_BASE}/plans?date=${selectedDate}&time_slot=${selectedTimeSlot}`,
        { headers }
      );
      const planData = await planRes.json();

      const myInstructorId = userInstructorId || userNegativeId;
      const myPlans = (planData.plans || []).filter((p: { instructor_id: number }) =>
        p.instructor_id === myInstructorId
      );
      setPlans(myPlans);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTimeSlot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 컨디션 저장
  const saveCondition = async (trainingLogId: number, conditionScore: number) => {
    const key = `condition-${trainingLogId}`;
    setSaving(key);

    try {
      const token = authAPI.getToken();
      await fetch(`${API_BASE}/training/${trainingLogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ condition_score: conditionScore }),
      });

      setStudents(prev =>
        prev.map(s =>
          s.training_log_id === trainingLogId
            ? { ...s, condition_score: conditionScore }
            : s
        )
      );
    } catch (error) {
      console.error('Failed to save condition:', error);
    } finally {
      setTimeout(() => setSaving(null), 500);
    }
  };

  // 메모 저장
  const saveNotes = async (trainingLogId: number, notes: string) => {
    const key = `notes-${trainingLogId}`;
    setSaving(key);

    try {
      const token = authAPI.getToken();
      await fetch(`${API_BASE}/training/${trainingLogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes }),
      });

      setStudents(prev =>
        prev.map(s =>
          s.training_log_id === trainingLogId
            ? { ...s, notes }
            : s
        )
      );
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setTimeout(() => setSaving(null), 500);
    }
  };

  const koreanDate = format(new Date(selectedDate), 'M월 d일 (E)', { locale: ko });

  // 운동 완료 토글
  const toggleExercise = async (planId: number, exerciseId: number) => {
    try {
      const token = authAPI.getToken();
      const res = await fetch(`${API_BASE}/plans/${planId}/toggle-exercise`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exercise_id: exerciseId }),
      });
      const data = await res.json();

      setPlans(prev => prev.map(p =>
        p.id === planId
          ? { ...p, completed_exercises: data.completed_exercises || [], exercise_times: data.exercise_times || {} }
          : p
      ));
    } catch (error) {
      console.error('Failed to toggle exercise:', error);
    }
  };

  // 모든 계획의 운동 합치기
  const allExercises = plans.flatMap(p =>
    (p.exercises || []).map(ex => ({
      ...ex,
      planId: p.id,
      completed: (p.completed_exercises || []).includes(ex.id),
      completed_at: p.exercise_times?.[ex.id],
    }))
  );

  return (
    <div className="space-y-3">
      {/* 날짜 선택 */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-500 dark:text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-medium text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{koreanDate}</span>
          <button
            onClick={loadData}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-orange-500' : 'text-slate-500 dark:text-slate-400'} />
          </button>
        </div>
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
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 내부 탭 */}
      <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('condition')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'condition'
              ? 'bg-neutral-900 dark:bg-neutral-700 text-white'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <Users size={16} />
          <span>학생 컨디션</span>
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'checklist'
              ? 'bg-neutral-900 dark:bg-neutral-700 text-white'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <ClipboardList size={16} />
          <span>체크리스트</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-orange-500" />
        </div>
      ) : activeTab === 'condition' ? (
        /* 학생 컨디션 탭 */
        <div className="space-y-2">
          {students.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center shadow-sm border border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400 text-sm">내 반에 배치된 학생이 없습니다</p>
            </div>
          ) : (
            students.map((student) => {
              const isSavingCondition = saving === `condition-${student.training_log_id}`;
              const isSavingNotes = saving === `notes-${student.training_log_id}`;

              return (
                <div key={student.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                  {/* 학생 이름 */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      student.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{student.name}</p>
                    {!!student.is_trial && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {(student.trial_total || 0) - (student.trial_remaining || 0)}/{student.trial_total || 0}
                      </span>
                    )}
                    {isSavingCondition && (
                      <Check size={16} className="text-green-500 ml-auto" />
                    )}
                  </div>

                  {/* 컨디션 버튼 */}
                  <div className="flex gap-2 mb-3">
                    {conditionEmojis.map(({ score, emoji, label }) => (
                      <button
                        key={score}
                        onClick={() => {
                          if (student.training_log_id) {
                            saveCondition(student.training_log_id, score);
                          }
                        }}
                        className={`flex-1 flex flex-col items-center py-2 rounded-xl transition ${
                          student.condition_score === score
                            ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500'
                            : 'bg-slate-50 dark:bg-slate-700 border-2 border-transparent'
                        }`}
                      >
                        <span className="text-xl">{emoji}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 메모 */}
                  <div className="relative">
                    <div className="absolute left-3 top-3">
                      <MessageSquare size={16} className="text-slate-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="메모..."
                      defaultValue={student.notes || ''}
                      onBlur={(e) => {
                        if (student.training_log_id) {
                          saveNotes(student.training_log_id, e.target.value);
                        }
                      }}
                      className="w-full h-10 pl-10 pr-8 text-sm bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                    {isSavingNotes && (
                      <Check size={14} className="absolute right-3 top-3 text-green-500" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* 체크리스트 탭 */
        <div className="space-y-3">
          {/* 환경 체크 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEnvCheck(prev => ({ ...prev, checked: !prev.checked }))}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                  envCheck.checked
                    ? 'bg-green-500 border-green-500'
                    : 'border-slate-300 dark:border-slate-500'
                }`}
              >
                {envCheck.checked && <Check size={12} className="text-white" />}
              </button>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-shrink-0">환경</span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Thermometer size={14} className="text-red-500 flex-shrink-0" />
                <input
                  type="number"
                  placeholder="25"
                  value={envCheck.temperature}
                  onChange={(e) => setEnvCheck(prev => ({ ...prev, temperature: e.target.value }))}
                  className="w-10 bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5 text-sm text-center outline-none text-slate-800 dark:text-slate-100"
                />
                <span className="text-xs text-slate-400">°C</span>
              </div>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Droplets size={14} className="text-blue-500 flex-shrink-0" />
                <input
                  type="number"
                  placeholder="50"
                  value={envCheck.humidity}
                  onChange={(e) => setEnvCheck(prev => ({ ...prev, humidity: e.target.value }))}
                  className="w-10 bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5 text-sm text-center outline-none text-slate-800 dark:text-slate-100"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* 계획된 운동 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700">
            <div className="px-4 py-3">
              <h3 className="font-medium text-slate-800 dark:text-slate-100">계획된 운동</h3>
            </div>
            {allExercises.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                계획된 운동이 없습니다
              </div>
            ) : (
              allExercises.map((ex, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => toggleExercise(ex.planId, ex.id)}
                    className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition ${
                      ex.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-slate-300 dark:border-slate-500'
                    }`}
                  >
                    {ex.completed && <Check size={12} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-100 truncate">
                      {ex.name}
                      {(ex.sets || ex.reps) && (
                        <span className="text-slate-400 ml-1">
                          {ex.sets && `${ex.sets}세트`}{ex.sets && ex.reps && '/'}{ex.reps && `${ex.reps}회`}
                        </span>
                      )}
                    </p>
                  </div>
                  {ex.completed_at && (
                    <span className="text-xs text-green-600 flex-shrink-0">
                      {format(new Date(ex.completed_at), 'HH:mm')}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
