export interface Student {
  id: number;
  paca_student_id: number;
  name: string;
  gender: 'M' | 'F';
  phone: string | null;
  school: string | null;
  grade: string | null;
  class_days: number[] | null;
  is_trial: boolean;
  trial_total: number;
  trial_remaining: number;
  join_date: string | null;
  status: 'active' | 'inactive' | 'injury' | 'pending';
}

export interface RecordType {
  id: number;
  name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
  display_order: number;
}

export interface RecordItem {
  record_type_id: number;
  record_type_name: string;
  unit: string;
  direction: 'higher' | 'lower';
  value: number;
  notes: string | null;
}

export interface StudentRecord {
  measured_at: string;
  records: RecordItem[];
}

export interface ScoreRange {
  score: number;
  male_min: number;
  male_max: number;
  female_min: number;
  female_max: number;
}

export interface ScoreTableData {
  scoreTable: { id: number; decimal_places: number } | null;
  ranges: ScoreRange[];
}

export interface RecordInput {
  value: string;
  score: number | null;
}

export const STATUS_MAP = {
  active: { label: '재원', color: 'bg-green-100 text-green-700' },
  inactive: { label: '휴원', color: 'bg-slate-100 text-slate-600' },
  injury: { label: '부상', color: 'bg-red-100 text-red-700' },
  pending: { label: '미등록', color: 'bg-amber-100 text-amber-700' },
};
