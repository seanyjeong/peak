export interface RecordType {
  id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
}

export interface StudentStats {
  averages: Record<number, number>;
  bests: Record<number, { value: number; date: string }>;
  latests: Record<number, { value: number; date: string }>;
  scores: Record<number, number>;
  trends: Record<number, 'up' | 'down' | 'stable' | 'need_more'>;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  grade: string;
  overallTrend: string;
  recordCount: number;
  typesWithRecords: number;
}

export interface Student {
  id: number;
  name: string;
  gender: 'M' | 'F';
  school: string;
  grade: string;
  phone?: string;
  status: string;
}

export interface RecordHistory {
  measured_at: string;
  records: {
    record_type_id: number;
    record_type_name: string;
    unit: string;
    value: number;
  }[];
}

export interface ScoreTable {
  id: number;
  record_type_id: number;
  male_perfect: number;
  female_perfect: number;
  max_score: number;
}

export function displayTypeName(type: RecordType | undefined): string {
  return type?.short_name || type?.name || '-';
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

export function formatRecordValue(value: number | undefined, unit = ''): string {
  if (value === undefined || value === null) return '-';
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${text}${unit}`;
}

export function trendLabel(trend: string): string {
  if (trend === 'up') return '상승';
  if (trend === 'down') return '하락';
  if (trend === 'need_more') return '기록 필요';
  return '안정';
}

export function trendClass(trend: string): string {
  if (trend === 'up') return 'bg-emerald-50 text-emerald-700';
  if (trend === 'down') return 'bg-rose-50 text-rose-700';
  if (trend === 'need_more') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

export function gradeClass(grade: string): string {
  if (grade === 'A') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (grade === 'B') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (grade === 'C') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (grade === 'D') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-900 text-white border-slate-900';
}

export function getRecordPercentage({
  recordTypes,
  scoreTables,
  student,
  typeId,
  value,
}: {
  recordTypes: RecordType[];
  scoreTables: Record<number, ScoreTable>;
  student: Student | null;
  typeId: number;
  value: number;
}): number {
  const type = recordTypes.find((item) => item.id === typeId);
  const scoreTable = scoreTables[typeId];
  if (!type || !scoreTable || !student) return 0;
  const perfectValue = student.gender === 'M' ? scoreTable.male_perfect : scoreTable.female_perfect;
  if (!perfectValue) return 0;

  if (type.direction === 'lower') {
    return Math.max(0, Math.min(100, (2 - value / perfectValue) * 100));
  }
  return Math.max(0, Math.min(100, (value / perfectValue) * 100));
}

export function getProfileErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const maybeError = error as { response?: { status?: number }; code?: string };
  if (maybeError.code === 'ERR_NETWORK') return '서버와 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  if (maybeError.response?.status === 401) return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (maybeError.response?.status === 403) return '학생 정보를 볼 권한이 없습니다.';
  if (maybeError.response?.status === 404) return '학생 정보를 찾지 못했습니다.';
  return fallback;
}
