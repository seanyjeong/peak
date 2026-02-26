'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Layers, Plus, Trash2, RefreshCw, Users, UserCheck, Edit3, X, Check, ChevronDown } from 'lucide-react';
import apiClient from '@/lib/api/client';

interface Student {
  id?: number;
  student_id: number;
  name: string;
  gender: string;
  grade: string;
  school: string;
  status: string;
}

interface Group {
  id: number;
  name: string;
  instructor_id: number | null;
  instructor_name?: string;
  order_num: number;
  members: Student[];
}

interface Preset {
  id: number;
  name: string;
  type: 'homeroom' | 'group';
  is_active: boolean;
  groups: Group[];
}

interface InstructorOption {
  id: number;
  name: string;
  isOwner: boolean;
}

// Draggable student pill
function DragStudentPill({ student, groupId }: { student: Student; groupId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `student-${groupId}-${student.student_id}`,
    data: { type: 'student', student, fromGroup: groupId },
  });

  const genderColor = student.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 rounded-lg border cursor-grab active:cursor-grabbing text-sm transition ${
        isDragging ? 'opacity-40 border-orange-400' : 'hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${genderColor}`}>
        {student.gender === 'M' ? '남' : '여'}
      </span>
      <span className="text-slate-800 dark:text-slate-100 truncate max-w-[60px]">{student.name}</span>
    </div>
  );
}

