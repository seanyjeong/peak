export type Direction = 'higher' | 'lower';
export type SettingsTab = 'types' | 'scores' | 'permissions';

export interface RecordType {
  id: number;
  name: string;
  unit: string;
  direction: Direction;
  is_active: boolean;
  display_order: number;
  min_value: number | null;
  max_value: number | null;
}

export interface ScoreTable {
  id: number;
  record_type_id: number;
  record_type_name: string;
  unit: string;
  direction: Direction;
  name: string;
  max_score: number;
  min_score: number;
  score_step: number;
  value_step: number;
  decimal_places: number;
  male_perfect: number;
  female_perfect: number;
}

export interface ScoreRange {
  id: number;
  score_table_id: number;
  score: number;
  male_min: number;
  male_max: number;
  female_min: number;
  female_max: number;
}

export interface TypeForm {
  name: string;
  unit: string;
  direction: Direction;
  min_value: string;
  max_value: string;
}

export interface ScoreForm {
  max_score: number;
  min_score: number;
  score_step: number;
  value_step: number;
  decimal_places: number;
  male_perfect: number;
  female_perfect: number;
}

export const DEFAULT_TYPE_FORM: TypeForm = {
  name: '',
  unit: '',
  direction: 'higher',
  min_value: '',
  max_value: '',
};

export const DEFAULT_SCORE_FORM: ScoreForm = {
  max_score: 100,
  min_score: 50,
  score_step: 2,
  value_step: 5,
  decimal_places: 0,
  male_perfect: 300,
  female_perfect: 250,
};

export function formatRangeValue(value: number | string | null | undefined, decimalPlaces = 0): string {
  if (value == null || value === '') return '-';
  const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(numValue)) return '-';
  if (numValue >= 9999) return '이상';
  if (numValue <= 0) return '이하';
  return numValue.toFixed(decimalPlaces);
}

export function getDirectionLabel(direction: Direction): string {
  return direction === 'higher' ? '높을수록 좋음' : '낮을수록 좋음';
}

export function toNullableNumber(value: string): number | null {
  return value.trim() ? Number.parseFloat(value) : null;
}

export function getSettingsErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const maybeError = error as { response?: { status?: number }; code?: string };
  if (maybeError.code === 'ERR_NETWORK') return '서버와 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  if (maybeError.response?.status === 401) return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (maybeError.response?.status === 403) return '이 설정을 변경할 권한이 없습니다.';
  if (maybeError.response?.status === 404) return '대상을 찾지 못했습니다. 새로고침 후 다시 시도해주세요.';
  return fallback;
}
