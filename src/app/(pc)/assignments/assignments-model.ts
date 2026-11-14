export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
  school: string | null;
  grade: string | null;
  paca_class_name?: string | null; // P-ACA 반 이름(지점을 쓰는 학원만)
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

// P-ACA 지점. 지점이 없는 학원은 빈 목록이고 화면이 지금 그대로다.
export interface AssignmentBranch {
  id: number;
  name: string;
}

export interface AssignmentPreset {
  branch_id?: number | null;
  id: number;
  name: string;
  type: string;
}

export const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export const TIME_SLOT_INFO: Record<TimeSlot, { label: string; color: string; bgColor: string }> = {
  morning: { label: '오전반', color: 'text-warning', bgColor: 'bg-warning-soft' },
  afternoon: { label: '오후반', color: 'text-primary', bgColor: 'bg-primary-soft' },
  evening: { label: '저녁반', color: 'text-secondary-foreground', bgColor: 'bg-muted' },
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
