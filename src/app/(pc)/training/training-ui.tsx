import Link from 'next/link';
import {
  AlertCircle,
  Check,
  ClipboardList,
  Droplets,
  ExternalLink,
  Frown,
  Meh,
  Plus,
  Smile,
  Thermometer,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import {
  ExistingLog,
  Exercise,
  ExtraExercise,
  getExerciseId,
  getExerciseName,
  isConditionChecked,
  Plan,
  PlanExercise,
  SLOT_LABELS,
  Student,
  TimeSlot,
} from './training-model';

const CONDITION_OPTIONS = [
  { score: 1, icon: Frown, label: '매우 나쁨', className: 'border-destructive/30 bg-destructive-soft text-destructive' },
  { score: 2, icon: Frown, label: '나쁨', className: 'border-primary/30 bg-primary-soft text-primary' },
  { score: 3, icon: Meh, label: '보통', className: 'border-warning/30 bg-warning-soft text-warning' },
  { score: 4, icon: Smile, label: '좋음', className: 'border-success/30 bg-success-soft text-success' },
  { score: 5, icon: ThumbsUp, label: '최상', className: 'border-primary/30 bg-primary-soft text-primary' },
];

export function EmptyState({ message, subMessage }: { message: string; subMessage?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
      <p className="mt-3 text-sm font-bold text-secondary-foreground">{message}</p>
      {subMessage && <p className="mt-1 text-sm text-muted-foreground">{subMessage}</p>}
    </div>
  );
}

export function SlotTabs({
  activeSlot,
  availableSlots,
  onSelect,
}: {
  activeSlot: string;
  availableSlots: TimeSlot[];
  onSelect: (slot: TimeSlot) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {availableSlots.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onSelect(slot)}
          className={`h-12 rounded-lg border px-4 text-left text-sm font-black transition ${
            activeSlot === slot
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-card text-secondary-foreground hover:bg-muted'
          }`}
        >
          {SLOT_LABELS[slot]}
        </button>
      ))}
    </div>
  );
}

export function ChecklistPanel({
  currentPlan,
  exercises,
  humidity,
  newExerciseName,
  newExerciseNote,
  onAddExtraExercise,
  onCloseAddExercise,
  onHumidityChange,
  onSaveConditions,
  onShowAddExercise,
  onTemperatureChange,
  onToggleConditions,
  onToggleExercise,
  onToggleExtraExercise,
  setNewExerciseName,
  setNewExerciseNote,
  showAddExercise,
  temperature,
}: {
  currentPlan: Plan | undefined;
  exercises: Exercise[];
  humidity: string;
  newExerciseName: string;
  newExerciseNote: string;
  onAddExtraExercise: () => void;
  onCloseAddExercise: () => void;
  onHumidityChange: (value: string) => void;
  onSaveConditions: () => void;
  onShowAddExercise: () => void;
  onTemperatureChange: (value: string) => void;
  onToggleConditions: (checked: boolean) => void;
  onToggleExercise: (exerciseId: number) => void;
  onToggleExtraExercise: (index: number) => void;
  setNewExerciseName: (value: string) => void;
  setNewExerciseNote: (value: string) => void;
  showAddExercise: boolean;
  temperature: string;
}) {
  if (!currentPlan) {
    return (
      <EmptyState
        message="수업 계획이 없습니다."
        subMessage="수업 계획을 작성하면 체크리스트가 표시됩니다."
      />
    );
  }

  return (
    <section className="rounded-2xl bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-success">CHECKLIST</p>
          <h2 className="mt-1 text-xl font-black text-foreground">{currentPlan.instructor_name} 체크리스트</h2>
        </div>
        <span className="rounded-lg bg-muted px-3 py-1 text-sm font-bold text-secondary-foreground">
          {currentPlan.exercises.length + currentPlan.extra_exercises.length}개
        </span>
      </div>

      <div className="divide-y divide-border">
        <ConditionRow
          checked={isConditionChecked(currentPlan)}
          checkedAt={currentPlan.conditions_checked_at}
          humidity={humidity}
          onHumidityChange={onHumidityChange}
          onSaveConditions={onSaveConditions}
          onTemperatureChange={onTemperatureChange}
          onToggle={() => onToggleConditions(!isConditionChecked(currentPlan))}
          temperature={temperature}
        />
        {currentPlan.exercises.map((exercise, index) => (
          <ExerciseRow
            key={`${getExerciseId(exercise)}-${index}`}
            completed={Boolean(getExerciseId(exercise) && currentPlan.completed_exercises.includes(getExerciseId(exercise) || 0))}
            completedAt={getExerciseId(exercise) ? currentPlan.exercise_times?.[getExerciseId(exercise) || 0] : undefined}
            exercise={exercise}
            exercises={exercises}
            onToggle={() => {
              const exerciseId = getExerciseId(exercise);
              if (exerciseId) onToggleExercise(exerciseId);
            }}
          />
        ))}
        {currentPlan.extra_exercises.map((exercise, index) => (
          <ExtraExerciseRow
            key={`${exercise.name}-${index}`}
            exercise={exercise}
            onToggle={() => onToggleExtraExercise(index)}
          />
        ))}
        <AddExtraExerciseRow
          name={newExerciseName}
          note={newExerciseNote}
          onAdd={onAddExtraExercise}
          onClose={onCloseAddExercise}
          onNameChange={setNewExerciseName}
          onNoteChange={setNewExerciseNote}
          onShow={onShowAddExercise}
          show={showAddExercise}
        />
      </div>
    </section>
  );
}

