export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface Instructor {
  id: number;
  name: string;
  user_id: number | null;
  time_slot: TimeSlot;
  isOwner?: boolean;
}

export interface SlotsData {
  morning: Instructor[];
  afternoon: Instructor[];
  evening: Instructor[];
}

export interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets: number | null;
  default_reps: number | null;
  description: string | null;
  video_url?: string | null;
}

export interface SelectedExercise {
  exercise_id: number;
  note: string;
  weight?: string;
  reps?: number;
}

export interface Plan {
  id: number;
  instructor_id: number;
  instructor_name: string;
  time_slot: TimeSlot;
  tags: string[];
  exercises: SelectedExercise[];
  description: string;
  date: string;
}

export interface ExerciseTag {
  id: number;
  tag_id: string;
  label: string;
  color: string;
}

export const TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

export const EMPTY_SLOTS: SlotsData = {
  morning: [],
  afternoon: [],
  evening: [],
};

export function todayIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function shiftIsoDate(dateValue: string, deltaDays: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatKoreanDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function getSlotStats(slotsData: SlotsData, plans: Plan[], slot: TimeSlot) {
  return {
    scheduled: slotsData[slot].length,
    planned: plans.filter((plan) => plan.time_slot === slot).length,
  };
}

export function filterExercises(exercises: Exercise[], selectedTags: string[], keyword: string) {
  const search = keyword.trim().toLowerCase();
  return exercises.filter((exercise) => {
    const matchesTags = selectedTags.length === 0 || exercise.tags.some((tag) => selectedTags.includes(tag));
    const matchesSearch = !search || exercise.name.toLowerCase().includes(search);
    return matchesTags && matchesSearch;
  });
}

export function findExerciseName(exercises: Exercise[], exerciseId: number) {
  return exercises.find((exercise) => exercise.id === exerciseId)?.name || `운동 #${exerciseId}`;
}
