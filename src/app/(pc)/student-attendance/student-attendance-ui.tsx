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
    green: 'bg-success-soft text-success border-success/30',
    red: 'bg-destructive-soft text-destructive border-destructive/30',
    amber: 'bg-warning-soft text-warning border-warning/30',
    slate: 'bg-muted text-secondary-foreground border-border',
  }[tone];

  return (
    <article className="rounded-2xl bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-normal text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
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
      className={`grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        active
          ? 'border-primary bg-primary-soft text-foreground shadow-sm ring-1 ring-primary/30'
          : 'border-transparent text-secondary-foreground hover:border-border hover:bg-muted'
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-card text-primary shadow-sm">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{info.label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{info.time}</span>
      </span>
      <span className="rounded-md border border-border bg-card px-2 py-1 text-sm font-semibold text-foreground">
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
            ? 'bg-success-soft text-success'
            : 'bg-muted text-muted-foreground'
        }`}>
          {student.attendance_status === 'present' ? <CheckCircle2 size={19} /> : student.student_name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{student.student_name}</span>
            {student.is_trial === 1 ? <Badge label="체험" tone="amber" /> : null}
            {student.class_id ? <Badge label={`${student.class_id}반`} tone="slate" /> : null}
            {status ? <Badge label={status.label} tone={student.attendance_status || 'slate'} /> : <Badge label="미체크" tone="slate" />}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {student.grade || '학년 미입력'}{student.school ? ` · ${student.school}` : ''}
          </span>
        </span>
      </div>

      {noLink ? (
        <span className="text-sm text-muted-foreground">동기화 필요</span>
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
      <AlertCircle size={30} className="text-muted-foreground/60" />
      <p className="mt-3 font-medium text-secondary-foreground">
        {TIME_SLOT_INFO[slot].label}에 배정된 학생이 없습니다.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">반 배치에서 학생 배정과 출석 동기화를 확인하세요.</p>
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
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? config.className
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      }`}
    >
      {disabled && !active ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} />}
      {config.label}
    </button>
  );
}

function Badge({ label, tone }: { label: string; tone: AttendanceStatus | 'amber' | 'slate' }) {
  const className = {
    present: 'bg-success-soft text-success',
    absent: 'bg-destructive-soft text-destructive',
    late: 'bg-warning-soft text-warning',
    excused: 'bg-primary-soft text-primary',
    amber: 'bg-warning-soft text-warning',
    slate: 'bg-muted text-secondary-foreground',
  }[tone];

  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${className}`}>{label}</span>;
}
