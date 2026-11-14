import Link from 'next/link';
import type { ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Crown, ExternalLink, Plus, Star, Users } from 'lucide-react';
import type { ClassData, Instructor, Student } from './assignments-model';

export function CompactStudentCard({ student, isDragging }: { student: Student; isDragging?: boolean }) {
  const genderColor = student.gender === 'M' ? 'bg-primary-soft text-primary' : 'bg-pink-100 text-pink-700';
  const isAbsent = student.attendance_status === 'absent';

  return (
    <div
      className={`cursor-grab rounded-md border border-border bg-card px-2 py-1.5 shadow-sm transition active:cursor-grabbing ${
        isDragging ? 'scale-105 border-primary opacity-50 shadow-lg' : ''
      } ${isAbsent ? 'border-destructive/30 bg-destructive-soft opacity-60' : 'hover:border-border'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${genderColor}`}>
          {student.gender === 'M' ? '남' : '여'}
        </span>
        <span className={`max-w-[86px] truncate text-sm font-medium ${
          isAbsent ? 'text-muted-foreground line-through' : 'text-foreground'
        }`}>
          {student.student_name}
        </span>
        <Link
          href={`/students/${student.student_id}`}
          className="rounded p-0.5 transition hover:bg-primary-soft"
          title="학생 프로필"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ExternalLink size={10} className="text-primary" />
        </Link>
        {student.paca_class_name ? (
          <span className="max-w-[64px] truncate rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-secondary-foreground">
            {student.paca_class_name}
          </span>
        ) : null}
        {student.status === 'trial' ? (
          <span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-medium text-purple-700">
            {student.trial_total - student.trial_remaining}/{student.trial_total}
          </span>
        ) : null}
        {isAbsent ? (
          <span className="rounded bg-destructive-soft px-1 py-0.5 text-[9px] font-medium text-destructive">결석</span>
        ) : null}
      </div>
      {isAbsent && student.absence_reason ? (
        <p className="mt-0.5 truncate pl-6 text-[10px] text-destructive" title={student.absence_reason}>
          {student.absence_reason}
        </p>
      ) : null}
    </div>
  );
}

export function DraggableStudent({ student }: { student: Student }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { type: 'student', student },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" {...attributes} {...listeners}>
      <CompactStudentCard student={student} isDragging={isDragging} />
    </div>
  );
}

export function InstructorChip({
  instructor,
  isDragging,
  showMain = false,
}: {
  instructor: Instructor;
  isDragging?: boolean;
  showMain?: boolean;
}) {
  return (
    <div
      className={`flex cursor-grab items-center gap-1 rounded-full border px-2 py-1 transition active:cursor-grabbing ${
        isDragging
          ? 'scale-105 border-primary bg-primary/20 shadow-lg'
          : 'border-primary/30 bg-primary-soft hover:bg-primary-soft'
      }`}
    >
      {showMain && instructor.isMain ? <Star size={12} className="fill-primary text-primary" /> : null}
      {instructor.isOwner ? <Crown size={12} className="text-warning" /> : null}
      <span className="text-sm font-medium text-primary">{instructor.name}</span>
    </div>
  );
}

export function DraggableInstructor({ instructor, showMain = false }: { instructor: Instructor; showMain?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `instructor-${instructor.id}`,
    data: { type: 'instructor', instructor },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" {...attributes} {...listeners}>
      <InstructorChip instructor={instructor} isDragging={isDragging} showMain={showMain} />
    </div>
  );
}

