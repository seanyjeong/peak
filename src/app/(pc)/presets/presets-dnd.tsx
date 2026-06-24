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
      className={`inline-flex cursor-grab items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm shadow-sm transition active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 ${
        isDragging ? 'border-orange-400 opacity-40' : 'hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <GenderBadge gender={student.gender} />
      <span className="max-w-[72px] truncate text-slate-800 dark:text-slate-100">{student.name}</span>
    </div>
  );
}

export function StudentPill({ student }: { student: Student }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-orange-400 bg-white px-2 py-1 text-sm shadow-lg">
      <GenderBadge gender={student.gender} />
      <span className="max-w-[72px] truncate text-slate-800">{student.name}</span>
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
      className={`w-60 shrink-0 rounded-md border-2 bg-white transition dark:bg-slate-900 ${
        isOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="border-b border-slate-100 p-3 dark:border-slate-800">
        <div className="mb-2 flex items-center justify-between gap-2">
          {editing ? (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSaveName()}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                autoFocus
              />
              <button onClick={handleSaveName} className="rounded p-1 text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
              <button onClick={() => setEditing(false)} className="rounded p-1 text-slate-400 hover:bg-slate-50"><X size={14} /></button>
            </div>
          ) : (
            <>
              <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{group.name}</h3>
              <div className="flex items-center gap-0.5">
                <button onClick={() => { setEditName(group.name); setEditing(true); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                  <Edit3 size={12} />
                </button>
                <button onClick={() => onDeleteGroup(group.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowInstructorPicker((open) => !open)}
            className="flex w-full items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-xs transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <span className={group.instructor_name ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
              {group.instructor_name || '강사 선택'}
            </span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {showInstructorPicker ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
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
          <p className="w-full py-4 text-center text-xs text-slate-300 dark:text-slate-600">학생을 드래그하세요</p>
        ) : null}
      </div>
      <div className="px-3 pb-2 text-right text-[11px] text-slate-400">{group.members.length}명</div>
    </div>
  );
}

export function UnassignedArea({ students }: { students: Student[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border-2 border-dashed bg-white p-3 transition dark:bg-slate-900 ${
        isOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Users size={14} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">미배정 학생</span>
        <span className="text-xs text-slate-400">{students.length}명</span>
      </div>
      <div className="flex min-h-[44px] flex-wrap gap-1.5">
        {students.map((student) => (
          <DragStudentPill key={student.student_id} student={student} groupId="unassigned" />
        ))}
        {students.length === 0 ? <p className="py-2 text-xs text-slate-300 dark:text-slate-600">모든 학생이 그룹에 배정되었습니다.</p> : null}
      </div>
    </div>
  );
}

function InstructorOptionButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
        active ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/30' : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function GenderBadge({ gender }: { gender: string }) {
  const genderColor = gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700';
  return <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${genderColor}`}>{gender === 'M' ? '남' : '여'}</span>;
}
