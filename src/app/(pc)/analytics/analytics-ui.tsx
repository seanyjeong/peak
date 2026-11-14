import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Minus,
  Trophy,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { EventAverage, EventTrend, RankStudent, TrendStudent, TrendType } from './analytics-model';
import { formatMetric, slopeToText, sortTrendStudents, trendLabel } from './analytics-model';

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-5 px-6 py-6 lg:px-8">
      <div className="h-10 w-80 animate-pulse rounded-lg bg-border" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-lg bg-border" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-border" />
    </div>
  );
}

export function AnalyticsErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-8">
      <div className="w-full max-w-md rounded-lg border border-warning/30 bg-warning-soft p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-4 text-lg font-bold text-foreground">리포트를 열 수 없습니다</h1>
        <p className="mt-2 text-sm leading-6 text-secondary-foreground">{message}</p>
        <button
          onClick={onBack}
          className="mt-5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/90"
        >
          대시보드로 이동
        </button>
      </div>
    </div>
  );
}

export function KPICard({
  icon,
  label,
  tone = 'slate',
  unit,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone?: 'blue' | 'green' | 'orange' | 'slate';
  unit: string;
  value: string;
}) {
  const toneClass = {
    blue: 'bg-primary-soft text-primary border-primary/30',
    green: 'bg-success-soft text-success border-success/30',
    orange: 'bg-primary-soft text-primary border-primary/30',
    slate: 'bg-muted text-secondary-foreground border-border',
  }[tone];

  return (
    <div className="rounded-2xl bg-card p-5">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${toneClass}`}>{icon}</div>
      <p className="mt-4 text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end gap-1">
        <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
        <span className="pb-1 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

export function EventAverageTable({ events }: { events: EventAverage[] }) {
  return (
    <section className="rounded-2xl bg-card">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <Activity className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="text-base font-bold text-foreground">종목별 최신 평균</h2>
          <p className="mt-1 text-sm text-muted-foreground">학생별 가장 최근 기록 1개만 반영합니다.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-muted-foreground">
              <th className="px-5 py-3 text-left font-semibold">종목</th>
              <th className="px-3 py-3 text-center font-semibold">단위</th>
              <th className="px-3 py-3 text-right font-semibold text-primary">남자 평균</th>
              <th className="px-3 py-3 text-right font-semibold text-pink-600 dark:text-pink-400">여자 평균</th>
              <th className="px-3 py-3 text-right font-semibold">전체 평균</th>
              <th className="px-3 py-3 text-right font-semibold">인원</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((event) => (
              <tr key={event.recordTypeId} className="text-secondary-foreground">
                <td className="px-5 py-3 font-semibold">{event.recordTypeName}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{event.unit}</td>
                <td className="px-3 py-3 text-right font-semibold text-primary">{formatMetric(event.maleAvg)}</td>
                <td className="px-3 py-3 text-right font-semibold text-pink-600 dark:text-pink-400">{formatMetric(event.femaleAvg)}</td>
                <td className="px-3 py-3 text-right">{formatMetric(event.totalAvg)}</td>
                <td className="px-3 py-3 text-right text-muted-foreground">{event.maleCount + event.femaleCount}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EventTabs({
  events,
  selectedEvent,
  onSelect,
}: {
  events: EventAverage[];
  selectedEvent: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {events.map((event) => {
        const selected = selectedEvent === event.recordTypeId;
        return (
          <button
            key={event.recordTypeId}
            onClick={() => onSelect(event.recordTypeId)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              selected
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-secondary-foreground hover:bg-muted'
            }`}
          >
            {event.shortName || event.recordTypeName}
          </button>
        );
      })}
    </div>
  );
}

