'use client';

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
import { Button } from '@/components/ui/Button';
import { EmptyState, ListRow, PageHeader, SectionCard, StatTile, toolbarButtonClass } from '@/components/ui/page';

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
        <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm text-secondary-foreground">
          <RefreshCw size={18} className="animate-spin text-primary" />
          오늘 훈련 데이터를 불러오는 중입니다.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4" data-testid="dashboard-page">
      <PageHeader
        title="대시보드"
        description={today}
        actions={(
          <>
            <button type="button" className={toolbarButtonClass()} onClick={() => router.push('/records')}>
              <Medal size={16} />
              기록 측정
            </button>
            <Button size="sm" className="h-10" leftIcon={<Calendar size={16} />} onClick={() => router.push('/assignments')}>
              반 배치 관리
            </Button>
          </>
        )}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="오늘 요약">
        <StatTile icon={Users} tone="primary" label="출근 강사" value={`${stats.trainersPresent}명`} note={`배정 ${stats.totalTrainers}명`} />
        <StatTile icon={Activity} tone="primary" label="수업 학생" value={`${stats.studentsToday}명`} note="오늘 전체 시간대" />
        <StatTile
          icon={ListChecks}
          tone={currentAttendance && currentAttendance.stats.notCheckedIn > 0 ? 'warning' : 'neutral'}
          className="col-span-2 lg:col-span-1"
          label="출결 준비"
          value={currentAttendance ? `${currentAttendance.stats.checkedIn}/${currentAttendance.stats.scheduled}` : '0/0'}
          note={currentAttendance
            ? `${currentAttendance.currentSlotLabel} 기준${currentAttendance.stats.notCheckedIn > 0 ? ` · 미출근 ${currentAttendance.stats.notCheckedIn}명` : ''}`
            : '현재 시간대 없음'}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div data-testid="dashboard-schedule">
          <SectionCard
            className="h-full"
            title="오늘 스케줄"
            description="시간대별 배정과 학생 수예요."
            actions={<MoreLink label="전체 보기" onClick={() => router.push('/assignments')} />}
          >
            {scheduleData.length === 0 ? (
              <EmptyState
                icon={Clock3}
                title="오늘 배정된 수업이 없습니다."
                description="반 배치에서 시간대별 학생과 강사를 먼저 배정하세요."
                action={<Button variant="outline" size="sm" onClick={() => router.push('/assignments')}>반 배치 열기</Button>}
              />
            ) : (
              <div className="divide-y divide-border/60">
                {scheduleData.map((schedule) => (
                  <ListRow
                    key={schedule.slot}
                    icon={schedule.icon}
                    title={schedule.label}
                    detail={schedule.trainer}
                    onClick={() => router.push('/assignments')}
                    trailing={(
                      <>
                        <span className="block text-[15px] font-bold tabular-nums text-foreground">{schedule.students}명</span>
                        <span className="block text-xs text-muted-foreground">{schedule.time}</span>
                      </>
                    )}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div data-testid="dashboard-attendance">
          <SectionCard
            className="h-full"
            title="강사 현황"
            description={currentAttendance ? `${currentAttendance.currentSlotLabel} 기준` : '현재 시간대 기준'}
            actions={<MoreLink label="출근 관리" onClick={() => router.push('/attendance')} />}
          >
            {!currentAttendance || currentAttendance.instructors.length === 0 ? (
              <EmptyState icon={Clock3} title="현재 시간대에 배정된 강사가 없습니다." description="근무 배정 또는 출근 체크를 확인하세요." />
            ) : (
              <div className="divide-y divide-border/60">
                {currentAttendance.instructors.map((instructor) => (
                  <InstructorRow key={instructor.id} instructor={instructor} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </section>
    </div>
  );
}

function MoreLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
      {label}
      <ChevronRight size={16} />
    </button>
  );
}

function InstructorRow({ instructor }: { instructor: CurrentInstructor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          instructor.checkedIn
            ? 'bg-success-soft text-success'
            : 'bg-muted text-muted-foreground'
        }`}>
          {instructor.checkedIn ? <CheckCircle2 size={18} /> : instructor.name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-foreground">{instructor.name}</span>
          <span className={`mt-0.5 block text-[13px] ${instructor.checkedIn ? 'text-success' : 'text-muted-foreground'}`}>{instructor.checkedIn ? '출근 완료' : '미출근'}</span>
        </span>
      </div>
      {instructor.checkedIn && instructor.checkInTime ? (
        <span className="text-sm font-semibold tabular-nums text-secondary-foreground">{instructor.checkInTime.slice(0, 5)}</span>
      ) : null}
    </div>
  );
}
