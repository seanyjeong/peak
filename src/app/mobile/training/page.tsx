'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar,
  RefreshCw,
  Check,
  Thermometer,
  Droplets,
  ClipboardList,
  Users,
  MessageSquare
} from 'lucide-react';
import { authAPI } from '@/lib/api/auth';
import { useToast } from '@/hooks/useToast';
import {
  API_BASE,
  conditionEmojis,
  timeSlotConfig,
  type ClassData,
  type DailyPlan,
  type Student,
} from './training-model';
import { MobileInstructorFilter } from '../_components/MobileInstructorFilter';
import {
  collectVisibleClassStudents,
  filterVisiblePlans,
  getMobileInstructorOptionsFromClasses,
  isOwnerOrAdmin,
  type MobileInstructorOption,
} from '../_lib/class-scope';

export default function MobileTrainingPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('morning');
  const [activeTab, setActiveTab] = useState<'checklist' | 'condition'>('condition');
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(() => authAPI.getCurrentUser());
  const [instructorOptions, setInstructorOptions] = useState<MobileInstructorOption[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);

  // 환경 체크
  const [envCheck, setEnvCheck] = useState({ checked: false, temperature: '', humidity: '' });

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

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
      if (!assignmentsRes.ok) throw new Error('assignments');
      const assignmentsData = await assignmentsRes.json();

      // 기존 수업 기록 로드
      const trainingRes = await fetch(
        `${API_BASE}/training?date=${selectedDate}`,
        { headers }
      );
      if (!trainingRes.ok) throw new Error('training');
      const trainingData = await trainingRes.json();
      const existingLogs = trainingData.logs || [];

      // 시간대별 학생 필터링
      const slotsData = assignmentsData.slots || {};
      const slotInfo = slotsData[selectedTimeSlot] || {};

      // 현재 유저 정보
      const currentUser = authAPI.getCurrentUser();
      setCurrentUser(currentUser);
      const slotClasses = (slotInfo.classes as ClassData[] | undefined) || [];
      const nextInstructorOptions = getMobileInstructorOptionsFromClasses(slotClasses);
      const nextInstructorId = selectedInstructorId !== null && nextInstructorOptions.some(option => option.id === selectedInstructorId)
        ? selectedInstructorId
        : null;
      setInstructorOptions(nextInstructorOptions);
      if (nextInstructorId !== selectedInstructorId) setSelectedInstructorId(nextInstructorId);

      const myStudents = collectVisibleClassStudents(slotClasses, currentUser, nextInstructorId);

      const slotData = myStudents.map((s) => {
        const existingLog = existingLogs.find((l: { student_id: number }) => l.student_id === s.student_id);
        const classTrainerId = slotClasses
          .find((classData) => classData.students.some((student) => student.student_id === s.student_id))
          ?.instructors[0]?.id;
        return {
          id: s.student_id,
          assignment_id: s.id,
          training_log_id: existingLog?.id,
          trainer_id: nextInstructorId ?? classTrainerId ?? currentUser?.instructorId ?? null,
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
      if (!planRes.ok) throw new Error('plans');
      const planData = await planRes.json();

      setPlans(filterVisiblePlans(planData.plans || [], currentUser, nextInstructorId));
    } catch {
      toastRef.current.error('수업 기록 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTimeSlot, selectedInstructorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 컨디션·메모 저장: 기록이 있으면 보낸 칸만 바꾸고, 없으면 PC 수업 기록처럼 새로 만든다.
  const saveLog = async (student: Student, changes: { condition_score: number } | { notes: string }) => {
    const isCondition = 'condition_score' in changes;
    setSaving(`${isCondition ? 'condition' : 'notes'}-${student.id}`);

    try {
      const token = authAPI.getToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      let trainingLogId = student.training_log_id;

      if (trainingLogId) {
        const response = await fetch(`${API_BASE}/training/${trainingLogId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(changes),
        });
        if (!response.ok) throw new Error('training');
      } else {
        if (!student.trainer_id) {
          toastRef.current.error('기록을 저장할 담당 강사를 확인하지 못했습니다.');
          return;
        }
        const response = await fetch(`${API_BASE}/training`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            date: selectedDate,
            student_id: student.id,
            trainer_id: student.trainer_id,
            plan_id: plans.find((plan) => plan.instructor_id === student.trainer_id)?.id ?? null,
            condition_score: null,
            notes: '',
            ...changes,
          }),
        });
        if (!response.ok) throw new Error('training');
        trainingLogId = (await response.json()).logId;
      }

      setStudents(prev =>
        prev.map(s =>
          s.id === student.id
            ? { ...s, ...changes, training_log_id: trainingLogId }
            : s
        )
      );
    } catch {
      toastRef.current.error(isCondition
        ? '학생 컨디션을 저장하지 못했습니다. 다시 시도해주세요.'
        : '학생 메모를 저장하지 못했습니다. 다시 시도해주세요.');
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
      if (!res.ok) throw new Error('toggle');
      const data = await res.json();

      setPlans(prev => prev.map(p =>
        p.id === planId
          ? { ...p, completed_exercises: data.completed_exercises || [], exercise_times: data.exercise_times || {} }
          : p
      ));
    } catch {
      toastRef.current.error('운동 완료 상태를 저장하지 못했습니다. 다시 시도해주세요.');
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
      <div className="flex items-center justify-between bg-card rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-medium text-foreground bg-transparent border-none outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{koreanDate}</span>
          <button
            onClick={loadData}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
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
                ? 'bg-primary text-white shadow-md'
                : 'bg-card text-secondary-foreground'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <MobileInstructorFilter
        options={instructorOptions}
        selectedInstructorId={selectedInstructorId}
        visible={isOwnerOrAdmin(currentUser)}
        onChange={setSelectedInstructorId}
      />

      {/* 내부 탭 */}
      <div className="flex gap-2 bg-card rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('condition')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'condition'
              ? 'bg-foreground text-background'
              : 'text-secondary-foreground'
          }`}
        >
          <Users size={16} />
          <span>학생 컨디션</span>
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'checklist'
              ? 'bg-foreground text-background'
              : 'text-secondary-foreground'
          }`}
        >
          <ClipboardList size={16} />
          <span>체크리스트</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-primary" />
        </div>
      ) : activeTab === 'condition' ? (
        /* 학생 컨디션 탭 */
        <div className="space-y-2">
          {students.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 text-center">
              <p className="text-muted-foreground text-sm">이 시간대에 배치된 학생이 없습니다</p>
            </div>
          ) : (
            students.map((student) => {
              const isSavingCondition = saving === `condition-${student.id}`;
              const isSavingNotes = saving === `notes-${student.id}`;

              return (
                <div key={student.id} className="bg-card rounded-2xl p-4">
                  {/* 학생 이름 */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      student.gender === 'male' ? 'bg-primary' : 'bg-pink-500'
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <p className="font-medium text-foreground">{student.name}</p>
                    {!!student.is_trial && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-600">
                        {(student.trial_total || 0) - (student.trial_remaining || 0)}/{student.trial_total || 0}
                      </span>
                    )}
                    {isSavingCondition && (
                      <Check size={16} className="text-success ml-auto" />
                    )}
                  </div>

                  {/* 컨디션 버튼 */}
                  <div className="flex gap-2 mb-3">
                    {conditionEmojis.map(({ score, emoji, label }) => (
                      <button
                        key={score}
                        onClick={() => saveLog(student, { condition_score: score })}
                        className={`flex-1 flex flex-col items-center py-2 rounded-xl transition ${
                          student.condition_score === score
                            ? 'bg-primary-soft border-2 border-primary'
                            : 'bg-muted border-2 border-transparent'
                        }`}
                      >
                        <span className="text-xl">{emoji}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 메모 */}
                  <div className="relative">
                    <div className="absolute left-3 top-3">
                      <MessageSquare size={16} className="text-muted-foreground" />
                    </div>
                    <input
                      type="text"
                      placeholder="메모..."
                      defaultValue={student.notes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (student.notes || '')) {
                          saveLog(student, { notes: e.target.value });
                        }
                      }}
                      className="w-full h-10 pl-10 pr-8 text-sm bg-muted rounded-lg border border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                    {isSavingNotes && (
                      <Check size={14} className="absolute right-3 top-3 text-success" />
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
          <div className="bg-card rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEnvCheck(prev => ({ ...prev, checked: !prev.checked }))}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                  envCheck.checked
                    ? 'bg-success border-success'
                    : 'border-border'
                }`}
              >
                {envCheck.checked && <Check size={12} className="text-white" />}
              </button>
              <span className="text-sm font-medium text-foreground flex-shrink-0">환경</span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Thermometer size={14} className="text-destructive flex-shrink-0" />
                <input
                  type="number"
                  placeholder="25"
                  value={envCheck.temperature}
                  onChange={(e) => setEnvCheck(prev => ({ ...prev, temperature: e.target.value }))}
                  className="w-10 bg-muted rounded px-1 py-0.5 text-sm text-center outline-none text-foreground"
                />
                <span className="text-xs text-muted-foreground">°C</span>
              </div>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Droplets size={14} className="text-primary flex-shrink-0" />
                <input
                  type="number"
                  placeholder="50"
                  value={envCheck.humidity}
                  onChange={(e) => setEnvCheck(prev => ({ ...prev, humidity: e.target.value }))}
                  className="w-10 bg-muted rounded px-1 py-0.5 text-sm text-center outline-none text-foreground"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* 계획된 운동 */}
          <div className="bg-card rounded-2xl divide-y divide-border">
            <div className="px-4 py-3">
              <h3 className="font-medium text-foreground">계획된 운동</h3>
            </div>
            {allExercises.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                계획된 운동이 없습니다
              </div>
            ) : (
              allExercises.map((ex, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => toggleExercise(ex.planId, ex.id)}
                    className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition ${
                      ex.completed
                        ? 'bg-success border-success'
                        : 'border-border'
                    }`}
                  >
                    {ex.completed && <Check size={12} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {ex.name}
                      {(ex.sets || ex.reps) && (
                        <span className="text-muted-foreground ml-1">
                          {ex.sets && `${ex.sets}세트`}{ex.sets && ex.reps && '/'}{ex.reps && `${ex.reps}회`}
                        </span>
                      )}
                    </p>
                  </div>
                  {ex.completed_at && (
                    <span className="text-xs text-success flex-shrink-0">
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
