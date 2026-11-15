'use client';

import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Moon,
  RefreshCw,
  Sun,
  Sunrise,
  UserCheck,
  Users,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import { PageHeader, StatTile, toolbarButtonClass } from '@/components/ui/page';

type TimeSlot = 'morning' | 'afternoon' | 'evening';
type AttendanceStatus = 'scheduled' | 'present' | 'absent' | 'late';

interface Instructor {
  id: number;
  name: string;
  time_slot: TimeSlot;
  attendance_status: AttendanceStatus;
  check_in_time: string | null;
  check_out_time: string | null;
}

interface SlotsData {
  morning: Instructor[];
  afternoon: Instructor[];
  evening: Instructor[];
}

interface Stats {
  total: number;
  checkedIn: number;
  uniqueInstructors: number;
}

interface AttendanceResponse {
  slots?: Partial<SlotsData>;
  stats?: Partial<Stats>;
}

const EMPTY_SLOTS: SlotsData = { morning: [], afternoon: [], evening: [] };
const EMPTY_STATS: Stats = { total: 0, checkedIn: 0, uniqueInstructors: 0 };

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: ComponentType<{ size?: number }> }> = {
  morning: { label: '오전반', icon: Sunrise },
  afternoon: { label: '오후반', icon: Sun },
  evening: { label: '저녁반', icon: Moon },
};

type TimeSlotTimes = Record<TimeSlot, string>;

// 시간대 시각은 P-ACA 학원 설정(반 배치 응답의 timeSlots)을 쓴다. 못 받았을 때만 이 기본값.
const DEFAULT_TIME_SLOTS: TimeSlotTimes = {
  morning: '09:00-12:00',
  afternoon: '13:00-17:00',
  evening: '18:00-21:00',
};

const STATUS_INFO: Record<AttendanceStatus, { label: string; className: string }> = {
  present: {
    label: '출근',
    className: 'border-success/30 bg-success-soft text-success',
  },
  scheduled: {
    label: '예정',
    className: 'border-border bg-muted text-secondary-foreground',
  },
  absent: {
    label: '결근',
    className: 'border-destructive/30 bg-destructive-soft text-destructive',
  },
  late: {
    label: '지각',
    className: 'border-warning/30 bg-warning-soft text-warning',
  },
};

