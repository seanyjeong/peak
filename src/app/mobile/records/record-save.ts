interface RecordType {
  id: number;
  name: string;
  unit: string;
  min_value?: number | null;
  max_value?: number | null;
}

interface SaveMobileRecordParams {
  apiBase: string;
  token: string | null;
  studentId: number;
  recordTypeId: number;
  selectedDate: string;
  value: string;
  recordTypes: RecordType[];
}

export interface SaveMobileRecordResult {
  deleted: boolean;
  value: number | null;
}

async function parseApiError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => ({}));
  return new Error(data.message || fallback);
}

function buildRangeMessage(recordType: RecordType | undefined): string {
  const name = recordType?.name || '선택한 종목';
  const unit = recordType?.unit || '';
  const minValue = recordType?.min_value ?? null;
  const maxValue = recordType?.max_value ?? null;

  if (minValue != null && maxValue != null) {
    return `${name} 기록은 ${minValue}~${maxValue}${unit} 사이로 입력해주세요.`;
  }
  if (minValue != null) {
    return `${name} 기록은 ${minValue}${unit} 이상으로 입력해주세요.`;
  }
  return `${name} 기록은 ${maxValue}${unit} 이하로 입력해주세요.`;
}

export async function saveMobileRecord(params: SaveMobileRecordParams): Promise<SaveMobileRecordResult> {
  const { apiBase, token, studentId, recordTypeId, selectedDate, value, recordTypes } = params;
  const trimmed = value.trim();
  const numValue = trimmed === '' ? null : Number(trimmed);
  const recordType = recordTypes.find(type => type.id === recordTypeId);

  if (numValue === null || numValue === 0) {
    const response = await fetch(`${apiBase}/records`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        student_id: studentId,
        record_type_id: recordTypeId,
        measured_at: selectedDate,
      }),
    });

    if (!response.ok) throw await parseApiError(response, '기록을 삭제하지 못했습니다.');
    return { deleted: true, value: null };
  }

  if (!Number.isFinite(numValue)) {
    throw new Error('기록은 숫자로 입력해주세요.');
  }

  const minValue = recordType?.min_value ?? null;
  const maxValue = recordType?.max_value ?? null;
  if ((minValue != null && numValue < minValue) || (maxValue != null && numValue > maxValue)) {
    throw new Error(buildRangeMessage(recordType));
  }

  const response = await fetch(`${apiBase}/records/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      student_id: studentId,
      measured_at: selectedDate,
      records: [{ record_type_id: recordTypeId, value: numValue }],
    }),
  });

  if (!response.ok) throw await parseApiError(response, '기록을 저장하지 못했습니다.');
  return { deleted: false, value: numValue };
}
