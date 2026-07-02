'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Layers, Plus, RefreshCw, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import {
  getPresetTypeLabel,
  toPresetStudent,
  type Group,
  type InstructorOption,
  type NewPresetType,
  type Preset,
  type Student,
} from './presets-model';
import { GroupColumn, StudentPill, UnassignedArea } from './presets-dnd';

export default function PresetsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<number | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetType, setNewPresetType] = useState<NewPresetType>('homeroom');
  const [activeItem, setActiveItem] = useState<{ student: Student } | null>(null);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const fetchPresets = useCallback(async () => {
    const res = await apiClient.get<{ presets?: Preset[] }>('/presets');
    const nextPresets = res.data.presets || [];
    setPresets(nextPresets);
    setActivePresetId((current) => current || nextPresets[0]?.id || null);
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      await apiClient.post('/students/sync', {});
    } catch {
      // 동기화가 실패해도 프리셋 화면은 기존 Peak 학생 목록으로 계속 열어준다.
    }

    const res = await apiClient.get<{ students?: Student[] }>('/students?status=active');
    setAllStudents(res.data.students || []);
  }, []);

  const fetchInstructors = useCallback(async () => {
    const res = await apiClient.get<{ instructors?: Array<{ id: number; name: string }> }>('/presets/instructors');
    setInstructors((res.data.instructors || []).map((instructor) => ({
      id: instructor.id,
      name: instructor.name,
      isOwner: instructor.id < 0,
    })));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchPresets(), fetchStudents(), fetchInstructors()]);
    } catch {
      toastRef.current.error('프리셋 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [fetchInstructors, fetchPresets, fetchStudents]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activePreset = presets.find((preset) => preset.id === activePresetId) || null;
  const assignedStudentIds = useMemo(() => new Set(
    activePreset?.groups.flatMap((group) => group.members.map((member) => member.student_id)) || []
  ), [activePreset]);
  const unassignedStudents = allStudents
    .filter((student) => !assignedStudentIds.has(student.id ?? student.student_id))
    .map(toPresetStudent);
  const assignedCount = activePreset?.groups.reduce((sum, group) => sum + group.members.length, 0) || 0;

  const handleCreatePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      const res = await apiClient.post<{ id: number }>('/presets', { name: newPresetName.trim(), type: newPresetType });
      setActivePresetId(res.data.id);
      setShowNewPreset(false);
      setNewPresetName('');
      await fetchPresets();
      toastRef.current.success('새 프리셋을 만들었습니다.');
    } catch {
      toastRef.current.error('프리셋을 만들지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleDeletePreset = async (id: number) => {
    if (!confirm('이 프리셋을 삭제하시겠습니까? 모든 그룹과 학생 배정이 삭제됩니다.')) return;
    try {
      await apiClient.delete(`/presets/${id}`);
      setActivePresetId((current) => (current === id ? null : current));
      await fetchPresets();
    } catch {
      toastRef.current.error('프리셋을 삭제하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleAddGroup = async () => {
    if (!activePresetId) return;
    try {
      await apiClient.post(`/presets/${activePresetId}/groups`, {
        name: activePreset?.type === 'homeroom' ? '새 담임반' : '새 그룹',
      });
      await fetchPresets();
    } catch {
      toastRef.current.error('그룹을 추가하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleUpdateGroup = async (groupId: number, data: Partial<Group>) => {
    try {
      await apiClient.put(`/presets/groups/${groupId}`, data);
      await fetchPresets();
    } catch {
      toastRef.current.error('그룹 정보를 저장하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('이 그룹을 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/presets/groups/${groupId}`);
      await fetchPresets();
    } catch {
      toastRef.current.error('그룹을 삭제하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'student') setActiveItem({ student: data.student });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !active.data.current) return;

    const { student, fromGroup } = active.data.current;
    const toGroup = String(over.id).replace('group-', '');
    if (fromGroup === toGroup) return;

    try {
      if (fromGroup !== 'unassigned') {
        await apiClient.delete(`/presets/groups/${fromGroup}/members`, {
          data: { student_ids: [student.student_id] },
        });
      }
      if (toGroup !== 'unassigned') {
        await apiClient.post(`/presets/groups/${toGroup}/members`, {
          student_ids: [student.student_id],
        });
      }
      await fetchPresets();
    } catch {
      toastRef.current.error('학생 배정을 저장하지 못했습니다. 다시 시도해주세요.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center" data-testid="presets-loading">
        <RefreshCw size={18} className="mr-2 animate-spin text-orange-500" />
        <span className="text-sm text-slate-500 dark:text-slate-400">프리셋 데이터를 불러오는 중입니다.</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6" data-testid="presets-page">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Preset Desk</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">반 프리셋</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">자동 반 배치에 사용할 학생 그룹과 담당 강사를 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowNewPreset(true)}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-medium text-white transition hover:bg-orange-700"
        >
          <Plus size={16} />
          새 프리셋
        </button>
      </header>

      <section className="grid gap-3 md:grid-cols-3" aria-label="프리셋 요약">
        <Metric label="프리셋" value={`${presets.length}개`} detail="사용 가능한 구성" />
        <Metric label="배정 학생" value={`${assignedCount}명`} detail={activePreset ? activePreset.name : '선택 없음'} />
        <Metric label="미배정" value={`${unassignedStudents.length}명`} detail="그룹 이동 가능" />
      </section>

      {showNewPreset ? (
        <NewPresetModal
          name={newPresetName}
          type={newPresetType}
          onNameChange={setNewPresetName}
          onTypeChange={setNewPresetType}
          onCancel={() => setShowNewPreset(false)}
          onSubmit={handleCreatePreset}
        />
      ) : null}

      {presets.length === 0 ? (
        <EmptyPresetState onCreate={() => setShowNewPreset(true)} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center">
                <button
                  onClick={() => setActivePresetId(preset.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition ${
                    activePresetId === preset.id
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layers size={14} />
                  {preset.name}
                  <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                    {getPresetTypeLabel(preset.type)}
                  </span>
                </button>
                {activePresetId === preset.id ? (
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="ml-1 rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                    title="프리셋 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {activePreset ? (
            <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <UnassignedArea students={unassignedStudents} />
              <div className="flex gap-4 overflow-x-auto pb-4" data-testid="preset-groups">
                {activePreset.groups.map((group) => (
                  <GroupColumn
                    key={group.id}
                    group={group}
                    preset={activePreset}
                    instructors={instructors}
                    onUpdateGroup={handleUpdateGroup}
                    onDeleteGroup={handleDeleteGroup}
                  />
                ))}
                <button
                  onClick={handleAddGroup}
                  className="flex min-h-[220px] w-52 shrink-0 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 bg-white transition hover:border-orange-400 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-orange-950/30"
                >
                  <Plus size={24} className="text-slate-300 dark:text-slate-600" />
                  <span className="text-sm text-slate-400 dark:text-slate-500">그룹 추가</span>
                </button>
              </div>
              <DragOverlay>{activeItem ? <StudentPill student={activeItem.student} /> : null}</DragOverlay>
            </DndContext>
          ) : null}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-slate-50">{value}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </article>
  );
}

function NewPresetModal({
  name,
  type,
  onNameChange,
  onTypeChange,
  onCancel,
  onSubmit,
}: {
  name: string;
  type: NewPresetType;
  onNameChange: (name: string) => void;
  onTypeChange: (type: NewPresetType) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-md bg-white p-6 shadow-xl dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">새 프리셋 만들기</h3>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">프리셋 이름</span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="예: 담임제, 대학별"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <TypeButton active={type === 'homeroom'} label="담임제" detail="강사별 고정 학생" onClick={() => onTypeChange('homeroom')} />
            <TypeButton active={type === 'group'} label="그룹별" detail="자유 그룹 구성" onClick={() => onTypeChange('group')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">취소</button>
          <button onClick={onSubmit} disabled={!name.trim()} className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50">만들기</button>
        </div>
      </div>
    </div>
  );
}

function TypeButton({ active, label, detail, onClick }: { active: boolean; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border-2 p-3 text-left transition ${
        active ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
      }`}
    >
      <p className="text-sm font-medium text-slate-950 dark:text-slate-50">{label}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </button>
  );
}

function EmptyPresetState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-md border border-slate-200 bg-white text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Layers size={44} className="text-slate-300 dark:text-slate-600" />
      <p className="mt-4 font-medium text-slate-700 dark:text-slate-200">프리셋이 없습니다.</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">새 프리셋을 만들어 자동 반 배치를 준비하세요.</p>
      <button onClick={onCreate} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700">
        <Plus size={16} />
        새 프리셋
      </button>
    </div>
  );
}
