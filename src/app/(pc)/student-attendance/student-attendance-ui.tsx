import type { ComponentType } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { StatTile, type Tone } from '@/components/ui/page';
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
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'red' | 'amber' | 'slate';
}) {
  const toneMap: Record<typeof tone, Tone> = { green: 'success', red: 'danger', amber: 'warning', slate: 'neutral' };
  return <StatTile icon={Icon} tone={toneMap[tone]} label={label} value={value} note={detail} />;
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
        <span className="mt-0.5 block text-xs text-muted-foreground">{info.time}</span>
      </span>
      <span className="text-sm font-bold tabular-nums text-foreground">
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
      className={`grid gap-3 py-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${noLink ? 'opacity-60' : ''}`}
      data-testid={`student-row-${student.assignment_id}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          student.attendance_status === 'present'
            ? 'bg-success-soft text-success'
            : 'bg-muted text-muted-foreground'
        }`}>
          {student.attendance_status === 'present' ? <CheckCircle2 size={19} /> : student.student_name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">{student.student_name}</span>
            {student.is_trial === 1 ? <Badge label="체험" tone="amber" /> : null}
            {student.class_id ? <Badge label={`${student.class_id}반`} tone="slate" /> : null}
            {status ? <Badge label={status.label} tone={student.attendance_status || 'slate'} /> : <Badge label="미체크" tone="slate" />}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
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
      aria-pressed={active}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed ${
        active
          ? config.className
          : 'border-transparent bg-muted text-muted-foreground hover:bg-border hover:text-foreground disabled:opacity-60'
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

  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>;
}
