import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Check, ChevronDown, Edit3, Trash2, Users, X } from 'lucide-react';
import type { Group, InstructorOption, Preset, Student } from './presets-model';

export function DragStudentPill({ student, groupId }: { student: Student; groupId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `student-${groupId}-${student.student_id}`,
    data: { type: 'student', student, fromGroup: groupId },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`inline-flex cursor-grab items-center gap-1 rounded-lg bg-card px-2 py-1 text-sm transition active:cursor-grabbing ${
        isDragging ? 'opacity-40 ring-2 ring-primary' : ''
      }`}
    >
      <GenderBadge gender={student.gender} />
      <span className="max-w-[72px] truncate text-foreground">{student.name}</span>
    </div>
  );
}

export function StudentPill({ student }: { student: Student }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-sm shadow-lg ring-2 ring-primary">
      <GenderBadge gender={student.gender} />
      <span className="max-w-[72px] truncate text-foreground">{student.name}</span>
    </div>
  );
}

export function GroupColumn({
  group,
  instructors,
  onUpdateGroup,
  onDeleteGroup,
}: {
  group: Group;
  preset: Preset;
  instructors: InstructorOption[];
  onUpdateGroup: (groupId: number, data: Partial<Group>) => void;
  onDeleteGroup: (groupId: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${group.id}` });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [showInstructorPicker, setShowInstructorPicker] = useState(false);

  const handleSaveName = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdateGroup(group.id, { name: editName.trim() });
    }
    setEditing(false);
  };

  const handlePickInstructor = (instructorId: number | null) => {
    if (instructorId === null) {
      onUpdateGroup(group.id, { instructor_id: null });
      setShowInstructorPicker(false);
      return;
    }

    const instructor = instructors.find((item) => item.id === instructorId);
    onUpdateGroup(group.id, {
      instructor_id: instructorId,
      ...(instructor ? { name: `${instructor.name}반` } : {}),
    });
    setShowInstructorPicker(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`w-60 shrink-0 rounded-xl transition ${
        isOver ? 'bg-primary-soft ring-2 ring-primary' : 'bg-muted'
      }`}
    >
      <div className="p-3 pb-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          {editing ? (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSaveName()}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-card px-2 py-1 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <button onClick={handleSaveName} className="rounded p-1 text-success hover:bg-success-soft"><Check size={14} /></button>
              <button onClick={() => setEditing(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={14} /></button>
            </div>
          ) : (
            <>
              <h3 className="truncate text-sm font-semibold text-foreground">{group.name}</h3>
              <div className="flex items-center gap-0.5">
                <button onClick={() => { setEditName(group.name); setEditing(true); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-secondary-foreground">
                  <Edit3 size={12} />
                </button>
                <button onClick={() => onDeleteGroup(group.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive-soft hover:text-destructive">
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowInstructorPicker((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg bg-card px-2.5 py-1.5 text-xs transition hover:bg-card/70"
          >
            <span className={group.instructor_name ? 'text-secondary-foreground' : 'text-muted-foreground'}>
              {group.instructor_name || '강사 선택'}
            </span>
            <ChevronDown size={12} className="text-muted-foreground" />
          </button>
          {showInstructorPicker ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-auto rounded-xl bg-popover p-1 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
              <InstructorOptionButton label="선택 안 함" onClick={() => handlePickInstructor(null)} />
              {instructors.map((instructor) => (
                <InstructorOptionButton
                  key={instructor.id}
                  label={`${instructor.name}${instructor.isOwner ? ' (원장)' : ''}`}
                  active={instructor.id === group.instructor_id}
                  onClick={() => handlePickInstructor(instructor.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-[92px] flex-wrap content-start gap-1.5 p-2">
        {group.members.map((student) => (
          <DragStudentPill key={student.student_id} student={student} groupId={String(group.id)} />
        ))}
        {group.members.length === 0 ? (
          <p className="w-full py-4 text-center text-xs text-muted-foreground/60">학생을 드래그하세요</p>
        ) : null}
      </div>
      <div className="px-3 pb-2 text-right text-[11px] text-muted-foreground">{group.members.length}명</div>
    </div>
  );
}

export function UnassignedArea({ students }: { students: Student[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-3 transition ${
        isOver ? 'bg-primary-soft ring-2 ring-primary' : 'bg-muted'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Users size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium text-secondary-foreground">미배정 학생</span>
        <span className="text-xs text-muted-foreground">{students.length}명</span>
      </div>
      <div className="flex min-h-[44px] flex-wrap gap-1.5">
        {students.map((student) => (
          <DragStudentPill key={student.student_id} student={student} groupId="unassigned" />
        ))}
        {students.length === 0 ? <p className="py-2 text-xs text-muted-foreground/60">모든 학생이 그룹에 배정되었습니다.</p> : null}
      </div>
    </div>
  );
}

function InstructorOptionButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-left text-xs transition hover:bg-muted ${
        active ? 'bg-primary-soft text-primary' : 'text-secondary-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function GenderBadge({ gender }: { gender: string }) {
  const genderColor = gender === 'M' ? 'bg-primary-soft text-primary' : gender === 'F' ? 'bg-pink-500/15 text-pink-600' : 'bg-muted text-muted-foreground';
  return <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${genderColor}`}>{gender === 'M' ? '남' : gender === 'F' ? '여' : '성별?'}</span>;
}
