import { Moon, Sun, Sunrise } from 'lucide-react';

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

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/peak';

export const timeSlotConfig = [
  { key: 'morning', label: '오전', icon: Sunrise },
  { key: 'afternoon', label: '오후', icon: Sun },
  { key: 'evening', label: '저녁', icon: Moon },
];
