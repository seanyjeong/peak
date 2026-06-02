class StudentRecordScopeError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'StudentRecordScopeError';
    this.statusCode = statusCode;
    this.publicMessage = '기록을 저장하지 못했습니다. 관리자에게 문의하세요.';
  }
}

function toNumber(value) {
  return Number(value);
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
  const existing = await findStudentRecord(connection, studentId, recordTypeId, measuredAt);

  if (existing && toNumber(existing.academy_id) !== toNumber(academyId)) {
    throw new StudentRecordScopeError('STUDENT_RECORD_SCOPE_MISMATCH', 409);
  }

  if (existing) {
    await connection.query(
      `UPDATE student_records
       SET value = ?, notes = ?, created_at = NOW()
       WHERE id = ? AND academy_id = ?`,
      [value, notes, existing.id, academyId]
    );
    return {
      id: existing.id,
      action: 'updated',
      oldValue: parseFloat(existing.value),
      newValue: value,
    };
  }

  const [result] = await connection.query(
    `INSERT INTO student_records
     (academy_id, student_id, record_type_id, measured_at, value, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [academyId, studentId, recordTypeId, measuredAt, value, notes]
  );

  return { id: result.insertId, action: 'inserted', newValue: value };
}

module.exports = {
  StudentRecordScopeError,
  assertStudentInAcademy,
  findStudentRecord,
  saveStudentRecord,
};
