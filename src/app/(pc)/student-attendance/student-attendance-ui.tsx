import type { ComponentType } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  TIME_SLOT_INFO,
  type AttendanceStatus,
  type Student,
  type TimeSlot,
} from './student-attendance-model';

export function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'red' | 'amber' | 'slate';
}) {
  const toneClass = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
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

export function SlotButton({
  slot,
  active,
  count,
  present,
  onClick,
}: {
  slot: TimeSlot;
  active: boolean;
  count: number;
  present: number;
  onClick: () => void;
}) {
  const info = TIME_SLOT_INFO[slot];
  const Icon = info.icon;

  return (
    <button
      onClick={onClick}
      className={`grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
        active
          ? 'border-orange-400 bg-orange-50 text-slate-950 shadow-sm ring-1 ring-orange-100 dark:border-orange-800 dark:bg-orange-950/30 dark:text-slate-50 dark:ring-orange-900/40'
          : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-800'
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-orange-600 shadow-sm dark:bg-slate-900 dark:text-orange-300">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{info.label}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{info.time}</span>
      </span>
      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        {present}/{count}
      </span>
    </button>
  );
}

export function StudentRow({
  student,
  updating,
  onSetStatus,
}: {
  student: Student;
  updating: boolean;
  onSetStatus: (student: Student, status: AttendanceStatus) => void;
}) {
  const noLink = !student.paca_attendance_id;
  const status = student.attendance_status ? STATUS_CONFIG[student.attendance_status] : null;

  return (
    <div
      className={`grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${noLink ? 'opacity-60' : ''}`}
      data-testid={`student-row-${student.assignment_id}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${
          student.attendance_status === 'present'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {student.attendance_status === 'present' ? <CheckCircle2 size={19} /> : student.student_name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-950 dark:text-slate-50">{student.student_name}</span>
            {student.is_trial === 1 ? <Badge label="체험" tone="amber" /> : null}
            {student.class_id ? <Badge label={`${student.class_id}반`} tone="slate" /> : null}
            {status ? <Badge label={status.label} tone={student.attendance_status || 'slate'} /> : <Badge label="미체크" tone="slate" />}
          </span>
          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
            {student.grade || '학년 미입력'}{student.school ? ` · ${student.school}` : ''}
          </span>
        </span>
      </div>

      {noLink ? (
        <span className="text-sm text-slate-500 dark:text-slate-400">동기화 필요</span>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center">
          {STATUS_ORDER.map((statusKey) => (
            <StatusButton
              key={statusKey}
              status={statusKey}
              active={student.attendance_status === statusKey}
              disabled={updating}
              onClick={() => onSetStatus(student, statusKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ slot }: { slot: TimeSlot }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
      <AlertCircle size={30} className="text-slate-300 dark:text-slate-600" />
      <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">
        {TIME_SLOT_INFO[slot].label}에 배정된 학생이 없습니다.
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">반 배치에서 학생 배정과 출석 동기화를 확인하세요.</p>
    </div>
  );
}

function StatusButton({
  status,
  active,
  disabled,
  onClick,
}: {
  status: AttendanceStatus;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={disabled || active}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900 ${
        active
          ? config.className
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {disabled && !active ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} />}
      {config.label}
    </button>
  );
}

function Badge({ label, tone }: { label: string; tone: AttendanceStatus | 'amber' | 'slate' }) {
  const className = {
    present: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    absent: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    late: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    excused: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[tone];

  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${className}`}>{label}</span>;
}
