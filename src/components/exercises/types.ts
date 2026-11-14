export interface Exercise {
  id: number;
  name: string;
  tags: string[];
  default_sets: number | null;
  default_reps: number | null;
  description: string | null;
  video_url?: string | null;
}

export interface ExerciseTag {
  id: number;
  tag_id: string;
  label: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

export interface ExercisePack {
  id: number;
  name: string;
  description: string | null;
  version: string;
  author: string;
  exercise_count: number;
  created_at: string;
  is_system?: boolean;
}

export interface ExerciseFormData {
  name: string;
  tags: string[];
  default_sets: string;
  default_reps: string;
  description: string;
  video_url: string;
}

export interface TagFormData {
  tag_id: string;
  label: string;
  color: string;
}

export interface PackFormData {
  name: string;
  description: string;
  exercise_ids: number[];
}

export const TAG_COLORS = [
  { value: 'bg-destructive-soft text-destructive', label: '빨강' },
  { value: 'bg-primary-soft text-primary', label: '주황' },
  { value: 'bg-warning-soft text-warning', label: '황토' },
  { value: 'bg-warning-soft text-warning', label: '노랑' },
  { value: 'bg-lime-100 text-lime-700', label: '라임' },
  { value: 'bg-success-soft text-success', label: '초록' },
  { value: 'bg-teal-100 text-teal-700', label: '청록' },
  { value: 'bg-cyan-100 text-cyan-700', label: '시안' },
  { value: 'bg-primary-soft text-primary', label: '파랑' },
  { value: 'bg-primary-soft text-primary', label: '남색' },
  { value: 'bg-purple-100 text-purple-700', label: '보라' },
  { value: 'bg-fuchsia-100 text-fuchsia-700', label: '자홍' },
  { value: 'bg-pink-100 text-pink-700', label: '분홍' },
  { value: 'bg-destructive-soft text-destructive', label: '로즈' },
  { value: 'bg-muted text-secondary-foreground', label: '회색' },
];
