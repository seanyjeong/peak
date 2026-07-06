import {
  collectVisibleClassStudents,
  filterVisiblePlans,
  getMobileInstructorOptionsFromClasses,
  isClassVisibleToMobileUser,
} from '@/app/mobile/_lib/class-scope';

const classes = [
  {
    class_num: 1,
    instructors: [{ id: 7, name: '김코치' }],
    students: [{ student_id: 101, student_name: '학생A' }],
  },
  {
    class_num: 2,
    instructors: [{ id: 8, name: '이코치' }],
    students: [{ student_id: 102, student_name: '학생B' }],
  },
];

describe('mobile class scope', () => {
  it('shows every class to owners even when the owner is not assigned', () => {
    const owner = { id: 1, role: 'owner' };

    expect(isClassVisibleToMobileUser(classes[0], owner)).toBe(true);
    expect(collectVisibleClassStudents(classes, owner)).toEqual([
      { student_id: 101, student_name: '학생A' },
      { student_id: 102, student_name: '학생B' },
    ]);
  });

  it('lets owners narrow visible classes by selected instructor', () => {
    const owner = { id: 1, role: 'owner' };

    expect(isClassVisibleToMobileUser(classes[0], owner, 7)).toBe(true);
    expect(isClassVisibleToMobileUser(classes[1], owner, 7)).toBe(false);
    expect(collectVisibleClassStudents(classes, owner, 7)).toEqual([
      { student_id: 101, student_name: '학생A' },
    ]);
  });

  it('shows only directly assigned classes to staff users', () => {
    const staff = { id: 20, role: 'staff', instructorId: 8 };

    expect(isClassVisibleToMobileUser(classes[0], staff)).toBe(false);
    expect(isClassVisibleToMobileUser(classes[1], staff)).toBe(true);
    expect(collectVisibleClassStudents(classes, staff)).toEqual([
      { student_id: 102, student_name: '학생B' },
    ]);
  });

  it('does not filter plans by instructor for owners and admins', () => {
    const plans = [{ id: 1, instructor_id: 7 }, { id: 2, instructor_id: 8 }];

    expect(filterVisiblePlans(plans, { id: 1, role: 'owner' })).toEqual(plans);
    expect(filterVisiblePlans(plans, { id: 2, role: 'admin' })).toEqual(plans);
    expect(filterVisiblePlans(plans, { id: 1, role: 'owner' }, 7)).toEqual([
      { id: 1, instructor_id: 7 },
    ]);
    expect(filterVisiblePlans(plans, { id: 3, role: 'staff', instructorId: 8 })).toEqual([
      { id: 2, instructor_id: 8 },
    ]);
  });

  it('builds unique instructor filter options from visible classes', () => {
    expect(getMobileInstructorOptionsFromClasses(classes)).toEqual([
      { id: 7, name: '김코치' },
      { id: 8, name: '이코치' },
    ]);
  });
});
