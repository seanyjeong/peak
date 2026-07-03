import {
  EMPTY_STATS,
  adjustStats,
  updateStudentStatus,
  type SlotsData,
  type Student,
} from '@/app/(pc)/student-attendance/student-attendance-model';

function makeStudent(overrides: Partial<Student>): Student {
  return {
    assignment_id: 1,
    student_id: 101,
    student_name: '테스트학생',
    gender: 'M',
    school: '테스트중',
    grade: '1',
    class_id: 1,
    is_trial: 0,
    paca_attendance_id: 9001,
    attendance_status: null,
    notes: null,
    ...overrides,
  };
}

describe('student attendance realtime state', () => {
  const slotsData: SlotsData = {
    morning: [],
    afternoon: [],
    evening: [
      makeStudent({ assignment_id: 1, paca_attendance_id: 9001, attendance_status: null }),
      makeStudent({ assignment_id: 2, paca_attendance_id: 9002, attendance_status: 'absent' }),
    ],
  };

  it('updates the matching PACA attendance row only', () => {
    const result = updateStudentStatus(slotsData, 9001, 'present');

    expect(result.matched).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.previousStatus).toBeNull();
    expect(result.slotsData.evening[0].attendance_status).toBe('present');
    expect(result.slotsData.evening[1].attendance_status).toBe('absent');
  });

  it('does not mutate stats when a duplicated socket event repeats the same status', () => {
    const result = updateStudentStatus(slotsData, 9002, 'absent');

    expect(result.matched).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.slotsData).toBe(slotsData);
  });

  it('keeps summary counts correct when a remote update clears attendance', () => {
    const stats = { ...EMPTY_STATS, total: 1, present: 1, unchecked: 0 };

    expect(adjustStats(stats, 'present', null)).toEqual({
      ...EMPTY_STATS,
      total: 1,
      present: 0,
      unchecked: 1,
    });
  });
});