// Static student pill (for overlay)
function StudentPill({ student }: { student: Student }) {
  const genderColor = student.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700';
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg border border-orange-400 shadow-lg text-sm">
      <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${genderColor}`}>
        {student.gender === 'M' ? '남' : '여'}
      </span>
      <span className="text-slate-800 truncate max-w-[60px]">{student.name}</span>
    </div>
  );
}

// Droppable group column
function GroupColumn({
  group,
  preset,
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
    onUpdateGroup(group.id, { instructor_id: instructorId } as Partial<Group>);
    setShowInstructorPicker(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`w-56 flex-shrink-0 rounded-xl border-2 transition ${
        isOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      {/* Group Header */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-1.5">
          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                className="flex-1 px-2 py-0.5 text-sm border rounded bg-white dark:bg-slate-700 dark:text-white"
                autoFocus
              />
              <button onClick={handleSaveName} className="p-0.5 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
              <button onClick={() => setEditing(false)} className="p-0.5 text-slate-400 hover:bg-slate-50 rounded"><X size={14} /></button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{group.name}</h3>
              <div className="flex items-center gap-0.5">
                <button onClick={() => { setEditName(group.name); setEditing(true); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Edit3 size={12} /></button>
                <button onClick={() => onDeleteGroup(group.id)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={12} /></button>
              </div>
            </>
          )}
        </div>

        {/* Instructor */}
        <div className="relative">
          <button
            onClick={() => setShowInstructorPicker(!showInstructorPicker)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-600 transition"
          >
            <span className={group.instructor_name ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
              {group.instructor_name || '강사 선택'}
            </span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {showInstructorPicker && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-20 max-h-40 overflow-auto">
              <button
                onClick={() => handlePickInstructor(null)}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                선택 안 함
              </button>
              {instructors.map(inst => (
                <button
                  key={inst.id}
                  onClick={() => handlePickInstructor(inst.id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 ${
                    inst.id === group.instructor_id ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {inst.name} {inst.isOwner && '(원장)'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Students */}
      <div className="p-2 min-h-[80px] flex flex-wrap gap-1.5 content-start">
        {group.members.map(s => (
          <DragStudentPill key={s.student_id} student={s} groupId={String(group.id)} />
        ))}
        {group.members.length === 0 && (
          <p className="w-full text-center text-slate-300 dark:text-slate-600 text-xs py-4">학생을 드래그하세요</p>
        )}
      </div>

      <div className="px-3 pb-2 text-right">
        <span className="text-[11px] text-slate-400">{group.members.length}명</span>
      </div>
    </div>
  );
}

// Droppable unassigned area
function UnassignedArea({ students }: { students: Student[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-3 transition ${
        isOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Users size={14} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">미배정 학생</span>
        <span className="text-xs text-slate-400">({students.length}명)</span>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[40px]">
        {students.map(s => (
          <DragStudentPill key={s.student_id} student={s} groupId="unassigned" />
        ))}
        {students.length === 0 && (
          <p className="text-xs text-slate-300 dark:text-slate-600 py-2">모든 학생이 그룹에 배정되었습니다</p>
        )}
      </div>
    </div>
  );
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<number | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetType, setNewPresetType] = useState<'homeroom' | 'group'>('homeroom');
  const [activeItem, setActiveItem] = useState<{ student: Student } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchPresets = useCallback(async () => {
    try {
      const res = await apiClient.get('/presets');
      setPresets(res.data.presets);
      if (res.data.presets.length > 0 && !activePresetId) {
        setActivePresetId(res.data.presets[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch presets:', e);
    }
  }, [activePresetId]);

  const fetchStudents = useCallback(async () => {
    try {
      // Get active + trial students for preset assignment
      const res = await apiClient.get('/students?status=active,trial');
      setAllStudents(res.data.students || []);
    } catch (e) {
      console.error('Failed to fetch students:', e);
    }
  }, []);

  const fetchInstructors = useCallback(async () => {
    try {
      const res = await apiClient.get('/presets/instructors');
      const list = res.data.instructors || [];
      setInstructors(list.map((inst: any) => ({ id: inst.id, name: inst.name, isOwner: inst.id < 0 })));
    } catch (e) {
      console.error('Failed to fetch instructors:', e);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPresets(), fetchStudents(), fetchInstructors()])
      .finally(() => setLoading(false));
  }, [fetchPresets, fetchStudents, fetchInstructors]);

  const activePreset = presets.find(p => p.id === activePresetId) || null;

  // Unassigned students = all active students NOT in any group of the active preset
  const assignedStudentIds = new Set(
    activePreset?.groups.flatMap(g => g.members.map(m => m.student_id)) || []
  );
  const unassignedStudents = allStudents
    .filter(s => !assignedStudentIds.has(s.id as number))
    .map(s => ({
      student_id: s.id ?? s.student_id,
      name: s.name,
      gender: s.gender,
      grade: s.grade,
      school: s.school,
      status: s.status,
    }));

  // Create preset
  const handleCreatePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      const res = await apiClient.post('/presets', { name: newPresetName.trim(), type: newPresetType });
      setActivePresetId(res.data.id);
      setShowNewPreset(false);
      setNewPresetName('');
      await fetchPresets();
    } catch (e) {
      console.error('Failed to create preset:', e);
    }
  };

  // Delete preset
  const handleDeletePreset = async (id: number) => {
    if (!confirm('이 프리셋을 삭제하시겠습니까? 모든 그룹과 학생 배정이 삭제됩니다.')) return;
    try {
      await apiClient.delete(`/presets/${id}`);
      if (activePresetId === id) setActivePresetId(null);
      await fetchPresets();
    } catch (e) {
      console.error('Failed to delete preset:', e);
    }
  };

  // Add group
  const handleAddGroup = async () => {
    if (!activePresetId) return;
    try {
      await apiClient.post(`/presets/${activePresetId}/groups`, {
        name: activePreset?.type === 'homeroom' ? '새 담임반' : '새 그룹',
      });
      await fetchPresets();
    } catch (e) {
      console.error('Failed to add group:', e);
    }
  };

  // Update group
  const handleUpdateGroup = async (groupId: number, data: Partial<Group>) => {
    try {
      await apiClient.put(`/presets/groups/${groupId}`, data);
      await fetchPresets();
    } catch (e) {
      console.error('Failed to update group:', e);
    }
  };

  // Delete group
  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('이 그룹을 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/presets/groups/${groupId}`);
      await fetchPresets();
    } catch (e) {
      console.error('Failed to delete group:', e);
    }
  };

  // D&D handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.type === 'student') {
      setActiveItem({ student: data.student });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !active.data.current) return;

    const { student, fromGroup } = active.data.current;
    const toGroup = String(over.id).replace('group-', '');

    if (fromGroup === toGroup) return;

    try {
      // Remove from old group
      if (fromGroup !== 'unassigned') {
        await apiClient.delete(`/presets/groups/${fromGroup}/members`, {
          data: { student_ids: [student.student_id] }
        });
      }

      // Add to new group
      if (toGroup !== 'unassigned') {
        await apiClient.post(`/presets/groups/${toGroup}/members`, {
          student_ids: [student.student_id]
        });
      }

      await fetchPresets();
    } catch (e) {
      console.error('Failed to move student:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">반 프리셋</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">자동 반배치를 위한 학생 그룹 설정</p>
        </div>
        <button
          onClick={() => setShowNewPreset(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          <Plus size={18} />
          <span>새 프리셋</span>
        </button>
      </div>

      {/* New Preset Modal */}
      {showNewPreset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">새 프리셋 만들기</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">프리셋 이름</label>
                <input
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  placeholder="예: 담임제, 대학별"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreatePreset()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">타입</label>
                <div className="flex gap-2">
                  {[
                    { key: 'homeroom' as const, label: '담임제', desc: '강사별 고정 학생' },
                    { key: 'group' as const, label: '그룹별', desc: '이름 기반 자유 그룹' },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setNewPresetType(t.key)}
                      className={`flex-1 p-3 rounded-lg border-2 text-left transition ${
                        newPresetType === t.key
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{t.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowNewPreset(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">취소</button>
              <button onClick={handleCreatePreset} disabled={!newPresetName.trim()} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">만들기</button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Tabs */}
      {presets.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {presets.map(p => (
            <div key={p.id} className="flex items-center">
              <button
                onClick={() => setActivePresetId(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activePresetId === p.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Layers size={14} />
                <span>{p.name}</span>
                <span className={`text-xs px-1.5 rounded-full ${activePresetId === p.id ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  {p.type === 'homeroom' ? '담임' : '그룹'}
                </span>
              </button>
              {activePresetId === p.id && (
                <button
                  onClick={() => handleDeletePreset(p.id)}
                  className="ml-1 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                  title="프리셋 삭제"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {presets.length === 0 && (
        <div className="flex flex-col items-center justify-center h-80 text-slate-400 dark:text-slate-500">
          <Layers size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium mb-1">프리셋이 없습니다</p>
          <p className="text-sm">새 프리셋을 만들어 자동 반배치를 설정하세요</p>
        </div>
      )}

      {/* Active Preset Content */}
      {activePreset && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Unassigned Students */}
          <div className="mb-4">
            <UnassignedArea students={unassignedStudents} />
          </div>

          {/* Groups */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {activePreset.groups.map(group => (
              <GroupColumn
                key={group.id}
                group={group}
                preset={activePreset}
                instructors={instructors}
                onUpdateGroup={handleUpdateGroup}
                onDeleteGroup={handleDeleteGroup}
              />
            ))}

            {/* Add Group */}
            <button
              onClick={handleAddGroup}
              className="w-48 flex-shrink-0 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition flex flex-col items-center justify-center gap-2 min-h-[200px]"
            >
              <Plus size={24} className="text-slate-300 dark:text-slate-600" />
              <span className="text-sm text-slate-400 dark:text-slate-500">그룹 추가</span>
            </button>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeItem && <StudentPill student={activeItem.student} />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
