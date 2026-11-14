/**
 * 기록 허용 범위.
 * 최소값을 정하지 않은 종목은 0 을 하한으로 본다(거리·시간·횟수에는 음수가 없다).
 * 음수가 필요한 종목(예: 좌전굴)은 실기 측정 설정에서 최소값을 0 아래로 정하면 된다.
 * 서버(backend/utils/student-records.js validateRecordValue)와 같은 규칙이다.
 */
export interface RecordRangeType {
  name?: string;
  unit?: string;
  min_value?: number | string | null;
  max_value?: number | string | null;
}

function toLimit(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function getRecordRange(recordType: RecordRangeType | undefined) {
  return {
    min: toLimit(recordType?.min_value) ?? 0,
    max: toLimit(recordType?.max_value),
  };
}

export function isRecordValueOutOfRange(recordType: RecordRangeType | undefined, value: number): boolean {
  const { min, max } = getRecordRange(recordType);
  return value < min || (max !== null && value > max);
}

export function buildRecordRangeMessage(recordType: RecordRangeType | undefined): string {
  const name = recordType?.name || '선택한 종목';
  const unit = recordType?.unit || '';
  const { min, max } = getRecordRange(recordType);
  if (max !== null) return `${name} 기록은 ${min}~${max}${unit} 사이로 입력해주세요.`;
  return `${name} 기록은 ${min}${unit} 이상으로 입력해주세요.`;
}
