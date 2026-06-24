export interface EventAverage {
  recordTypeId: number;
  recordTypeName: string;
  shortName: string;
  unit: string;
  direction: string;
  maleAvg: number | null;
  femaleAvg: number | null;
  totalAvg: number | null;
  maleCount: number;
  femaleCount: number;
}

export interface RankStudent {
  rank: number;
  studentId: number;
  studentName: string;
  value: number;
  measuredAt: string;
}

export interface Ranking {
  recordTypeId: number;
  recordTypeName: string;
  unit: string;
  direction: string;
  male: RankStudent[];
  female: RankStudent[];
}

export interface TrendStudent {
  studentId: number;
  studentName: string;
  gender: string;
  slope: number;
  latestValue: number;
  recentValues: number[];
}

export type TrendType = 'improving' | 'maintaining' | 'declining';

export interface EventTrend {
  recordTypeId: number;
  recordTypeName: string;
  unit: string;
  direction: string;
  avgSlope: number;
  avgTrend: TrendType;
  improving: TrendStudent[];
  maintaining: TrendStudent[];
  declining: TrendStudent[];
  analyzedCount: number;
}

export interface AnalyticsData {
  summary: {
    totalRecords: number;
    totalStudents: number;
    academyName: string;
    reportDate: string;
    totalEvents: number;
    overallTrend: Record<TrendType, number>;
  };
  eventAverages: EventAverage[];
  rankings: Ranking[];
  eventTrends: EventTrend[];
  insufficientData: {
    studentId: number;
    studentName: string;
    gender: string;
    events: { recordTypeName: string; recordCount: number }[];
  }[];
}

export function slopeToText(slope: number, unit: string, direction: string): string {
  const absSlope = Math.abs(slope);
  const perMeasure = absSlope < 0.1 ? absSlope.toFixed(2) : absSlope.toFixed(1);

  if (direction === 'higher') {
    return slope > 0
      ? `매회 약 ${perMeasure}${unit} 증가`
      : `매회 약 ${perMeasure}${unit} 감소`;
  }

  return slope < 0
    ? `매회 약 ${perMeasure}${unit} 단축`
    : `매회 약 ${perMeasure}${unit} 느려짐`;
}

export function trendLabel(trend: TrendType): string {
  if (trend === 'improving') return '상승';
  if (trend === 'declining') return '하락';
  return '유지';
}

export function formatMetric(value: number | null, unit?: string): string {
  if (value === null || value === undefined) return '-';
  return `${value}${unit ? ` ${unit}` : ''}`;
}

export function sortTrendStudents(
  students: TrendStudent[],
  type: TrendType,
  direction: string,
): TrendStudent[] {
  return [...students].sort((a, b) => {
    if (type !== 'maintaining') return Math.abs(b.slope) - Math.abs(a.slope);
    return direction === 'lower' ? a.latestValue - b.latestValue : b.latestValue - a.latestValue;
  });
}