export function WaitingArea({
  waitingStudents,
  waitingInstructors,
}: {
  waitingStudents: Student[];
  waitingInstructors: Instructor[];
}) {
  const { setNodeRef: setStudentRef, isOver: isOverStudents } = useDroppable({ id: 'waiting-students' });
  const { setNodeRef: setInstructorRef, isOver: isOverInstructors } = useDroppable({ id: 'waiting-instructors' });

  return (
    <div className="mb-5 rounded-2xl bg-card">
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <WaitingPanel
          refCallback={setStudentRef}
          isOver={isOverStudents}
          title="학생 대기"
          count={`${waitingStudents.length}명`}
          tone="blue"
        >
          {waitingStudents.map((student) => <DraggableStudent key={student.id} student={student} />)}
          {waitingStudents.length === 0 ? <span className="text-sm text-muted-foreground">대기 중인 학생 없음</span> : null}
        </WaitingPanel>
        <WaitingPanel
          refCallback={setInstructorRef}
          isOver={isOverInstructors}
          title="강사 대기"
          count={`${waitingInstructors.length}명`}
          tone="orange"
        >
          {waitingInstructors.map((instructor) => <DraggableInstructor key={instructor.id} instructor={instructor} />)}
          {waitingInstructors.length === 0 ? <span className="text-sm text-muted-foreground">대기 중인 강사 없음</span> : null}
        </WaitingPanel>
      </div>
    </div>
  );
}

function WaitingPanel({
  refCallback,
  isOver,
  title,
  count,
  tone,
  children,
}: {
  refCallback: (element: HTMLElement | null) => void;
  isOver: boolean;
  title: string;
  count: string;
  tone: 'blue' | 'orange';
  children: ReactNode;
}) {
  const overClass = tone === 'blue'
    ? 'ring-2 ring-primary bg-primary-soft'
    : 'ring-2 ring-primary bg-primary-soft';

  return (
    <div
      ref={refCallback}
      className={`min-h-[92px] rounded-md border border-border bg-muted p-3 transition ${
        isOver ? overClass : ''
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-secondary-foreground">
        <Users size={16} />
        <span className="text-sm font-medium">{title}</span>
        <span className="rounded bg-card px-1.5 py-0.5 text-xs">{count}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function ClassColumn({ classData }: { classData: ClassData }) {
  const { setNodeRef: setStudentRef, isOver: isOverStudents } = useDroppable({
    id: `class-${classData.class_num}-students`,
  });
  const { setNodeRef: setInstructorRef, isOver: isOverInstructors } = useDroppable({
    id: `class-${classData.class_num}-instructors`,
  });
  const mainInstructor = classData.instructors.find((instructor) => instructor.isMain);
  const className = mainInstructor ? `${mainInstructor.name}반` : `${classData.class_num}반`;

  return (
    <div className="flex w-56 flex-col overflow-hidden rounded-2xl bg-card">
      <div className="bg-primary px-3 py-2 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{className}</span>
          <span className="shrink-0 rounded bg-card/20 px-1.5 py-0.5 text-xs">{classData.students.length}명</span>
        </div>
      </div>
      <div
        ref={setInstructorRef}
        className={`min-h-[44px] border-b border-border bg-primary-soft p-2 transition ${
          isOverInstructors ? 'bg-primary-soft ring-2 ring-inset ring-primary' : ''
        }`}
      >
        <div className="flex flex-wrap gap-1">
          {classData.instructors.map((instructor) => (
            <DraggableInstructor key={instructor.id} instructor={instructor} showMain />
          ))}
          {classData.instructors.length === 0 ? <span className="text-xs text-primary">강사 배치 필요</span> : null}
        </div>
      </div>
      <div
        ref={setStudentRef}
        className={`min-h-[140px] flex-1 overflow-y-auto p-2 transition ${
          isOverStudents ? 'bg-primary-soft ring-2 ring-inset ring-primary' : ''
        }`}
      >
        <div className="space-y-1.5">
          {classData.students.map((student) => <DraggableStudent key={student.id} student={student} />)}
          {classData.students.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">학생을 드래그하세요</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NewClassZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'new-class' });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[220px] w-56 flex-col items-center justify-center rounded-md border-2 border-dashed transition ${
        isOver
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-card hover:border-muted-foreground/40'
      }`}
    >
      <Plus size={30} className={isOver ? 'text-primary' : 'text-muted-foreground'} />
      <span className={`mt-2 text-sm font-medium ${isOver ? 'text-primary' : 'text-muted-foreground'}`}>
        새 반 생성
      </span>
      <span className="mt-1 text-xs text-muted-foreground">강사를 드롭하세요</span>
    </div>
  );
}
