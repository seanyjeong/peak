import { Moon, Sun, Sunrise } from 'lucide-react';
import { PEAK_API_BASE_URL } from '@/lib/api/base-url';

export interface ExerciseTag {
  id: number;
  tag_id: string;
  label: string;
  color: string;
}

export interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets?: number;
  default_reps?: number;
}

export interface DailyPlan {
  id: number;
  date: string;
  time_slot: string;
  instructor_id: number;
  instructor_name: string;
  tags: string[];
  exercises: { exercise_id: number; note?: string; id?: number; name?: string }[];
  description: string;
}

export const API_BASE = PEAK_API_BASE_URL;

export const timeSlotConfig = [
  { key: 'morning', label: '오전', icon: Sunrise },
  { key: 'afternoon', label: '오후', icon: Sun },
  { key: 'evening', label: '저녁', icon: Moon },
];
