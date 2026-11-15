import type { ComponentType } from 'react';
import type { Branch } from '@/components/BranchTabs';
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
  branches?: Branch[]; // P-ACA 지점 (지점이 없는 학원은 빈 목록)
}

export const EMPTY_SLOTS: SlotsData = { morning: [], afternoon: [], evening: [] };
export const EMPTY_STATS: Stats = { total: 0, present: 0, absent: 0, late: 0, excused: 0, unchecked: 0 };
export const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening'];
export const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

export const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: ComponentType<{ size?: number }> }> = {
  morning: { label: '오전반', icon: Sunrise },
  afternoon: { label: '오후반', icon: Sun },
  evening: { label: '저녁반', icon: Moon },
};

export type TimeSlotTimes = Record<TimeSlot, string>;

// 시간대 시각은 P-ACA 학원 설정(반 배치 응답의 timeSlots)을 쓴다. 못 받았을 때만 이 기본값.
export const DEFAULT_TIME_SLOTS: TimeSlotTimes = {
  morning: '09:00-12:00',
  afternoon: '13:00-17:00',
  evening: '18:00-21:00',
};

export const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: ComponentType<{ size?: number }>; className: string }> = {
  present: {
    label: '출석',
    icon: Check,
    className: 'border-success/30 bg-success-soft text-success',
  },
  absent: {
    label: '결석',
    icon: X,
    className: 'border-destructive/30 bg-destructive-soft text-destructive',
  },
  late: {
    label: '지각',
    icon: Clock3,
    className: 'border-warning/30 bg-warning-soft text-warning',
  },
  excused: {
    label: '사유',
    icon: AlertCircle,
    className: 'border-primary/30 bg-primary-soft text-primary',
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
