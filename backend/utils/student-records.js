class StudentRecordScopeError extends Error {
  constructor(message, statusCode = 400, publicMessage = '기록을 저장하지 못했습니다. 관리자에게 문의하세요.') {
    super(message);
    this.name = 'StudentRecordScopeError';
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

function toNumber(value) {
  return Number(value);
}

function formatRecordValue(value) {
  const numberValue = toNumber(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return Number.isInteger(numberValue) ? String(numberValue) : String(numberValue);
}

function buildRangeMessage(recordType) {
  const minValue = recordType.min_value != null ? formatRecordValue(recordType.min_value) : null;
  const maxValue = recordType.max_value != null ? formatRecordValue(recordType.max_value) : null;
  const unit = recordType.unit || '';

  if (minValue !== null && maxValue !== null) {
    return `${recordType.name} 기록은 ${minValue}~${maxValue}${unit} 사이로 입력해주세요.`;
  }
  if (minValue !== null) {
    return `${recordType.name} 기록은 ${minValue}${unit} 이상으로 입력해주세요.`;
  }
  return `${recordType.name} 기록은 ${maxValue}${unit} 이하로 입력해주세요.`;
}

async function assertStudentInAcademy(connection, academyId, studentId) {
  const [students] = await connection.query(
    'SELECT id, academy_id FROM students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );

  if (students.length === 0) {
    throw new StudentRecordScopeError('학생이 현재 학원 소속이 아닙니다.', 404);
  }

  return students[0];
}

async function getRecordType(connection, academyId, recordTypeId) {
  const [recordTypes] = await connection.query(
    `SELECT id, academy_id, name, unit, min_value, max_value
     FROM record_types
     WHERE id = ? AND academy_id = ? AND is_active = 1
     LIMIT 1`,
    [recordTypeId, academyId]
  );

  if (recordTypes.length === 0) {
    throw new StudentRecordScopeError(
      'RECORD_TYPE_NOT_FOUND',
      404,
      '기록 종목을 찾을 수 없습니다.'
    );
  }

  return recordTypes[0];
}

async function validateRecordValue(connection, academyId, recordTypeId, value) {
  const recordType = await getRecordType(connection, academyId, recordTypeId);
  const numericValue = toNumber(value);

  if (!Number.isFinite(numericValue)) {
    throw new StudentRecordScopeError(
      'INVALID_RECORD_VALUE',
      400,
      `${recordType.name} 기록은 숫자로 입력해주세요.`
    );
  }

  const minValue = recordType.min_value != null ? toNumber(recordType.min_value) : null;
  const maxValue = recordType.max_value != null ? toNumber(recordType.max_value) : null;
  const isBelowMin = minValue !== null && numericValue < minValue;
  const isAboveMax = maxValue !== null && numericValue > maxValue;

  if (isBelowMin || isAboveMax) {
    throw new StudentRecordScopeError(
      'RECORD_VALUE_OUT_OF_RANGE',
      400,
      buildRangeMessage(recordType)
    );
  }

  return { recordType, value: numericValue };
}

async function findStudentRecord(connection, studentId, recordTypeId, measuredAt) {
  const [records] = await connection.query(
    `SELECT id, academy_id, value
     FROM student_records
     WHERE student_id = ? AND record_type_id = ? AND measured_at = ?
     LIMIT 1`,
    [studentId, recordTypeId, measuredAt]
  );

  return records[0] || null;
}

async function saveStudentRecord(connection, params) {
  const {
    academyId,
    studentId,
    recordTypeId,
    measuredAt,
    value,
    notes = null,
  } = params;

  await assertStudentInAcademy(connection, academyId, studentId);
  const validation = await validateRecordValue(connection, academyId, recordTypeId, value);
  const existing = await findStudentRecord(connection, studentId, recordTypeId, measuredAt);

  if (existing && toNumber(existing.academy_id) !== toNumber(academyId)) {
    throw new StudentRecordScopeError('STUDENT_RECORD_SCOPE_MISMATCH', 409);
  }

  if (existing) {
    await connection.query(
      `UPDATE student_records
       SET value = ?, notes = ?, created_at = NOW()
       WHERE id = ? AND academy_id = ?`,
      [validation.value, notes, existing.id, academyId]
    );
    return {
      id: existing.id,
      action: 'updated',
      oldValue: parseFloat(existing.value),
      newValue: validation.value,
    };
  }

  const [result] = await connection.query(
    `INSERT INTO student_records
     (academy_id, student_id, record_type_id, measured_at, value, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [academyId, studentId, recordTypeId, measuredAt, validation.value, notes]
  );

  return { id: result.insertId, action: 'inserted', newValue: validation.value };
}

module.exports = {
  StudentRecordScopeError,
  assertStudentInAcademy,
  findStudentRecord,
  validateRecordValue,
  saveStudentRecord,
};
