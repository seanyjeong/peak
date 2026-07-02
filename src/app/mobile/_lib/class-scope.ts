interface MobileInstructor {
  id: number;
}

interface MobileClass<TStudent> {
  instructors?: MobileInstructor[];
  students?: TStudent[];
}

interface MobilePlan {
  instructor_id: number;
}

export interface MobileScopeUser {
  id?: number;
  role?: string | null;
  instructorId?: number | null;
}

export function isOwnerOrAdmin(user: MobileScopeUser | null | undefined): boolean {
  return user?.role === 'owner' || user?.role === 'admin';
}

function getScopedInstructorIds(user: MobileScopeUser | null | undefined) {
  return new Set([user?.instructorId].filter((id): id is number => typeof id === 'number'));
}

export function isClassVisibleToMobileUser<TStudent>(
  classData: MobileClass<TStudent>,
  user: MobileScopeUser | null | undefined
): boolean {
  if (isOwnerOrAdmin(user)) return true;

  const scopedInstructorIds = getScopedInstructorIds(user);
  return classData.instructors?.some(instructor => scopedInstructorIds.has(instructor.id)) ?? false;
}

export function collectVisibleClassStudents<TStudent>(
  classes: MobileClass<TStudent>[],
  user: MobileScopeUser | null | undefined
): TStudent[] {
  return classes.flatMap(classData =>
    isClassVisibleToMobileUser(classData, user) ? classData.students || [] : []
  );
}

export function filterVisiblePlans<TPlan extends MobilePlan>(
  plans: TPlan[],
  user: MobileScopeUser | null | undefined
): TPlan[] {
  if (isOwnerOrAdmin(user)) return plans;

  const scopedInstructorIds = getScopedInstructorIds(user);
  return plans.filter(plan => scopedInstructorIds.has(plan.instructor_id));
}
