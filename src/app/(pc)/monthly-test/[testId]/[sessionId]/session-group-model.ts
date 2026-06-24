import type { Modifier } from '@dnd-kit/core';

export interface Participant {
  id: number;
  student_id?: number;
  test_applicant_id?: number;
  name: string;
  gender: 'M' | 'F';
  school?: string;
  grade?: string;
  participant_type: 'enrolled' | 'rest' | 'trial' | 'test_new';
  attendance_status: string;
}

export interface Supervisor {
  id?: number;
  instructor_id: number;
  name: string;
  is_main?: boolean;
  isOwner?: boolean;
}

export interface Group {
  id: number;
  group_num: number;
  group_name?: string;
  supervisors: Supervisor[];
  participants: Participant[];
}

export interface Session {
  id: number;
  test_date: string;
  time_slot: string;
  test_name: string;
  test_month: string;
}

export interface ScheduleItem {
  group_id: number;
  group_num: number;
  group_name: string | null;
  time_order: number;
  record_type_id: number | null;
  record_type_name: string | null;
  record_type_short: string | null;
}

export interface RecordType {
  id: number;
  name: string;
  short_name: string;
}

export type ActiveDragItem =
  | { type: 'participant'; participant: Participant }
  | { type: 'supervisor'; supervisor: Supervisor }
  | null;

export const PARTICIPANT_TYPE_LABELS: Record<Participant['participant_type'], string> = {
  enrolled: '재원',
  rest: '휴원',
  trial: '체험',
  test_new: '신규',
};

export const PARTICIPANT_TYPE_CLASSES: Record<Participant['participant_type'], string> = {
  enrolled: 'bg-emerald-50 text-emerald-700',
  rest: 'bg-slate-100 text-slate-600',
  trial: 'bg-violet-50 text-violet-700',
  test_new: 'bg-orange-50 text-orange-700',
};

export const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent && 'clientX' in activatorEvent) {
    const event = activatorEvent as MouseEvent;
    const offsetX = event.clientX - draggingNodeRect.left;
    const offsetY = event.clientY - draggingNodeRect.top;
    return {
      ...transform,
      x: transform.x + offsetX - draggingNodeRect.width / 2,
      y: transform.y + offsetY - draggingNodeRect.height / 2,
    };
  }
  return transform;
};

export function formatSessionDate(date: string): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export function getSessionErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const maybeError = error as { response?: { status?: number; data?: { message?: string } }; code?: string };
  if (maybeError.code === 'ERR_NETWORK') return '서버와 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  if (maybeError.response?.status === 401) return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (maybeError.response?.status === 403) return '세션을 변경할 권한이 없습니다.';
  if (maybeError.response?.status === 404) return '세션 정보를 찾지 못했습니다.';
  return maybeError.response?.data?.message || fallback;
}
