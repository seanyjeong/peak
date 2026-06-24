import { ChevronDown, ChevronUp, Dumbbell, Edit2, Moon, Sun, Sunrise, Trash2, Video } from 'lucide-react';
import {
  Exercise,
  ExerciseTag,
  findExerciseName,
  Plan,
  SLOT_LABELS,
  TimeSlot,
} from './plans-model';

const SLOT_ICONS = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
};

const SLOT_STYLES = {
  morning: 'border-orange-200 bg-orange-50 text-orange-700',
  afternoon: 'border-blue-200 bg-blue-50 text-blue-700',
  evening: 'border-violet-200 bg-violet-50 text-violet-700',
};

export function TagBadge({ tagId, tags, small = false }: { tagId: string; tags: ExerciseTag[]; small?: boolean }) {
  const tag = tags.find((item) => item.tag_id === tagId);
  const sizeClass = small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  if (!tag) {
    return (
      <span className={`${sizeClass} rounded-md bg-slate-100 font-semibold text-slate-600`}>
        {tagId}
      </span>
    );
  }

  return <span className={`${sizeClass} rounded-md font-semibold ${tag.color}`}>{tag.label}</span>;
}

export function SlotButton({
  active,
  onClick,
  planned,
  scheduled,
  slot,
}: {
  active: boolean;
  onClick: () => void;
  planned: number;
  scheduled: number;
  slot: TimeSlot;
}) {
  const Icon = SLOT_ICONS[slot];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-20 flex-1 items-center justify-between rounded-lg border px-4 text-left transition ${
        active ? SLOT_STYLES[slot] : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-white/80">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-bold">{SLOT_LABELS[slot]}</span>
          <span className="text-xs text-slate-500">작성 {planned} / 스케줄 {scheduled}</span>
        </span>
      </span>
    </button>
  );
}

export function PlanCard({
  canManage,
  exerciseTags,
  exercises,
  expanded,
  onDelete,
  onEdit,
  onToggle,
  plan,
}: {
  canManage: boolean;
  exerciseTags: ExerciseTag[];
  exercises: Exercise[];
  expanded: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  plan: Plan;
}) {
  const visibleExercises = expanded ? plan.exercises : plan.exercises.slice(0, 4);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
              {plan.instructor_name.charAt(0)}
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-950">{plan.instructor_name}</h3>
              <p className="text-sm text-slate-500">{plan.exercises.length}개 운동</p>
            </div>
          </div>
          {plan.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {plan.tags.map((tagId) => <TagBadge key={tagId} tagId={tagId} tags={exerciseTags} />)}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onToggle} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {canManage && (
            <>
              <button type="button" onClick={onEdit} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <Edit2 className="size-4" />
              </button>
              <button type="button" onClick={onDelete} className="rounded-md p-2 text-red-500 hover:bg-red-50">
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {visibleExercises.map((selected, index) => (
          <div key={`${selected.exercise_id}-${index}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <Dumbbell className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="font-semibold text-slate-800">{findExerciseName(exercises, selected.exercise_id)}</span>
            {(selected.weight || selected.reps) && (
              <span className="font-bold text-emerald-700">
                {selected.weight}
                {selected.weight && selected.reps ? ' x ' : ''}
                {selected.reps ? `${selected.reps}회` : ''}
              </span>
            )}
            {selected.note && <span className="truncate text-slate-500">{selected.note}</span>}
          </div>
        ))}
      </div>

      {!expanded && plan.exercises.length > visibleExercises.length && (
        <button type="button" onClick={onToggle} className="mt-3 text-sm font-semibold text-slate-500 hover:text-slate-900">
          {plan.exercises.length - visibleExercises.length}개 더 보기
        </button>
      )}

      {plan.description && (
        <p className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-600">
          {plan.description}
        </p>
      )}
    </article>
  );
}

export function ExerciseVideoLink({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="rounded-md p-1 text-blue-600 hover:bg-blue-50"
      title="영상 보기"
    >
      <Video className="size-4" />
    </a>
  );
}
