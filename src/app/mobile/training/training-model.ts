import { Moon, Sun, Sunrise } from 'lucide-react';
import { PEAK_API_BASE_URL } from '@/lib/api/base-url';

export interface Student {
  id: number;
  assignment_id: number;
  training_log_id?: number;
  name: string;
  gender: 'male' | 'female';
  condition_score?: number;
  notes?: string;
  is_trial?: boolean;
  trial_total?: number;
  trial_remaining?: number;
}

export interface ClassInstructor {
  id: number;
  name: string;
  isOwner?: boolean;
  isMain?: boolean;
}

export interface ClassData {
  class_num: number;
  instructors: ClassInstructor[];
  students: Array<{
    id: number;
    student_id: number;
    student_name: string;
    gender: string;
    is_trial?: boolean;
    trial_total?: number;
    trial_remaining?: number;
  }>;
}

export interface PlannedExercise {
  id: number;
  name: string;
  sets?: number;
  reps?: number;
  completed?: boolean;
  completed_at?: string;
}

export interface DailyPlan {
  id: number;
  instructor_id: number;
  exercises: PlannedExercise[];
  completed_exercises: number[];
  exercise_times: Record<number, string>;
}

export const API_BASE = PEAK_API_BASE_URL;

export const timeSlotConfig = [
  { key: 'morning', label: '오전', icon: Sunrise },
  { key: 'afternoon', label: '오후', icon: Sun },
  { key: 'evening', label: '저녁', icon: Moon },
];

export const conditionEmojis = [
  { score: 1, emoji: '😞', label: '나쁨' },
  { score: 2, emoji: '😐', label: '보통' },
  { score: 3, emoji: '🙂', label: '좋음' },
  { score: 4, emoji: '😃', label: '매우좋음' },
  { score: 5, emoji: '👍', label: '최상' },
];
