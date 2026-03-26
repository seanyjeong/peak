'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { Users, RefreshCw, Sunrise, Sun, Moon, Check, X, Clock, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useOrientation } from '../layout';

type TimeSlot = 'morning' | 'afternoon' | 'evening';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | null;

interface Student {
  assignment_id: number;
  student_id: number;
  student_name: string;
  gender: string;
  school: string;
  grade: string;
  class_id: number | null;
  is_trial: number;
  paca_attendance_id: number | null;
  attendance_status: AttendanceStatus;
  notes: string | null;
}

interface SlotsData {
  morning: Student[];
  afternoon: Student[];
  evening: Student[];
}

interface Stats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  unchecked: number;
}

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: typeof Sun; color: string; bgColor: string }> = {
  morning: { label: '오전', icon: Sunrise, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  afternoon: { label: '오후', icon: Sun, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  evening: { label: '저녁', icon: Moon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  present: { label: '출석', color: 'text-green-700', bgColor: 'bg-green-100' },
  absent: { label: '결석', color: 'text-red-700', bgColor: 'bg-red-100' },
  late: { label: '지각', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  excused: { label: '사유', color: 'text-blue-700', bgColor: 'bg-blue-100' },
};

export default function TabletStudentAttendancePage() {
  const toast = useToast();
  const orientation = useOrientation();
  const [slotsData, setSlotsData] = useState<SlotsData>({ morning: [], afternoon: [], evening: [] });
  const [stats, setStats] = useState<Stats>({ total: 0, present: 0, absent: 0, late: 0, excused: 0, unchecked: 0 });
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [updating, setUpdating] = useState<number | null>(null);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  const getLocalDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = getLocalDateString();
      const res = await apiClient.get(`/attendance/students?date=${dateStr}`);
      setSlotsData(res.data.slots || { morning: [], afternoon: [], evening: [] });
      setStats(res.data.stats || { total: 0, present: 0, absent: 0, late: 0, excused: 0, unchecked: 0 });

      const slots = res.data.slots;
      if (slots.evening?.length > 0) setActiveSlot('evening');
      else if (slots.afternoon?.length > 0) setActiveSlot('afternoon');
      else if (slots.morning?.length > 0) setActiveSlot('morning');
    } catch (error) {
      console.error('Failed to fetch student attendance:', error);
      toast.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleQuickSet = async (student: Student, status: AttendanceStatus) => {
    if (!student.paca_attendance_id || updating || student.attendance_status === status) return;

    setUpdating(student.paca_attendance_id);
    try {
      await apiClient.post('/attendance/student', {
        paca_attendance_id: student.paca_attendance_id,
        attendance_status: status
      });

      setSlotsData(prev => {
        const newSlots = { ...prev };
        Object.keys(newSlots).forEach(slot => {
          newSlots[slot as TimeSlot] = newSlots[slot as TimeSlot].map(s =>
            s.paca_attendance_id === student.paca_attendance_id
              ? { ...s, attendance_status: status }
              : s
          );
        });
        return newSlots;
      });

      setStats(prev => {
        const newStats = { ...prev };
        if (student.attendance_status && student.attendance_status in newStats) {
          (newStats as any)[student.attendance_status]--;
        } else {
          newStats.unchecked--;
        }
        if (status && status in newStats) {
          (newStats as any)[status]++;
        }
        return newStats;
      });
    } catch (error) {
      console.error('Failed to update attendance:', error);
      toast.error(error);
    } finally {
      setUpdating(null);
    }
  };

  const getSlotCount = (slot: TimeSlot) => slotsData[slot].length;
  const getSlotPresent = (slot: TimeSlot) => slotsData[slot].filter(s => s.attendance_status === 'present').length;

  const currentStudents = slotsData[activeSlot];

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">학생 출석체크</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{today}</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-3 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <Users size={40} className="text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-slate-800 dark:text-slate-100">
              {stats.present}
              <span className="text-slate-400 text-2xl">/{stats.total}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-lg">출석 완료</p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-red-500">{stats.absent}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">결석</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">{stats.late}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">지각</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-400">{stats.unchecked}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">미체크</p>
            </div>
          </div>
        </div>
      </div>

      {/* Time Slot Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(Object.keys(TIME_SLOT_INFO) as TimeSlot[]).map((slot) => {
          const info = TIME_SLOT_INFO[slot];
          const Icon = info.icon;
          const count = getSlotCount(slot);
          const present = getSlotPresent(slot);
          const isActive = activeSlot === slot;

          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition flex-shrink-0 ${
                isActive
                  ? `${info.bgColor} ${info.color} ring-2 ring-offset-2`
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{info.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-sm ${
                isActive ? 'bg-white/50' : 'bg-slate-100 dark:bg-slate-700'
              }`}>
                {present}/{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Student List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
            {TIME_SLOT_INFO[activeSlot].label} 학생 ({currentStudents.length}명)
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <RefreshCw size={40} className="animate-spin mx-auto mb-2" />
            <p className="text-lg">로딩 중...</p>
          </div>
        ) : currentStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <p className="text-lg">{TIME_SLOT_INFO[activeSlot].label}에 배정된 학생이 없습니다.</p>
            <p className="text-sm mt-2">반 배치 → 출석 동기화를 먼저 실행하세요.</p>
          </div>
        ) : (
          <div className={`divide-y divide-slate-100 dark:divide-slate-700 ${orientation === 'landscape' ? 'max-h-[400px] overflow-y-auto' : ''}`}>
            {currentStudents.map((student) => {
              const isPresent = student.attendance_status === 'present';
              const isUpdating = updating === student.paca_attendance_id;
              const noLink = !student.paca_attendance_id;

              return (
                <div
                  key={student.assignment_id}
                  className={`flex items-center justify-between p-4 transition ${
                    isPresent ? 'bg-green-50 dark:bg-green-900/20' : ''
                  } ${noLink ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium ${
                        isPresent ? 'bg-green-500' :
                        student.attendance_status === 'absent' ? 'bg-red-400' :
                        student.attendance_status === 'late' ? 'bg-yellow-500' :
                        'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      {student.student_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800 dark:text-slate-100 text-lg">{student.student_name}</p>
                        {student.is_trial === 1 && (
                          <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">체험</span>
                        )}
                        {student.class_id && (
                          <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">{student.class_id}반</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {student.grade} {student.school ? `· ${student.school}` : ''}
                      </p>
                    </div>
                  </div>

                  {noLink ? (
                    <span className="text-xs text-slate-400">동기화 필요</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {(['present', 'absent', 'late', 'excused'] as const).map(s => {
                        const cfg = STATUS_CONFIG[s];
                        const isActive = student.attendance_status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => handleQuickSet(student, s)}
                            disabled={isUpdating}
                            className={`px-4 py-2 text-sm rounded-xl transition touch-target ${
                              isActive
                                ? `${cfg.bgColor} ${cfg.color} font-semibold ring-1 ring-current`
                                : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600'
                            } ${isUpdating ? 'opacity-50' : ''}`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 bg-slate-100 dark:bg-slate-900 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300">
        <p>출석 변경은 P-ACA에 즉시 반영됩니다.</p>
      </div>
    </div>
  );
}
