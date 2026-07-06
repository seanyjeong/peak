interface MobileInstructor {
  id: number;
  name?: string;
  isOwner?: boolean;
}

interface MobileClass<TStudent> {
  instructors?: MobileInstructor[];
  students?: TStudent[];
}

interface MobilePlan {
  instructor_id: number;
}

export interface MobileInstructorOption {
  id: number;
  name: string;
  isOwner?: boolean;
}

export interface MobileScopeUser {
  id?: number;
  role?: string | null;
  instructorId?: number | null;
}

export function isOwnerOrAdmin(user: MobileScopeUser | null | undefined): boolean {
  return user?.role === 'owner' || user?.role === 'admin';
}

function getScopedInstructorId(user: MobileScopeUser | null | undefined, selectedInstructorId?: number | null) {
  if (isOwnerOrAdmin(user)) return selectedInstructorId ?? null;
  return typeof user?.instructorId === 'number' ? user.instructorId : null;
}

export function isClassVisibleToMobileUser<TStudent>(
  classData: MobileClass<TStudent>,
  user: MobileScopeUser | null | undefined,
  selectedInstructorId?: number | null
): boolean {
  const scopedInstructorId = getScopedInstructorId(user, selectedInstructorId);
  if (isOwnerOrAdmin(user) && scopedInstructorId === null) return true;
  if (scopedInstructorId === null) return false;

  return classData.instructors?.some(instructor => instructor.id === scopedInstructorId) ?? false;
}

export function collectVisibleClassStudents<TStudent>(
  classes: MobileClass<TStudent>[],
  user: MobileScopeUser | null | undefined,
  selectedInstructorId?: number | null
): TStudent[] {
  return classes.flatMap(classData =>
    isClassVisibleToMobileUser(classData, user, selectedInstructorId) ? classData.students || [] : []
  );
}

export function filterVisiblePlans<TPlan extends MobilePlan>(
  plans: TPlan[],
  user: MobileScopeUser | null | undefined,
  selectedInstructorId?: number | null
): TPlan[] {
  const scopedInstructorId = getScopedInstructorId(user, selectedInstructorId);
  if (isOwnerOrAdmin(user) && scopedInstructorId === null) return plans;
  if (scopedInstructorId === null) return [];

  return plans.filter(plan => plan.instructor_id === scopedInstructorId);
}

export function getMobileInstructorOptionsFromClasses<TStudent>(
  classes: MobileClass<TStudent>[]
): MobileInstructorOption[] {
  const options = new Map<number, MobileInstructorOption>();

  classes.forEach((classData) => {
    classData.instructors?.forEach((instructor) => {
      if (options.has(instructor.id)) return;
      options.set(instructor.id, {
        id: instructor.id,
        name: instructor.name || (instructor.isOwner ? '원장' : `강사 ${Math.abs(instructor.id)}`),
        isOwner: instructor.isOwner,
      });
    });
  });

  return Array.from(options.values());
}
