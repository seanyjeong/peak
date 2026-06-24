'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sunrise, Sun, Moon, RefreshCw, Check, X, Clock, Users, Dumbbell, Thermometer, Droplets } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface Student {
  student_id: number;
  name: string;
  gender: string;
  school: string;
  grade: string;
  class_id: number | null;
  is_trial: number;
  attendance_status: string | null;
  attendance_notes: string | null;
}

interface Plan {
  id: number;
  exercises: { exercise_id: number; name?: string; id?: number }[];
  completedExercises: number[];
  temperature: number | null;
  humidity: number | null;
  conditionsChecked: boolean;
  description: string;
}

interface SlotData {
  students: Student[];
  plan: Plan[];
  stats: { total: number; present: number; absent: number; late: number };
}

const TIME_SLOTS: { key: TimeSlot; label: string; icon: typeof Sun }[] = [
  { key: 'morning', label: '오전', icon: Sunrise },
  { key: 'afternoon', label: '오후', icon: Sun },
  { key: 'evening', label: '저녁', icon: Moon },
];

const ATT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  present: { label: '출석', color: 'text-green-700', bg: 'bg-green-100' },
  absent: { label: '결석', color: 'text-red-700', bg: 'bg-red-100' },
  late: { label: '지각', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  excused: { label: '사유', color: 'text-blue-700', bg: 'bg-blue-100' },
};

export default function MyClassPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [slots, setSlots] = useState<Record<TimeSlot, SlotData | null>>({ morning: null, afternoon: null, evening: null });
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [loading, setLoading] = useState(true);
  const [hasClass, setHasClass] = useState(true);

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const getLocalDate = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/mobile/my-class?date=${getLocalDate()}`);
      const d = res.data;
      setSlots(d.slots);
      setHasClass(d.hasClass);

      // 데이터 있는 첫 슬롯 선택
      if (d.slots.evening) setActiveSlot('evening');
      else if (d.slots.afternoon) setActiveSlot('afternoon');
      else if (d.slots.morning) setActiveSlot('morning');
    } catch {
      toastRef.current.error('내 반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const current = slots[activeSlot];

  return (
    <div>
      {/* Date + Refresh */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{today}</p>
        <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <RefreshCw size={16} className={loading ? 'animate-spin text-slate-400' : 'text-slate-500'} />
        </button>
      </div>

      {/* Time Slot Tabs */}
      <div className="flex gap-1.5 mb-3">
        {TIME_SLOTS.map(({ key, label, icon: Icon }) => {
          const data = slots[key];
          const isActive = activeSlot === key;
          const hasData = !!data;
          return (
            <button
              key={key}
              onClick={() => hasData && setActiveSlot(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-orange-500 text-white shadow-sm'
                  : hasData
                    ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {hasData && (
                <span className={`text-xs px-1.5 rounded-full ${isActive ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  {data.stats.present}/{data.stats.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw size={28} className="animate-spin mx-auto mb-2" />
          <p>로딩 중...</p>
        </div>
      ) : !hasClass ? (
        <div className="py-20 text-center text-slate-400 dark:text-slate-500">
          <Users size={40} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">오늘 배치된 반이 없습니다</p>
          <p className="text-sm mt-1">태블릿에서 반 배치를 확인하세요</p>
        </div>
      ) : !current ? (
        <div className="py-20 text-center text-slate-400 dark:text-slate-500">
          <p>이 시간대에 수업이 없습니다</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{current.stats.present}</p>
              <p className="text-[11px] text-green-600/70">출석</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{current.stats.absent}</p>
              <p className="text-[11px] text-red-500/70">결석</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{current.stats.late}</p>
              <p className="text-[11px] text-yellow-600/70">지각</p>
            </div>
          </div>

          {/* Student List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <Users size={16} className="text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">학생 ({current.students.length}명)</h2>
            </div>
            {current.students.length === 0 ? (
              <p className="p-6 text-center text-slate-400 text-sm">배정된 학생이 없습니다</p>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {current.students.map(s => {
                  const att = s.attendance_status ? ATT_BADGE[s.attendance_status] : null;
                  return (
                    <div key={s.student_id} className={`flex items-center justify-between px-4 py-3 ${s.attendance_status === 'present' ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                          s.attendance_status === 'present' ? 'bg-green-500' :
                          s.attendance_status === 'absent' ? 'bg-red-400' :
                          s.attendance_status === 'late' ? 'bg-yellow-500' :
                          'bg-slate-300 dark:bg-slate-600'
                        }`}>
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{s.name}</span>
                            {s.is_trial === 1 && <span className="text-[9px] px-1 bg-amber-100 text-amber-700 rounded">체험</span>}
                            {s.class_id && <span className="text-[9px] px-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">{s.class_id}반</span>}
                          </div>
                          <p className="text-[11px] text-slate-400">{s.grade}{s.school ? ` · ${s.school}` : ''}</p>
                        </div>
                      </div>
                      {att ? (
                        <span className={`text-xs px-2 py-1 rounded-lg ${att.bg} ${att.color}`}>{att.label}</span>
                      ) : (
                        <span className="text-[11px] text-slate-300">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Plan */}
          {current.plan.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <Dumbbell size={16} className="text-slate-500" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">오늘 수업 계획</h2>
              </div>
              {current.plan.map((plan, idx) => (
                <div key={plan.id || idx} className="px-4 py-3">
                  {/* Environment */}
                  {(plan.temperature || plan.humidity) && (
                    <div className="flex gap-3 mb-2 text-xs text-slate-500 dark:text-slate-400">
                      {plan.temperature && <span className="flex items-center gap-1"><Thermometer size={12} />{plan.temperature}°C</span>}
                      {plan.humidity && <span className="flex items-center gap-1"><Droplets size={12} />{plan.humidity}%</span>}
                    </div>
                  )}
                  {/* Exercises */}
                  {plan.exercises.length > 0 ? (
                    <div className="space-y-1.5">
                      {plan.exercises.map((ex, i) => {
                        const exId = ex.exercise_id || ex.id || 0;
                        const done = plan.completedExercises.includes(exId);
                        return (
                          <div key={i} className={`flex items-center gap-2 text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-100 text-green-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                              {done ? <Check size={12} /> : <span className="text-[10px]">{i+1}</span>}
                            </div>
                            <span>{ex.name || `운동 #${exId}`}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">등록된 운동이 없습니다</p>
                  )}
                  {plan.description && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">{plan.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
