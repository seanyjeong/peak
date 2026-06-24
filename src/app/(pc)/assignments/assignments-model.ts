export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
  school: string | null;
  grade: string | null;
  is_trial: boolean;
  trial_total: number;
  trial_remaining: number;
  status: 'enrolled' | 'trial' | 'rest' | 'injury';
  attendance_status?: 'scheduled' | 'present' | 'absent' | 'late' | 'early_leave';
  absence_reason?: string | null;
}

export interface Instructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain?: boolean;
  order_num?: number;
}

export interface ClassData {
  class_num: number;
  instructors: Instructor[];
  students: Student[];
}

export interface SlotData {
  waitingStudents: Student[];
  waitingInstructors: Instructor[];
  classes: ClassData[];
}

export interface SlotsData {
  morning: SlotData;
  afternoon: SlotData;
  evening: SlotData;
}

export interface AssignmentPreset {
  id: number;
  name: string;
  type: string;
}

export const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export const TIME_SLOT_INFO: Record<TimeSlot, { label: string; color: string; bgColor: string }> = {
  morning: { label: '오전반', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  afternoon: { label: '오후반', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  evening: { label: '저녁반', color: 'text-slate-700', bgColor: 'bg-slate-100' },
};

export function createEmptySlots(): SlotsData {
  return {
    morning: { waitingStudents: [], waitingInstructors: [], classes: [] },
    afternoon: { waitingStudents: [], waitingInstructors: [], classes: [] },
    evening: { waitingStudents: [], waitingInstructors: [], classes: [] },
  };
}

export function hasSlotStudents(slot: SlotData) {
  return slot.waitingStudents.length > 0 || slot.classes.some((classData) => classData.students.length > 0);
}

export function getDefaultSlot(slots: SlotsData): TimeSlot {
  if (hasSlotStudents(slots.evening)) return 'evening';
  if (hasSlotStudents(slots.afternoon)) return 'afternoon';
  if (hasSlotStudents(slots.morning)) return 'morning';
  return 'evening';
}

export function getSlotStudentCount(slot: SlotData) {
  return slot.waitingStudents.length + slot.classes.reduce((sum, classData) => sum + classData.students.length, 0);
}

export function getAssignedStudentCount(slot: SlotData) {
  return slot.classes.reduce((sum, classData) => sum + classData.students.length, 0);
}

export function formatDateKorean(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function getLocalDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
