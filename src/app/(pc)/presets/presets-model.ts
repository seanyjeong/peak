export interface Student {
  id?: number;
  student_id: number;
  name: string;
  gender: string;
  grade: string;
  school: string;
  status: string;
  branch_id?: number | null; // P-ACA 지점(지점을 쓰는 학원만)
}

export interface Group {
  id: number;
  name: string;
  instructor_id: number | null;
  instructor_name?: string;
  order_num: number;
  members: Student[];
}

export interface Preset {
  id: number;
  name: string;
  type: 'homeroom' | 'group';
  is_active: boolean;
  branch_id?: number | null; // P-ACA 지점. 없으면 지점 없는 프리셋
  groups: Group[];
}

export interface InstructorOption {
  id: number;
  name: string;
  isOwner: boolean;
}

export type NewPresetType = 'homeroom' | 'group';

export function getPresetTypeLabel(type: NewPresetType) {
  return type === 'homeroom' ? '담임' : '그룹';
}

export function toPresetStudent(student: Student): Student {
  return {
    student_id: student.id ?? student.student_id,
    name: student.name,
    gender: student.gender,
    grade: student.grade,
    school: student.school,
    status: student.status,
  };
}
