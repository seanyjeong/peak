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
  return formatBoundary(numValue, decimalPlaces);
}

/** 배점표 소수 자리로 보이되, 그보다 잘게 저장된 옛 값(정수 종목의 5.5 등)은 반올림하지 않고 저장된 그대로 보인다. */
export function formatBoundary(value: number, decimalPlaces = 0): string {
  const fixed = value.toFixed(decimalPlaces);
  return Number(fixed) === value ? fixed : String(Number(value.toFixed(2)));
}

const OPEN_MAX = 9999.99;
const RANGE_FIELDS: Array<[keyof ScoreRange, string]> = [
  ['male_min', '남자 최소'],
  ['male_max', '남자 최대'],
  ['female_min', '여자 최소'],
  ['female_max', '여자 최대'],
];

/**
 * 배점 구간 수정 검증(서버 backend/utils/score-ranges.js 와 같은 규칙). 문제가 없으면 null.
 * 소수 자리보다 잘게 쪼갠 값·최소>최대·다른 구간과 겹침을 막는다.
 */
export function validateScoreRange(range: ScoreRange, others: ScoreRange[], decimalPlaces = 0): string | null {
  const values: Partial<Record<keyof ScoreRange, number>> = {};
  for (const [field, label] of RANGE_FIELDS) {
    const value = Number(range[field]);
    if (!Number.isFinite(value)) return `${label} 값을 숫자로 입력해주세요.`;
    if (value < 0 || value > OPEN_MAX) return `${label} 값은 0 이상이어야 합니다.`;
    const factor = Math.pow(10, decimalPlaces);
    if (value !== OPEN_MAX && Math.abs(Math.round(value * factor) - value * factor) >= 1e-6) {
      return decimalPlaces === 0
        ? `${label} 값은 정수로 입력해주세요. 이 배점표는 소수점을 쓰지 않습니다.`
        : `${label} 값은 소수점 ${decimalPlaces}자리까지 입력해주세요.`;
    }
    values[field] = value;
  }
  const { male_min = 0, male_max = 0, female_min = 0, female_max = 0 } = values;
  if (male_min > male_max) return '남자 최소값이 최대값보다 큽니다.';
  if (female_min > female_max) return '여자 최소값이 최대값보다 큽니다.';
  for (const other of others) {
    if (male_min <= Number(other.male_max) && male_max >= Number(other.male_min)) {
      return `남자 구간이 ${other.score}점 구간과 겹칩니다.`;
    }
    if (female_min <= Number(other.female_max) && female_max >= Number(other.female_min)) {
      return `여자 구간이 ${other.score}점 구간과 겹칩니다.`;
    }
  }
  return null;
}

export function getDirectionLabel(direction: Direction): string {
  return direction === 'higher' ? '높을수록 좋음' : '낮을수록 좋음';
}

export function toNullableNumber(value: string): number | null {
  return value.trim() ? Number.parseFloat(value) : null;
}

export function getSettingsErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const maybeError = error as { response?: { status?: number; data?: { error?: unknown } }; code?: string };
  if (maybeError.code === 'ERR_NETWORK') return '서버와 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  if (maybeError.response?.status === 400 && typeof maybeError.response.data?.error === 'string') {
    return maybeError.response.data.error;
  }
  if (maybeError.response?.status === 401) return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (maybeError.response?.status === 403) return '이 설정을 변경할 권한이 없습니다.';
  if (maybeError.response?.status === 404) return '대상을 찾지 못했습니다. 새로고침 후 다시 시도해주세요.';
  return fallback;
}
