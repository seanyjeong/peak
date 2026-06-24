export type TestStatus = 'draft' | 'active' | 'completed';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface RecordType {
  id: number;
  record_type_id: number;
  name: string;
  short_name: string;
  unit: string;
}

export interface AllRecordType {
  id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
}

export interface Session {
  id: number;
  test_date: string;
  time_slot: TimeSlot;
  participant_count: number;
  group_count: number;
}

export interface MonthlyTest {
  id: number;
  test_month: string;
  test_name: string;
  status: TestStatus;
  notes: string | null;
  record_types: RecordType[];
  sessions: Session[];
}

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

export const STATUS_LABELS: Record<TestStatus, string> = {
  draft: '준비중',
  active: '진행중',
  completed: '완료',
};

export const STATUS_CLASSES: Record<TestStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50 text-blue-700',
};

export function formatSessionDate(date: string): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export function getMonthlyErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const maybeError = error as { response?: { status?: number; data?: { message?: string } }; code?: string };
  if (maybeError.code === 'ERR_NETWORK') return '서버와 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  if (maybeError.response?.status === 401) return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (maybeError.response?.status === 403) return '월말테스트를 변경할 권한이 없습니다.';
  if (maybeError.response?.status === 404) return '월말테스트 정보를 찾지 못했습니다.';
  return maybeError.response?.data?.message || fallback;
}
