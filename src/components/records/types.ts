export interface RecordType {
  id: number;
  name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
}

export interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
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

export interface ScoreRange {
  score: number;
  male_min: number;
  male_max: number;
  female_min: number;
  female_max: number;
}

export interface ScoreTableData {
  scoreTable: {
    id: number;
    decimal_places: number;
  } | null;
  ranges: ScoreRange[];
}

export interface RecordInput {
  value: string;
  score: number | null;
}

export type InputMode = 'student' | 'event';

export const SLOT_LABELS: Record<string, string> = {
  morning: '오전반',
  afternoon: '오후반',
  evening: '저녁반'
};

export const getRoleDisplayName = (role?: string, position?: string | null): string => {
  if (position) return position;
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};
