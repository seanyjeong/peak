/* eslint-disable @typescript-eslint/no-require-imports */

const {
  StudentRecordScopeError,
  saveStudentRecord,
} = require('../../../backend/utils/student-records');

function createConnection({ students = [], records = [], insertId = 101 } = {}) {
  return {
    query: jest.fn(async (sql, params) => {
      if (sql.includes('FROM students WHERE id = ? AND academy_id = ?')) {
        return [students.filter(
          student => student.id === params[0] && student.academy_id === params[1]
        )];
      }

      if (sql.includes('FROM student_records') && sql.includes('LIMIT 1')) {
        return [records.filter(record =>
          record.student_id === params[0] &&
          record.record_type_id === params[1] &&
          record.measured_at === params[2]
        ).slice(0, 1)];
      }

      if (sql.includes('UPDATE student_records')) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes('INSERT INTO student_records')) {
        return [{ insertId }];
      }

      return [[]];
    }),
  };
}

describe('student record academy guard', () => {
  it('blocks saving when the student is not in the current academy', async () => {
    const connection = createConnection({ students: [] });

    await expect(saveStudentRecord(connection, {
      academyId: 5,
      studentId: 9640,
      recordTypeId: 13,
      measuredAt: '2026-05-25',
      value: 221,
    })).rejects.toMatchObject({
      name: 'StudentRecordScopeError',
      statusCode: 404,
      publicMessage: '기록을 저장하지 못했습니다. 관리자에게 문의하세요.',
    });

    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  it('inserts new records with the current academy id', async () => {
    const connection = createConnection({
      students: [{ id: 9640, academy_id: 5 }],
      records: [],
      insertId: 12080,
    });

    const result = await saveStudentRecord(connection, {
      academyId: 5,
      studentId: 9640,
      recordTypeId: 13,
      measuredAt: '2026-05-25',
      value: 221,
      notes: null,
    });

    expect(result).toEqual({ id: 12080, action: 'inserted', newValue: 221 });
    expect(connection.query).toHaveBeenLastCalledWith(
      expect.stringContaining('(academy_id, student_id, record_type_id, measured_at, value, notes)'),
      [5, 9640, 13, '2026-05-25', 221, null]
    );
  });

  it('updates existing records only inside the current academy', async () => {
    const connection = createConnection({
      students: [{ id: 9640, academy_id: 5 }],
      records: [{
        id: 12080,
        academy_id: 5,
        student_id: 9640,
        record_type_id: 13,
        measured_at: '2026-05-25',
        value: '229.00',
      }],
    });

    const result = await saveStudentRecord(connection, {
      academyId: 5,
      studentId: 9640,
      recordTypeId: 13,
      measuredAt: '2026-05-25',
      value: 221,
      notes: null,
    });

    expect(result).toEqual({
      id: 12080,
      action: 'updated',
      oldValue: 229,
      newValue: 221,
    });
    expect(connection.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE id = ? AND academy_id = ?'),
      [221, null, 12080, 5]
    );
  });

  it('refuses to repair mismatched existing records silently', async () => {
    const connection = createConnection({
      students: [{ id: 9640, academy_id: 5 }],
      records: [{
        id: 12080,
        academy_id: 2,
        student_id: 9640,
        record_type_id: 13,
        measured_at: '2026-05-25',
        value: '229.00',
      }],
    });

    await expect(saveStudentRecord(connection, {
      academyId: 5,
      studentId: 9640,
      recordTypeId: 13,
      measuredAt: '2026-05-25',
      value: 221,
    })).rejects.toBeInstanceOf(StudentRecordScopeError);

    expect(connection.query).toHaveBeenCalledTimes(2);
  });
});
