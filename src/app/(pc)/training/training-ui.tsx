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
  { score: 1, icon: Frown, label: '매우 나쁨', className: 'border-red-200 bg-red-50 text-red-600' },
  { score: 2, icon: Frown, label: '나쁨', className: 'border-orange-200 bg-orange-50 text-orange-600' },
  { score: 3, icon: Meh, label: '보통', className: 'border-amber-200 bg-amber-50 text-amber-600' },
  { score: 4, icon: Smile, label: '좋음', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { score: 5, icon: ThumbsUp, label: '최상', className: 'border-blue-200 bg-blue-50 text-blue-700' },
];

export function EmptyState({ message, subMessage }: { message: string; subMessage?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <AlertCircle className="mx-auto size-10 text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-600">{message}</p>
      {subMessage && <p className="mt-1 text-sm text-slate-500">{subMessage}</p>}
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
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-emerald-700">CHECKLIST</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{currentPlan.instructor_name} 체크리스트</h2>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
          {currentPlan.exercises.length + currentPlan.extra_exercises.length}개
        </span>
      </div>

      <div className="divide-y divide-slate-100">
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
    <div className={checked ? 'bg-emerald-50 p-4' : 'p-4'}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <CheckCircle checked={checked} />
        <span className="flex-1 font-bold text-slate-900">체육관 환경 체크</span>
        {checked && checkedAt && <span className="text-xs font-bold text-emerald-700">{formatTime(checkedAt)}</span>}
      </button>
      <div className="mt-3 grid gap-2 pl-9 sm:grid-cols-2" onClick={(event) => event.stopPropagation()}>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <Thermometer className="size-4 text-orange-500" />
          <input type="number" step="0.1" value={temperature} onChange={(event) => onTemperatureChange(event.target.value)} onBlur={onSaveConditions} className="w-full bg-transparent outline-none" placeholder="온도" />
          <span className="text-slate-500">°C</span>
        </label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <Droplets className="size-4 text-blue-500" />
          <input type="number" value={humidity} onChange={(event) => onHumidityChange(event.target.value)} onBlur={onSaveConditions} className="w-full bg-transparent outline-none" placeholder="습도" />
          <span className="text-slate-500">%</span>
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
    <button type="button" onClick={onToggle} className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 ${completed ? 'bg-emerald-50' : ''}`}>
      <CheckCircle checked={completed} />
      <span className="min-w-0 flex-1">
        <span className={`font-bold ${completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{getExerciseName(exercise, exercises)}</span>
        {(exercise.weight || exercise.reps) && (
          <span className="ml-2 font-black text-emerald-700">
            {exercise.weight}
            {exercise.weight && exercise.reps ? ' x ' : ''}
            {exercise.reps ? `${exercise.reps}회` : ''}
          </span>
        )}
        {exercise.note && <span className="ml-2 text-sm text-slate-500">{exercise.note}</span>}
      </span>
      {completedAt && <span className="text-xs font-bold text-emerald-700">{formatTime(completedAt)}</span>}
    </button>
  );
}

function ExtraExerciseRow({ exercise, onToggle }: { exercise: ExtraExercise; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-blue-50 ${exercise.completed ? 'bg-blue-50' : ''}`}>
      <CheckCircle checked={exercise.completed} tone="blue" />
      <span className="flex-1">
        <span className={`font-bold ${exercise.completed ? 'text-slate-400 line-through' : 'text-blue-700'}`}>{exercise.name}</span>
        {exercise.note && <span className="ml-2 text-sm text-slate-500">{exercise.note}</span>}
        <span className="ml-2 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">추가</span>
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
        <button type="button" onClick={onShow} className="flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700">
          <Plus className="size-4" />
          운동 추가
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex gap-2">
        <input value={name} onChange={(event) => onNameChange(event.target.value)} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900" placeholder="운동 이름" autoFocus />
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
      </div>
      <div className="flex gap-2">
        <input value={note} onChange={(event) => onNoteChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onAdd()} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900" placeholder="메모" />
        <button type="button" onClick={onAdd} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">추가</button>
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
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
          <User className="size-5" />
          학생 컨디션
        </h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">{students.length}명</span>
      </div>
      <div className="divide-y divide-slate-100">
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
    <div className={`p-4 ${isAbsent ? 'bg-red-50/70' : ''}`}>
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex size-9 items-center justify-center rounded-lg ${student.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
          <User className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-black ${isAbsent ? 'text-slate-400 line-through' : 'text-slate-950'}`}>{student.student_name}</span>
            {isAbsent && <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">결석</span>}
            <Link href={`/students/${student.student_id}`} className="rounded-md p-1 text-orange-600 hover:bg-orange-50" title="학생 보기">
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
          {isAbsent && <p className="mt-1 text-sm text-slate-500">{student.absence_reason || '결석한 학생입니다.'}</p>}
        </div>
        {!isAbsent && log?.condition_score && <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">저장됨</span>}
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
                    selected ? option.className : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
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
            className="mt-3 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="메모"
          />
        </>
      )}
    </div>
  );
}

function CheckCircle({ checked, tone = 'emerald' }: { checked: boolean; tone?: 'emerald' | 'blue' }) {
  const active = tone === 'blue' ? 'border-blue-600 bg-blue-600' : 'border-emerald-600 bg-emerald-600';
  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${checked ? active : 'border-slate-300 bg-white'}`}>
      {checked && <Check className="size-3.5 text-white" />}
    </span>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
