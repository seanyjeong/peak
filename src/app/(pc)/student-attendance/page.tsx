'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, UserRoundCheck, X } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import {
  EMPTY_SLOTS,
  EMPTY_STATS,
  SLOT_ORDER,
  TIME_SLOT_INFO,
  adjustStats,
  countStatus,
  getDefaultSlot,
  getLocalDateString,
  normalizeSlots,
  updateManyStudentStatuses,
  type AttendanceStatus,
  type SlotsData,
  type Student,
  type Stats,
  type StudentAttendanceResponse,
  type TimeSlot,
} from './student-attendance-model';
import { EmptyState, SlotButton, StudentRow, SummaryCard } from './student-attendance-ui';

export default function StudentAttendancePage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [slotsData, setSlotsData] = useState<SlotsData>(EMPTY_SLOTS);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [updating, setUpdating] = useState<number | 'batch' | null>(null);

  const today = useMemo(() => new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }), []);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = getLocalDateString();
      const res = await apiClient.get<StudentAttendanceResponse>(`/attendance/students?date=${dateStr}`);
      const nextSlots = normalizeSlots(res.data.slots);

      setSlotsData(nextSlots);
      setStats({ ...EMPTY_STATS, ...res.data.stats });
      setActiveSlot(getDefaultSlot(nextSlots));
    } catch {
      toastRef.current.error('학생 출석 현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentStudents = slotsData[activeSlot];
  const currentUnchecked = currentStudents.filter((student) => student.paca_attendance_id && !student.attendance_status);
  const completionRate = stats.total > 0 ? Math.round(((stats.total - stats.unchecked) / stats.total) * 100) : 0;

  const handleQuickSet = async (student: Student, status: AttendanceStatus) => {
    if (!student.paca_attendance_id || updating || student.attendance_status === status) return;

    setUpdating(student.paca_attendance_id);
    try {
      await apiClient.post('/attendance/student', {
        paca_attendance_id: student.paca_attendance_id,
        attendance_status: status,
      });

      applyStudentStatus(student.paca_attendance_id, status);
      setStats((prev) => adjustStats(prev, student.attendance_status, status));
    } catch {
      toastRef.current.error('출석 상태를 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkUncheckedPresent = async () => {
    if (updating || currentUnchecked.length === 0) return;

    setUpdating('batch');
    try {
      await apiClient.post('/attendance/student/batch', {
        updates: currentUnchecked.map((student) => ({
          paca_attendance_id: student.paca_attendance_id,
          attendance_status: 'present',
        })),
      });

      setSlotsData((prev) => updateManyStudentStatuses(prev, currentUnchecked, 'present'));
      setStats((prev) => currentUnchecked.reduce((nextStats, student) => (
        adjustStats(nextStats, student.attendance_status, 'present')
      ), prev));
      toastRef.current.success(`${currentUnchecked.length}명을 출석 처리했습니다.`);
    } catch {
      toastRef.current.error('일괄 출석 처리를 완료하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setUpdating(null);
    }
  };

  const applyStudentStatus = (pacaAttendanceId: number, status: AttendanceStatus) => {
    setSlotsData((prev) => {
      const nextSlots = { ...prev };
      SLOT_ORDER.forEach((slot) => {
        nextSlots[slot] = nextSlots[slot].map((student) => (
          student.paca_attendance_id === pacaAttendanceId
            ? { ...student, attendance_status: status }
            : student
        ));
      });
      return nextSlots;
    });
  };

  return (
    <div className="mx-auto max-w-[1380px] space-y-6" data-testid="student-attendance-page">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Student Attendance</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">학생 출석</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{today}</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="학생 출석 요약">
        <SummaryCard icon={UserRoundCheck} label="출석 완료" value={`${stats.present}/${stats.total}`} detail={`${completionRate}% 확인`} tone="green" />
        <SummaryCard icon={AlertCircle} label="미체크" value={`${stats.unchecked}명`} detail="확인 필요" tone="slate" />
        <SummaryCard icon={X} label="결석" value={`${stats.absent}명`} detail="오늘 결석" tone="red" />
        <SummaryCard icon={Clock3} label="지각/사유" value={`${stats.late + stats.excused}명`} detail={`지각 ${stats.late} · 사유 ${stats.excused}`} tone="amber" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">시간대 선택</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">출석 처리할 반을 선택합니다.</p>
          </div>
          <div className="space-y-2 p-3">
            {SLOT_ORDER.map((slot) => (
              <SlotButton
                key={slot}
                slot={slot}
                active={activeSlot === slot}
                count={slotsData[slot].length}
                present={countStatus(slotsData[slot], 'present')}
                onClick={() => setActiveSlot(slot)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="student-attendance-list">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                {TIME_SLOT_INFO[activeSlot].label} 학생
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {TIME_SLOT_INFO[activeSlot].time} · {currentStudents.length}명 배정
              </p>
            </div>
            <button
              onClick={handleMarkUncheckedPresent}
              disabled={loading || updating !== null || currentUnchecked.length === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 dark:focus-visible:ring-offset-slate-900"
            >
              {updating === 'batch' ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              미체크 출석 처리
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw size={18} className="mr-2 animate-spin text-orange-500" />
              학생 출석 현황을 불러오는 중입니다.
            </div>
          ) : currentStudents.length === 0 ? (
            <EmptyState slot={activeSlot} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentStudents.map((student) => (
                <StudentRow
                  key={student.assignment_id}
                  student={student}
                  updating={updating === student.paca_attendance_id}
                  onSetStatus={handleQuickSet}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        출석 변경은 P-ACA에 바로 반영됩니다. 학생이 동기화 필요 상태라면 먼저 반 배치에서 출석 동기화를 실행하세요.
      </aside>
    </div>
  );
}
