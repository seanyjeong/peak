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
      <div className="h-10 w-80 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

export function AnalyticsErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-8">
      <div className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800/50 dark:bg-amber-950/20">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">리포트를 열 수 없습니다</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
        <button
          onClick={onBack}
          className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
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
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${toneClass}`}>{icon}</div>
      <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 flex items-end gap-1">
        <span className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</span>
        <span className="pb-1 text-sm text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

export function EventAverageTable({ events }: { events: EventAverage[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <Activity className="mt-0.5 h-5 w-5 text-blue-600" />
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">종목별 최신 평균</h2>
          <p className="mt-1 text-sm text-slate-500">학생별 가장 최근 기록 1개만 반영합니다.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70">
              <th className="px-5 py-3 text-left font-semibold">종목</th>
              <th className="px-3 py-3 text-center font-semibold">단위</th>
              <th className="px-3 py-3 text-right font-semibold text-blue-700">남자 평균</th>
              <th className="px-3 py-3 text-right font-semibold text-orange-700">여자 평균</th>
              <th className="px-3 py-3 text-right font-semibold">전체 평균</th>
              <th className="px-3 py-3 text-right font-semibold">인원</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((event) => (
              <tr key={event.recordTypeId} className="text-slate-700 dark:text-slate-200">
                <td className="px-5 py-3 font-semibold">{event.recordTypeName}</td>
                <td className="px-3 py-3 text-center text-slate-500">{event.unit}</td>
                <td className="px-3 py-3 text-right font-semibold text-blue-700">{formatMetric(event.maleAvg)}</td>
                <td className="px-3 py-3 text-right font-semibold text-orange-700">{formatMetric(event.femaleAvg)}</td>
                <td className="px-3 py-3 text-right">{formatMetric(event.totalAvg)}</td>
                <td className="px-3 py-3 text-right text-slate-500">{event.maleCount + event.femaleCount}명</td>
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
                ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
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
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <Trophy className="h-5 w-5 text-orange-600" />
      <span className="text-base font-bold text-slate-950 dark:text-white">{trend.recordTypeName}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone.badge}`}>평균 {trendLabel(trend.avgTrend)}</span>
      <div className="ml-auto flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">상승 {trend.improving.length}명</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">유지 {trend.maintaining.length}명</span>
        <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">하락 {trend.declining.length}명</span>
      </div>
    </div>
  );
}

export function RankingTable({ data, title, tone, unit }: { data: RankStudent[]; title: string; tone: 'blue' | 'orange'; unit: string }) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700';

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className={`flex items-center gap-2 px-4 py-3 ${toneClass}`}>
        <Trophy className="h-4 w-4" />
        <span className="text-sm font-bold">{title}</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">최근 기록이 없습니다</p>
        ) : data.map((student) => (
          <div key={student.studentId} className="grid grid-cols-[48px_1fr_auto] items-center gap-2 px-4 py-3 text-sm">
            <span className="font-mono font-bold text-slate-400">{student.rank}</span>
            <span className="truncate font-semibold text-slate-800 dark:text-slate-200">{student.studentName}</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{student.value} {unit}</span>
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
    <div className={`overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-slate-950 ${tone.border}`}>
      <button onClick={onToggle} className={`flex w-full items-center gap-3 px-5 py-3 text-left ${tone.surface}`}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className="h-4 w-4" />
        <span className="font-bold">{trendLabel(type)}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{students.length}명</span>
        <span className="text-xs opacity-70">남 {males.length} / 여 {females.length}</span>
      </button>
      {open && (
        <div className="grid md:grid-cols-2 md:divide-x md:divide-slate-100 dark:md:divide-slate-800">
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
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 text-amber-600" />
        <div>
          <h2 className="font-bold text-amber-900 dark:text-amber-100">트렌드 제외 학생</h2>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">종목별 기록이 5개 미만이면 변화 추세에서 제외합니다.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {students.slice(0, 20).map((student) => (
          <div key={student.studentId} className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
            <span className="font-bold">{student.studentName}</span>
            <span className="ml-2 text-slate-500">
              {student.events.map((event) => `${event.recordTypeName} ${event.recordCount}개`).join(', ')}
            </span>
          </div>
        ))}
      </div>
      {students.length > 20 && <p className="mt-3 text-xs font-semibold text-amber-700">외 {students.length - 20}명</p>}
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
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        {label} {students.length}명
      </div>
      {students.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">해당 학생이 없습니다</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {students.map((student) => (
            <div key={student.studentId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm">
              <span className="truncate font-semibold text-slate-800 dark:text-slate-200">{student.studentName}</span>
              {type === 'maintaining' ? null : (
                <span className="text-xs font-semibold text-slate-500">{slopeToText(student.slope, unit, direction)}</span>
              )}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{student.latestValue} {unit}</span>
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
      badge: 'bg-emerald-50 text-emerald-700',
      border: 'border-emerald-200 dark:border-emerald-900/60',
      surface: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200',
    };
  }
  if (type === 'declining') {
    return {
      badge: 'bg-rose-50 text-rose-700',
      border: 'border-rose-200 dark:border-rose-900/60',
      surface: 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200',
    };
  }
  return {
    badge: 'bg-slate-100 text-slate-700',
    border: 'border-slate-200 dark:border-slate-800',
    surface: 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200',
  };
}