export function EventSummaryBar({ trend }: { trend: EventTrend }) {
  const tone = getTrendTone(trend.avgTrend);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card px-5 py-4">
      <Trophy className="h-5 w-5 text-primary" />
      <span className="text-base font-bold text-foreground">{trend.recordTypeName}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone.badge}`}>평균 {trendLabel(trend.avgTrend)}</span>
      <div className="ml-auto flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-success-soft px-3 py-1 font-semibold text-success">상승 {trend.improving.length}명</span>
        <span className="rounded-full bg-muted px-3 py-1 font-semibold text-secondary-foreground">유지 {trend.maintaining.length}명</span>
        <span className="rounded-full bg-destructive-soft px-3 py-1 font-semibold text-destructive">하락 {trend.declining.length}명</span>
      </div>
    </div>
  );
}

export function RankingTable({ data, title, tone, unit }: { data: RankStudent[]; title: string; tone: 'blue' | 'orange'; unit: string }) {
  const toneClass = tone === 'blue' ? 'bg-primary-soft text-primary' : 'bg-pink-500/15 text-pink-600';

  return (
    <div className="overflow-hidden rounded-2xl bg-card">
      <div className={`flex items-center gap-2 px-4 py-3 ${toneClass}`}>
        <Trophy className="h-4 w-4" />
        <span className="text-sm font-bold">{title}</span>
      </div>
      <div className="divide-y divide-border">
        {data.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">최근 기록이 없습니다</p>
        ) : data.map((student) => (
          <div key={student.studentId} className="grid grid-cols-[48px_1fr_auto] items-center gap-2 px-4 py-3 text-sm">
            <span className="font-mono font-bold text-muted-foreground">{student.rank}</span>
            <span className="truncate font-semibold text-foreground">{student.studentName}</span>
            <span className="font-mono font-semibold text-secondary-foreground">{student.value} {unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendGroup({
  direction,
  onToggle,
  open,
  students,
  type,
  unit,
}: {
  direction: string;
  onToggle: () => void;
  open: boolean;
  students: TrendStudent[];
  type: TrendType;
  unit: string;
}) {
  const tone = getTrendTone(type);
  const sorted = sortTrendStudents(students, type, direction);
  const males = sorted.filter((student) => student.gender === 'M');
  const females = sorted.filter((student) => student.gender === 'F');
  const Icon = type === 'improving' ? TrendingUp : type === 'declining' ? TrendingDown : Minus;

  return (
    <div className={`overflow-hidden rounded-lg border bg-card shadow-sm ${tone.border}`}>
      <button onClick={onToggle} className={`flex w-full items-center gap-3 px-5 py-3 text-left ${tone.surface}`}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className="h-4 w-4" />
        <span className="font-bold">{trendLabel(type)}</span>
        <span className="rounded-full bg-card/70 px-2 py-0.5 text-xs font-bold">{students.length}명</span>
        <span className="text-xs opacity-70">남 {males.length} / 여 {females.length}</span>
      </button>
      {open && (
        <div className="grid md:grid-cols-2 md:divide-x md:divide-border">
          <TrendColumn direction={direction} label="남자" students={males} type={type} unit={unit} />
          <TrendColumn direction={direction} label="여자" students={females} type={type} unit={unit} />
        </div>
      )}
    </div>
  );
}

export function InsufficientDataPanel({
  students,
}: {
  students: { studentId: number; studentName: string; events: { recordTypeName: string; recordCount: number }[] }[];
}) {
  if (students.length === 0) return null;

  return (
    <section className="rounded-lg border border-warning/30 bg-warning-soft p-5">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 text-warning" />
        <div>
          <h2 className="font-bold text-warning">트렌드 제외 학생</h2>
          <p className="mt-1 text-sm text-warning/80">종목별 기록이 5개 미만이면 변화 추세에서 제외합니다.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {students.slice(0, 20).map((student) => (
          <div key={student.studentId} className="rounded-lg bg-card/70 px-3 py-2 text-sm text-secondary-foreground">
            <span className="font-bold">{student.studentName}</span>
            <span className="ml-2 text-muted-foreground">
              {student.events.map((event) => `${event.recordTypeName} ${event.recordCount}개`).join(', ')}
            </span>
          </div>
        ))}
      </div>
      {students.length > 20 && <p className="mt-3 text-xs font-semibold text-warning">외 {students.length - 20}명</p>}
    </section>
  );
}

function TrendColumn({
  direction,
  label,
  students,
  type,
  unit,
}: {
  direction: string;
  label: string;
  students: TrendStudent[];
  type: TrendType;
  unit: string;
}) {
  return (
    <div>
      <div className="border-b border-border bg-muted px-4 py-2 text-xs font-bold text-muted-foreground">
        {label} {students.length}명
      </div>
      {students.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">해당 학생이 없습니다</p>
      ) : (
        <div className="divide-y divide-border">
          {students.map((student) => (
            <div key={student.studentId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm">
              <span className="truncate font-semibold text-foreground">{student.studentName}</span>
              {type === 'maintaining' ? null : (
                <span className="text-xs font-semibold text-muted-foreground">{slopeToText(student.slope, unit, direction)}</span>
              )}
              <span className="font-mono font-semibold text-secondary-foreground">{student.latestValue} {unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getTrendTone(type: TrendType) {
  if (type === 'improving') {
    return {
      badge: 'bg-success-soft text-success',
      border: 'border-success/30',
      surface: 'bg-success-soft text-success',
    };
  }
  if (type === 'declining') {
    return {
      badge: 'bg-destructive-soft text-destructive',
      border: 'border-destructive/30',
      surface: 'bg-destructive-soft text-destructive',
    };
  }
  return {
    badge: 'bg-muted text-secondary-foreground',
    border: 'border-border',
    surface: 'bg-muted text-secondary-foreground',
  };
}
