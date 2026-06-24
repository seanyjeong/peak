export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
  status: string;
  attendance_status?: 'scheduled' | 'present' | 'absent' | 'late' | 'early_leave';
  absence_reason?: string | null;
}

export interface ClassInstructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain: boolean;
}

export interface ClassData {
  class_num: number;
  instructors: ClassInstructor[];
  students: Student[];
}

export interface SlotData {
  waitingStudents: Student[];
  waitingInstructors: { id: number; name: string; isOwner: boolean }[];
  classes: ClassData[];
}

export interface Exercise {
  id: number;
  name: string;
  tags: string[];
}

export interface PlanExercise {
  id?: number;
  exercise_id?: number;
  name?: string;
  note?: string;
  weight?: string;
  reps?: number;
}

export interface ExtraExercise {
  exercise_id?: number;
  name: string;
  note?: string;
  completed: boolean;
}

export interface Plan {
  id: number;
  date: string;
  time_slot: TimeSlot;
  instructor_id: number;
  instructor_name: string;
  exercises: PlanExercise[];
  completed_exercises: number[];
  extra_exercises: ExtraExercise[];
  exercise_times: Record<string, string>;
  conditions_checked: boolean | number;
  conditions_checked_at: string | null;
  temperature: number | null;
  humidity: number | null;
}

export interface ExistingLog {
  id: number;
  student_id: number;
  condition_score: number | null;
  notes: string;
}

export interface ScheduledInstructor {
  id: number;
  name: string;
  user_id: number;
  time_slot: TimeSlot;
  isOwner?: boolean;
}

export const TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

export function todayIsoDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function shiftIsoDate(dateValue: string, deltaDays: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function formatKoreanDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function getAvailableSlots(slots: Record<string, SlotData>) {
  return TIME_SLOTS.filter((slot) => {
    const slotData = slots[slot];
    if (!slotData) return false;
    const hasClassStudents = slotData.classes?.some((classData) => classData.students?.length > 0);
    return hasClassStudents || slotData.waitingStudents?.length > 0;
  });
}

export function getStudentsForSelection(slotData: SlotData | undefined, isAdmin: boolean, instructorId: number | null) {
  if (!slotData) return [];
  if (isAdmin) {
    return [
      ...(slotData.classes || []).flatMap((classData) => classData.students || []),
      ...(slotData.waitingStudents || []),
    ];
  }
  if (!instructorId) return [];
  const myClass = (slotData.classes || []).find((classData) => (
    classData.instructors?.some((instructor) => instructor.id === instructorId)
  ));
  return myClass?.students || [];
}

export function findTrainerForStudent(slotData: SlotData | undefined, studentId: number) {
  if (!slotData) return null;
  for (const classData of slotData.classes || []) {
    if (classData.students?.some((student) => student.student_id === studentId)) {
      return classData.instructors?.[0]?.id ?? null;
    }
  }
  return null;
}

export function getExerciseId(exercise: PlanExercise) {
  return exercise.exercise_id || exercise.id || null;
}

export function getExerciseName(exercise: PlanExercise, exercises: Exercise[]) {
  if (exercise.name) return exercise.name;
  const id = getExerciseId(exercise);
  if (!id) return '운동';
  return exercises.find((item) => item.id === id)?.name || `운동 #${id}`;
}

export function isConditionChecked(plan: Plan) {
  return Boolean(plan.conditions_checked);
}