const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export default function AttendancePage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [slotsData, setSlotsData] = useState<SlotsData>(EMPTY_SLOTS);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [timeSlots, setTimeSlots] = useState<TimeSlotTimes>(DEFAULT_TIME_SLOTS);

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
      const [res, assignmentsRes] = await Promise.all([
        apiClient.get<AttendanceResponse>(`/attendance?date=${dateStr}`),
        // 시간대 시각은 대시보드처럼 반 배치 응답의 timeSlots(P-ACA 학원 설정). 못 받으면 기본 시각 그대로.
        apiClient.get<{ timeSlots?: TimeSlotTimes }>(`/assignments?date=${dateStr}`).catch(() => null),
      ]);
      if (assignmentsRes?.data.timeSlots) {
        setTimeSlots(assignmentsRes.data.timeSlots);
      }
      const nextSlots = normalizeSlots(res.data.slots);

      setSlotsData(nextSlots);
      setStats({
        ...EMPTY_STATS,
        ...res.data.stats,
      });
      setActiveSlot(getDefaultSlot(nextSlots));
    } catch {
      toastRef.current.error('출근 현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentInstructors = slotsData[activeSlot];
  const attendanceRate = stats.uniqueInstructors > 0
    ? Math.round((stats.checkedIn / stats.uniqueInstructors) * 100)
    : 0;
  const pendingCount = Math.max(stats.uniqueInstructors - stats.checkedIn, 0);

  return (
    <div className="mx-auto max-w-[1280px] space-y-4" data-testid="attendance-page">
      <PageHeader
        title="출근 체크"
        description={today}
        actions={(
          <button onClick={fetchData} disabled={loading} className={toolbarButtonClass()}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        )}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="출근 요약">
        <StatTile icon={UserCheck} tone="primary" label="출근 강사" value={`${stats.checkedIn}/${stats.uniqueInstructors}`} note={`${attendanceRate}% 완료`} />
        <StatTile icon={Clock3} tone={pendingCount > 0 ? 'warning' : 'neutral'} label="확인 필요" value={`${pendingCount}명`} note="미출근 또는 예정" />
        <StatTile icon={Users} className="col-span-2 lg:col-span-1" label="오늘 배정" value={`${stats.total}건`} note="시간대 중복 포함" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="self-start rounded-2xl bg-card">
          <div className="px-5 pb-2 pt-5">
            <h2 className="text-[17px] font-bold tracking-tight text-foreground">시간대 선택</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">강사가 배정된 반을 먼저 확인합니다.</p>
          </div>
          <div className="space-y-1 p-3">
            {SLOT_ORDER.map((slot) => (
              <SlotButton
                key={slot}
                slot={slot}
                time={timeSlots[slot]}
                active={activeSlot === slot}
                count={slotsData[slot].length}
                checkedIn={getSlotCheckedIn(slotsData[slot])}
                onClick={() => setActiveSlot(slot)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card" data-testid="attendance-list">
          <div className="px-5 pb-2 pt-5">
            <h2 className="text-[17px] font-bold tracking-tight text-foreground">
              {TIME_SLOT_INFO[activeSlot].label} 강사
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {timeSlots[activeSlot]} · {currentInstructors.length}명 배정
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
              <RefreshCw size={18} className="mr-2 animate-spin text-primary" />
              출근 현황을 불러오는 중입니다.
            </div>
          ) : currentInstructors.length === 0 ? (
            <EmptyState slot={activeSlot} />
          ) : (
            <div className="divide-y divide-border/60 px-5 pb-2">
              {currentInstructors.map((instructor) => (
                <InstructorRow key={`${instructor.id}-${instructor.time_slot}`} instructor={instructor} />
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-2xl bg-card px-5 py-4 text-sm text-muted-foreground">
        출근 상태 변경은 P-ACA에서 처리됩니다. 이 화면은 Peak 수업 운영자가 현재 반 배정과 강사 출근 상태를 빠르게 확인하는 용도입니다.
      </aside>
    </div>
  );
}

function SlotButton({
  slot,
  time,
  active,
  count,
  checkedIn,
  onClick,
}: {
  slot: TimeSlot;
  time: string;
  active: boolean;
  count: number;
  checkedIn: number;
  onClick: () => void;
}) {
  const info = TIME_SLOT_INFO[slot];
  const Icon = info.icon;

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? 'bg-primary-soft text-foreground'
          : 'text-secondary-foreground hover:bg-muted'
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${active ? 'bg-card text-primary' : 'bg-muted text-muted-foreground'}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{info.label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{time}</span>
      </span>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {checkedIn}/{count}
      </span>
    </button>
  );
}

function InstructorRow({ instructor }: { instructor: Instructor }) {
  const status = STATUS_INFO[instructor.attendance_status] || STATUS_INFO.scheduled;
  const isPresent = instructor.attendance_status === 'present' || instructor.attendance_status === 'late';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isPresent
            ? 'bg-success-soft text-success'
            : 'bg-muted text-muted-foreground'
        }`}>
          {isPresent ? <CheckCircle2 size={19} /> : instructor.name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-foreground">{instructor.name}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            {TIME_SLOT_INFO[instructor.time_slot].label} 근무
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {instructor.check_in_time ? (
          <span className="hidden items-center gap-1.5 text-sm font-medium text-secondary-foreground sm:inline-flex">
            <Clock3 size={15} />
            {instructor.check_in_time.slice(0, 5)}
          </span>
        ) : null}
        <span className={`rounded-full border px-2.5 py-0.5 text-[13px] font-semibold ${status.className}`}>{status.label}</span>
      </div>
    </div>
  );
}

function EmptyState({ slot }: { slot: TimeSlot }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
      <AlertCircle size={30} className="text-muted-foreground/60" />
      <p className="mt-3 font-medium text-secondary-foreground">
        {TIME_SLOT_INFO[slot].label}에 배정된 강사가 없습니다.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">P-ACA에서 강사 스케줄을 확인해주세요.</p>
    </div>
  );
}

function normalizeSlots(slots?: Partial<SlotsData>): SlotsData {
  return {
    morning: slots?.morning || [],
    afternoon: slots?.afternoon || [],
    evening: slots?.evening || [],
  };
}

function getDefaultSlot(slots: SlotsData): TimeSlot {
  if (slots.evening.length > 0) return 'evening';
  if (slots.afternoon.length > 0) return 'afternoon';
  if (slots.morning.length > 0) return 'morning';
  return 'evening';
}

function getSlotCheckedIn(instructors: Instructor[]) {
  return instructors.filter((instructor) => (
    instructor.attendance_status === 'present' || instructor.attendance_status === 'late'
  )).length;
}

function getLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