function ConditionRow({
  checked,
  checkedAt,
  humidity,
  onHumidityChange,
  onSaveConditions,
  onTemperatureChange,
  onToggle,
  temperature,
}: {
  checked: boolean;
  checkedAt: string | null;
  humidity: string;
  onHumidityChange: (value: string) => void;
  onSaveConditions: () => void;
  onTemperatureChange: (value: string) => void;
  onToggle: () => void;
  temperature: string;
}) {
  return (
    <div className={checked ? 'bg-success-soft p-4' : 'p-4'}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <CheckCircle checked={checked} />
        <span className="flex-1 font-bold text-foreground">체육관 환경 체크</span>
        {checked && checkedAt && <span className="text-xs font-bold text-success">{formatTime(checkedAt)}</span>}
      </button>
      <div className="mt-3 grid gap-2 pl-9 sm:grid-cols-2" onClick={(event) => event.stopPropagation()}>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
          <Thermometer className="size-4 text-primary" />
          <input type="number" step="0.1" value={temperature} onChange={(event) => onTemperatureChange(event.target.value)} onBlur={onSaveConditions} className="w-full bg-transparent outline-none" placeholder="온도" />
          <span className="text-muted-foreground">°C</span>
        </label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
          <Droplets className="size-4 text-primary" />
          <input type="number" value={humidity} onChange={(event) => onHumidityChange(event.target.value)} onBlur={onSaveConditions} className="w-full bg-transparent outline-none" placeholder="습도" />
          <span className="text-muted-foreground">%</span>
        </label>
      </div>
    </div>
  );
}

