import type { ComponentType } from 'react';
import { AlertCircle, Check, Clock3, Moon, Sun, Sunrise, X } from 'lucide-react';

export type TimeSlot = 'morning' | 'afternoon' | 'evening';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type StudentStatus = AttendanceStatus | null;
type StatsKey = AttendanceStatus | 'unchecked';

export interface Student {
  assignment_id: number;
  student_id: number;
  student_name: string;
  gender: string;
  school: string;
  grade: string;
  class_id: number | null;
  is_trial: number;
  paca_attendance_id: number | null;
  attendance_status: StudentStatus;
  notes: string | null;
}

export interface SlotsData {
  morning: Student[];
  afternoon: Student[];
  evening: Student[];
}

export interface Stats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  unchecked: number;
}

export interface StudentAttendanceResponse {
  slots?: Partial<SlotsData>;
  stats?: Partial<Stats>;
}

export const EMPTY_SLOTS: SlotsData = { morning: [], afternoon: [], evening: [] };
export const EMPTY_STATS: Stats = { total: 0, present: 0, absent: 0, late: 0, excused: 0, unchecked: 0 };
export const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening'];
export const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

export const TIME_SLOT_INFO: Record<TimeSlot, { label: string; time: string; icon: ComponentType<{ size?: number }> }> = {
  morning: { label: '오전반', time: '09:00-12:00', icon: Sunrise },
  afternoon: { label: '오후반', time: '13:00-17:00', icon: Sun },
  evening: { label: '저녁반', time: '18:00-21:00', icon: Moon },
};

export const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: ComponentType<{ size?: number }>; className: string }> = {
  present: {
    label: '출석',
    icon: Check,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
  absent: {
    label: '결석',
    icon: X,
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  },
  late: {
    label: '지각',
    icon: Clock3,
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  },
  excused: {
    label: '사유',
    icon: AlertCircle,
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
  },
};

export function normalizeSlots(slots?: Partial<SlotsData>): SlotsData {
  return {
    morning: slots?.morning || [],
    afternoon: slots?.afternoon || [],
    evening: slots?.evening || [],
  };
}

export function getDefaultSlot(slots: SlotsData): TimeSlot {
  if (slots.evening.length > 0) return 'evening';
  if (slots.afternoon.length > 0) return 'afternoon';
  if (slots.morning.length > 0) return 'morning';
  return 'evening';
}

export function countStatus(students: Student[], status: AttendanceStatus) {
  return students.filter((student) => student.attendance_status === status).length;
}

export function adjustStats(stats: Stats, previousStatus: StudentStatus, nextStatus: StudentStatus): Stats {
  const nextStats = { ...stats };
  const previousKey: StatsKey = previousStatus || 'unchecked';
  const nextKey: StatsKey = nextStatus || 'unchecked';
  nextStats[previousKey] = Math.max(nextStats[previousKey] - 1, 0);
  nextStats[nextKey] += 1;
  return nextStats;
}

export interface StudentStatusUpdateResult {
  slotsData: SlotsData;
  previousStatus: StudentStatus;
  changed: boolean;
  matched: boolean;
}

export function updateStudentStatus(
  slotsData: SlotsData,
  pacaAttendanceId: number,
  status: StudentStatus,
): StudentStatusUpdateResult {
  let previousStatus: StudentStatus = null;
  let matched = false;
  let changed = false;

  const nextSlots: SlotsData = { ...slotsData };
  SLOT_ORDER.forEach((slot) => {
    nextSlots[slot] = slotsData[slot].map((student) => {
      if (student.paca_attendance_id !== pacaAttendanceId) return student;

      matched = true;
      previousStatus = student.attendance_status;
      if (student.attendance_status === status) return student;

      changed = true;
      return { ...student, attendance_status: status };
    });
  });

  return {
    slotsData: changed ? nextSlots : slotsData,
    previousStatus,
    changed,
    matched,
  };
}

export function updateManyStudentStatuses(slotsData: SlotsData, students: Student[], status: StudentStatus): SlotsData {
  const ids = new Set(students.map((student) => student.paca_attendance_id));
  const nextSlots = { ...slotsData };
  SLOT_ORDER.forEach((slot) => {
    nextSlots[slot] = nextSlots[slot].map((student) => (
      ids.has(student.paca_attendance_id) ? { ...student, attendance_status: status } : student
    ));
  });
  return nextSlots;
}

export function getLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
