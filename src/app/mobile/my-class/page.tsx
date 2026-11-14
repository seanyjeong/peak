'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sunrise, Sun, Moon, RefreshCw, Check, X, Clock, Users, Dumbbell, Thermometer, Droplets } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import { BranchTabs, type Branch } from '@/components/BranchTabs';

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
  present: { label: '출석', color: 'text-success', bg: 'bg-success-soft' },
  absent: { label: '결석', color: 'text-destructive', bg: 'bg-destructive-soft' },
  late: { label: '지각', color: 'text-warning', bg: 'bg-warning-soft' },
  excused: { label: '사유', color: 'text-primary', bg: 'bg-primary-soft' },
};

export default function MyClassPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [slots, setSlots] = useState<Record<TimeSlot, SlotData | null>>({ morning: null, afternoon: null, evening: null });
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [loading, setLoading] = useState(true);
  const [hasClass, setHasClass] = useState(true);
  // P-ACA 지점별로 본다. null = 전체
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);

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
      const branchQuery = branchId ? `&branch_id=${branchId}` : '';
      const res = await apiClient.get(`/mobile/my-class?date=${getLocalDate()}${branchQuery}`);
      const d = res.data;
      setSlots(d.slots);
      setHasClass(d.hasClass);
      setBranches(d.branches || []);

      // 데이터 있는 첫 슬롯 선택
      if (d.slots.evening) setActiveSlot('evening');
      else if (d.slots.afternoon) setActiveSlot('afternoon');
      else if (d.slots.morning) setActiveSlot('morning');
    } catch {
      toastRef.current.error('내 반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const current = slots[activeSlot];

  return (
    <div>
      {/* Date + Refresh */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-lg font-bold text-foreground">{today}</p>
        <button onClick={fetchData} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-xl bg-card" aria-label="새로고침">
          <RefreshCw size={16} className={loading ? 'animate-spin text-muted-foreground' : 'text-muted-foreground'} />
        </button>
      </div>

      {branches.length > 0 && (
        <div className="mb-3">
          <BranchTabs branches={branches} value={branchId} onChange={setBranchId} />
        </div>
      )}

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
                  ? 'bg-primary text-primary-foreground '
                  : hasData
                    ? 'bg-card text-secondary-foreground'
                    : 'bg-muted text-muted-foreground/60'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {hasData && (
                <span className={`text-xs px-1.5 rounded-full ${isActive ? 'bg-card/25' : 'bg-muted'}`}>
                  {data.stats.present}/{data.stats.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <RefreshCw size={28} className="animate-spin mx-auto mb-2" />
          <p>로딩 중...</p>
        </div>
      ) : !hasClass ? (
        <div className="py-20 text-center text-muted-foreground">
          <Users size={40} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">오늘 배치된 반이 없습니다</p>
          <p className="text-sm mt-1">태블릿에서 반 배치를 확인하세요</p>
        </div>
      ) : !current ? (
        <div className="py-20 text-center text-muted-foreground">
          <p>이 시간대에 수업이 없습니다</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-success-soft rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-success">{current.stats.present}</p>
              <p className="text-[11px] text-success/70">출석</p>
            </div>
            <div className="bg-destructive-soft rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{current.stats.absent}</p>
              <p className="text-[11px] text-destructive/70">결석</p>
            </div>
            <div className="bg-warning-soft rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-warning">{current.stats.late}</p>
              <p className="text-[11px] text-warning/70">지각</p>
            </div>
          </div>

          {/* Student List */}
          <div className="bg-card rounded-2xl overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Users size={16} className="text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">학생 ({current.students.length}명)</h2>
            </div>
            {current.students.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground text-sm">배정된 학생이 없습니다</p>
            ) : (
              <div className="divide-y divide-border/60">
                {current.students.map(s => {
                  const att = s.attendance_status ? ATT_BADGE[s.attendance_status] : null;
                  return (
                    <div key={s.student_id} className={`flex items-center justify-between px-4 py-3 ${s.attendance_status === 'present' ? 'bg-success-soft/50' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                          s.attendance_status === 'present' ? 'bg-success' :
                          s.attendance_status === 'absent' ? 'bg-destructive' :
                          s.attendance_status === 'late' ? 'bg-warning' :
                          'bg-muted-foreground/40'
                        }`}>
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm text-foreground">{s.name}</span>
                            {s.is_trial === 1 && <span className="text-[9px] px-1 bg-warning-soft text-warning rounded">체험</span>}
                            {s.class_id && <span className="text-[9px] px-1 bg-muted text-muted-foreground rounded">{s.class_id}반</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{s.grade}{s.school ? ` · ${s.school}` : ''}</p>
                        </div>
                      </div>
                      {att ? (
                        <span className={`text-xs px-2 py-1 rounded-lg ${att.bg} ${att.color}`}>{att.label}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Plan */}
          {current.plan.length > 0 && (
            <div className="bg-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Dumbbell size={16} className="text-muted-foreground" />
                <h2 className="font-semibold text-foreground text-sm">오늘 수업 계획</h2>
              </div>
              {current.plan.map((plan, idx) => (
                <div key={plan.id || idx} className="px-4 py-3">
                  {/* Environment */}
                  {(plan.temperature || plan.humidity) && (
                    <div className="flex gap-3 mb-2 text-xs text-muted-foreground">
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
                          <div key={i} className={`flex items-center gap-2 text-sm ${done ? 'text-muted-foreground line-through' : 'text-secondary-foreground'}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'}`}>
                              {done ? <Check size={12} /> : <span className="text-[10px]">{i+1}</span>}
                            </div>
                            <span>{ex.name || `운동 #${exId}`}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">등록된 운동이 없습니다</p>
                  )}
                  {plan.description && (
                    <p className="mt-2 text-xs text-muted-foreground bg-muted rounded-lg p-2">{plan.description}</p>
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