function ExerciseRow({
  completed,
  completedAt,
  exercise,
  exercises,
  onToggle,
}: {
  completed: boolean;
  completedAt?: string;
  exercise: PlanExercise;
  exercises: Exercise[];
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted ${completed ? 'bg-success-soft' : ''}`}>
      <CheckCircle checked={completed} />
      <span className="min-w-0 flex-1">
        <span className={`font-bold ${completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{getExerciseName(exercise, exercises)}</span>
        {(exercise.weight || exercise.reps) && (
          <span className="ml-2 font-black text-success">
            {exercise.weight}
            {exercise.weight && exercise.reps ? ' x ' : ''}
            {exercise.reps ? `${exercise.reps}회` : ''}
          </span>
        )}
        {exercise.note && <span className="ml-2 text-sm text-muted-foreground">{exercise.note}</span>}
      </span>
      {completedAt && <span className="text-xs font-bold text-success">{formatTime(completedAt)}</span>}
    </button>
  );
}

function ExtraExerciseRow({ exercise, onToggle }: { exercise: ExtraExercise; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-primary-soft ${exercise.completed ? 'bg-primary-soft' : ''}`}>
      <CheckCircle checked={exercise.completed} tone="blue" />
      <span className="flex-1">
        <span className={`font-bold ${exercise.completed ? 'text-muted-foreground line-through' : 'text-primary'}`}>{exercise.name}</span>
        {exercise.note && <span className="ml-2 text-sm text-muted-foreground">{exercise.note}</span>}
        <span className="ml-2 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">추가</span>
      </span>
    </button>
  );
}

function AddExtraExerciseRow({
  name,
  note,
  onAdd,
  onClose,
  onNameChange,
  onNoteChange,
  onShow,
  show,
}: {
  name: string;
  note: string;
  onAdd: () => void;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onShow: () => void;
  show: boolean;
}) {
  if (!show) {
    return (
      <div className="p-4">
        <button type="button" onClick={onShow} className="flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-4 text-sm font-bold text-primary">
          <Plus className="size-4" />
          운동 추가
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex gap-2">
        <input value={name} onChange={(event) => onNameChange(event.target.value)} className="h-10 flex-1 rounded-lg border border-border px-3 text-sm outline-none focus:border-foreground" placeholder="운동 이름" autoFocus />
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
      </div>
      <div className="flex gap-2">
        <input value={note} onChange={(event) => onNoteChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onAdd()} className="h-10 flex-1 rounded-lg border border-border px-3 text-sm outline-none focus:border-foreground" placeholder="메모" />
        <button type="button" onClick={onAdd} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white">추가</button>
      </div>
    </div>
  );
}

export function StudentConditionPanel({
  logs,
  onSaveCondition,
  onSaveNotes,
  students,
}: {
  logs: ExistingLog[];
  onSaveCondition: (studentId: number, score: number | null) => void;
  onSaveNotes: (studentId: number, notes: string) => void;
  students: Student[];
}) {
  return (
    <section className="rounded-2xl bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-xl font-black text-foreground">
          <User className="size-5" />
          학생 컨디션
        </h2>
        <span className="rounded-lg bg-muted px-3 py-1 text-sm font-bold text-secondary-foreground">{students.length}명</span>
      </div>
      <div className="divide-y divide-border">
        {students.map((student) => (
          <StudentConditionRow
            key={student.id}
            log={logs.find((item) => item.student_id === student.student_id)}
            onSaveCondition={onSaveCondition}
            onSaveNotes={onSaveNotes}
            student={student}
          />
        ))}
      </div>
    </section>
  );
}

function StudentConditionRow({
  log,
  onSaveCondition,
  onSaveNotes,
  student,
}: {
  log?: ExistingLog;
  onSaveCondition: (studentId: number, score: number | null) => void;
  onSaveNotes: (studentId: number, notes: string) => void;
  student: Student;
}) {
  const isAbsent = student.attendance_status === 'absent';

  return (
    <div className={`p-4 ${isAbsent ? 'bg-destructive-soft/70' : ''}`}>
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex size-9 items-center justify-center rounded-lg ${student.gender === 'M' ? 'bg-primary-soft text-primary' : 'bg-pink-100 text-pink-700'}`}>
          <User className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-black ${isAbsent ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{student.student_name}</span>
            {isAbsent && <span className="rounded-md bg-destructive-soft px-2 py-0.5 text-xs font-bold text-destructive">결석</span>}
            <Link href={`/students/${student.student_id}`} className="rounded-md p-1 text-primary hover:bg-primary-soft" title="학생 보기">
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
          {isAbsent && <p className="mt-1 text-sm text-muted-foreground">{student.absence_reason || '결석한 학생입니다.'}</p>}
        </div>
        {!isAbsent && log?.condition_score && <span className="rounded-lg bg-success-soft px-2 py-1 text-xs font-bold text-success">저장됨</span>}
      </div>

      {!isAbsent && (
        <>
          <div className="grid gap-2 sm:grid-cols-5">
            {CONDITION_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = log?.condition_score === option.score;
              return (
                <button
                  key={option.score}
                  type="button"
                  onClick={() => onSaveCondition(student.student_id, selected ? null : option.score)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-bold transition ${
                    selected ? option.className : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="size-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
          <input
            defaultValue={log?.notes || ''}
            onBlur={(event) => onSaveNotes(student.student_id, event.target.value)}
            className="mt-3 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-foreground"
            placeholder="메모"
          />
        </>
      )}
    </div>
  );
}

function CheckCircle({ checked, tone = 'emerald' }: { checked: boolean; tone?: 'emerald' | 'blue' }) {
  const active = tone === 'blue' ? 'border-primary bg-primary' : 'border-success bg-success';
  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${checked ? active : 'border-border bg-card'}`}>
      {checked && <Check className="size-3.5 text-white" />}
    </span>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
