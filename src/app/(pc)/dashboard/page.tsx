'use client';

import type { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ListChecks,
  Medal,
  Moon,
  RefreshCw,
  Sun,
  Sunrise,
  Users,
} from 'lucide-react';
import { useDashboard, getTodayFormatted, type CurrentInstructor } from '@/features/dashboard';

const SLOT_ICONS = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
};

export default function DashboardPage() {
  const router = useRouter();
  const { loading, currentAttendance, getStats, getScheduleData } = useDashboard();

  const today = getTodayFormatted();
  const stats = getStats();
  const scheduleData = getScheduleData(SLOT_ICONS);

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center" data-testid="dashboard-loading">
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <RefreshCw size={18} className="animate-spin text-orange-500" />
          오늘 훈련 데이터를 불러오는 중입니다.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6" data-testid="dashboard-page">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Today</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">대시보드</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Calendar} label="반 배치 관리" onClick={() => router.push('/assignments')} primary />
          <ActionButton icon={Medal} label="기록 측정" onClick={() => router.push('/records')} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3" aria-label="오늘 요약">
        <MetricPanel icon={Users} label="출근 강사" value={`${stats.trainersPresent}명`} detail={`배정 ${stats.totalTrainers}명`} tone="orange" />
        <MetricPanel icon={Activity} label="수업 학생" value={`${stats.studentsToday}명`} detail="오늘 전체 시간대" tone="blue" />
        <MetricPanel
          icon={ListChecks}
          label="출결 준비"
          value={currentAttendance ? `${currentAttendance.stats.checkedIn}/${currentAttendance.stats.scheduled}` : '0/0'}
          detail={currentAttendance ? `${currentAttendance.currentSlotLabel} 기준` : '현재 시간대 없음'}
          tone="slate"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="dashboard-schedule">
          <PanelHeader
            title="오늘 스케줄"
            description="시간대별 배정과 학생 수를 한 번에 확인합니다."
            actionLabel="전체 보기"
            onAction={() => router.push('/assignments')}
          />
          {scheduleData.length === 0 ? (
            <EmptyPanel
              title="오늘 배정된 수업이 없습니다."
              description="반 배치에서 시간대별 학생과 강사를 먼저 배정하세요."
              actionLabel="반 배치 열기"
              onAction={() => router.push('/assignments')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {scheduleData.map((schedule) => {
                const Icon = schedule.icon;
                return (
                  <button
                    key={schedule.slot}
                    onClick={() => router.push('/assignments')}
                    className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-950 dark:text-slate-50">{schedule.label}</span>
                      <span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">{schedule.trainer}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold text-slate-950 dark:text-slate-50">{schedule.students}명</span>
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{schedule.time}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="dashboard-attendance">
          <PanelHeader
            title="강사 현황"
            description={currentAttendance ? `${currentAttendance.currentSlotLabel} 기준` : '현재 시간대 기준'}
            actionLabel="출근 관리"
            onAction={() => router.push('/attendance')}
          />
          {!currentAttendance || currentAttendance.instructors.length === 0 ? (
            <EmptyPanel title="현재 시간대에 배정된 강사가 없습니다." description="근무 배정 또는 출근 체크를 확인하세요." />
          ) : (
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="배정" value={currentAttendance.stats.scheduled} />
                <MiniStat label="출근" value={currentAttendance.stats.checkedIn} />
                <MiniStat label="미출근" value={currentAttendance.stats.notCheckedIn} />
              </div>
              <div className="space-y-2">
                {currentAttendance.instructors.map((instructor) => (
                  <InstructorRow key={instructor.id} instructor={instructor} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition ${
        primary
          ? 'border-orange-600 bg-orange-600 text-white hover:bg-orange-700'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function MetricPanel({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: 'orange' | 'blue' | 'slate';
}) {
  const toneClass = {
    orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  }[tone];

  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">{value}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${toneClass}`}>
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

function PanelHeader({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div>
        <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button onClick={onAction} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
          {actionLabel}
          <ChevronRight size={16} />
        </button>
      ) : null}
    </div>
  );
}

function EmptyPanel({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <Clock3 size={28} className="text-slate-300 dark:text-slate-600" />
      <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && onAction ? (
        <button onClick={onAction} className="mt-4 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{value}</p>
    </div>
  );
}

function InstructorRow({ instructor }: { instructor: CurrentInstructor }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3 dark:border-slate-800">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${
          instructor.checkedIn
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {instructor.checkedIn ? <CheckCircle2 size={18} /> : instructor.name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-950 dark:text-slate-50">{instructor.name}</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{instructor.checkedIn ? '출근 완료' : '미출근'}</span>
        </span>
      </div>
      {instructor.checkedIn && instructor.checkInTime ? (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{instructor.checkInTime.slice(0, 5)}</span>
      ) : null}
    </div>
  );
}
