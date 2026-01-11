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
  { value: 'bg-red-100 text-red-700', label: '빨강' },
  { value: 'bg-orange-100 text-orange-700', label: '주황' },
  { value: 'bg-amber-100 text-amber-700', label: '황토' },
  { value: 'bg-yellow-100 text-yellow-700', label: '노랑' },
  { value: 'bg-lime-100 text-lime-700', label: '라임' },
  { value: 'bg-green-100 text-green-700', label: '초록' },
  { value: 'bg-teal-100 text-teal-700', label: '청록' },
  { value: 'bg-cyan-100 text-cyan-700', label: '시안' },
  { value: 'bg-blue-100 text-blue-700', label: '파랑' },
  { value: 'bg-indigo-100 text-indigo-700', label: '남색' },
  { value: 'bg-purple-100 text-purple-700', label: '보라' },
  { value: 'bg-fuchsia-100 text-fuchsia-700', label: '자홍' },
  { value: 'bg-pink-100 text-pink-700', label: '분홍' },
  { value: 'bg-rose-100 text-rose-700', label: '로즈' },
  { value: 'bg-slate-100 text-slate-700', label: '회색' },
];
