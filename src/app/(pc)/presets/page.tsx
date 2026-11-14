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
import { BranchTabs } from '@/components/BranchTabs';
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
import { PageHeader, StatTile, chipClass } from '@/components/ui/page';

export default function PresetsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [allPresets, setAllPresets] = useState<Preset[]>([]);
  // P-ACA 지점. null = 지점 없는 프리셋(지점이 없는 학원은 늘 null)
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
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
    const res = await apiClient.get<{ presets?: Preset[]; branches?: Array<{ id: number; name: string }> }>('/presets');
    setAllPresets(res.data.presets || []);
    setBranches(res.data.branches || []);
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

  // 고른 지점의 프리셋만 보여준다 (전체 = 지점 없는 프리셋)
  const presets = useMemo(
    () => allPresets.filter((preset) => (preset.branch_id ?? null) === branchId),
    [allPresets, branchId]
  );
  const activePreset = presets.find((preset) => preset.id === activePresetId) || presets[0] || null;
  const assignedStudentIds = useMemo(() => new Set(
    activePreset?.groups.flatMap((group) => group.members.map((member) => member.student_id)) || []
  ), [activePreset]);
  const unassignedStudents = allStudents
    .filter((student) => !branchId || student.branch_id === branchId)
    .filter((student) => !assignedStudentIds.has(student.id ?? student.student_id))
    .map(toPresetStudent);
  const assignedCount = activePreset?.groups.reduce((sum, group) => sum + group.members.length, 0) || 0;

  const handleCreatePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      const res = await apiClient.post<{ id: number }>('/presets', {
        name: newPresetName.trim(),
        type: newPresetType,
        branch_id: branchId,
      });
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
    if (!activePreset) return;
    try {
      await apiClient.post(`/presets/${activePreset.id}/groups`, {
        name: activePreset?.type === 'homeroom' ? '새 담임반' : '새 그룹',
      });
      await fetchPresets();
    } catch {
      toastRef.current.error('그룹을 추가하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleFillFromClasses = async () => {
    if (!activePreset) return;
    try {
      await apiClient.post(`/presets/${activePreset.id}/fill-from-classes`, {});
      await fetchPresets();
      toastRef.current.success('P-ACA 반대로 그룹을 만들었습니다.');
    } catch {
      toastRef.current.error('P-ACA 반을 가져오지 못했습니다. 다시 시도해주세요.');
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
        <RefreshCw size={18} className="mr-2 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">프리셋 데이터를 불러오는 중입니다.</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4" data-testid="presets-page">
      <PageHeader
        title="반 프리셋"
        description="자동 반 배치에 사용할 학생 그룹과 담당 강사를 관리합니다."
        actions={(
          <button
            onClick={() => setShowNewPreset(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus size={16} />
            새 프리셋
          </button>
        )}
      />

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

      <BranchTabs branches={branches} value={branchId} onChange={setBranchId} />

      <section className="grid grid-cols-2 gap-3" aria-label="프리셋 요약">
        <Metric label="프리셋" value={`${presets.length}개`} detail="사용 가능한 구성" />
        <Metric label="배정 학생" value={`${assignedCount}명`} detail={activePreset ? activePreset.name : '선택 없음'} />
      </section>

      {presets.length === 0 ? (
        <EmptyPresetState onCreate={() => setShowNewPreset(true)} />
      ) : (
        <section className="space-y-4 rounded-2xl bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center">
                <button
                  onClick={() => setActivePresetId(preset.id)}
                  aria-pressed={activePreset?.id === preset.id}
                  className={chipClass(activePreset?.id === preset.id, 'card')}
                >
                  <Layers size={14} />
                  {preset.name}
                  <span className="text-xs opacity-70">
                    {getPresetTypeLabel(preset.type)}
                  </span>
                </button>
                {activePreset?.id === preset.id ? (
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="ml-1 rounded-lg p-2 text-muted-foreground transition hover:bg-destructive-soft hover:text-destructive"
                    title="프리셋 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {activePreset ? (
            <>
            {activePreset.branch_id && activePreset.groups.length === 0 ? (
              <button
                onClick={handleFillFromClasses}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-soft px-4 text-sm font-semibold text-primary transition hover:bg-primary-soft/70"
              >
                <Layers size={14} />
                P-ACA 반대로 채우기
              </button>
            ) : null}
            <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <UnassignedArea students={unassignedStudents} />
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2" data-testid="preset-groups">
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
                  className="flex min-h-[220px] w-52 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border transition hover:border-primary hover:bg-primary-soft"
                >
                  <Plus size={24} className="text-muted-foreground/60" />
                  <span className="text-sm text-muted-foreground">그룹 추가</span>
                </button>
              </div>
              <DragOverlay>{activeItem ? <StudentPill student={activeItem.student} /> : null}</DragOverlay>
            </DndContext>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <StatTile label={label} value={value} note={detail} />
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-[0_16px_48px_rgba(0,0,0,0.16)] sm:mx-4 sm:rounded-3xl sm:pb-6">
        <h3 className="text-xl font-bold tracking-tight text-foreground">새 프리셋 만들기</h3>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-secondary-foreground">프리셋 이름</span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="예: 담임제, 대학별"
              className="mt-1 h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-foreground outline-none focus:border-primary"
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <TypeButton active={type === 'homeroom'} label="담임제" detail="강사별 고정 학생" onClick={() => onTypeChange('homeroom')} />
            <TypeButton active={type === 'group'} label="그룹별" detail="자유 그룹 구성" onClick={() => onTypeChange('group')} />
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} className="h-11 rounded-xl bg-secondary px-4 text-[15px] font-semibold text-secondary-foreground transition hover:bg-secondary/70">취소</button>
          <button onClick={onSubmit} disabled={!name.trim()} className="h-11 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">만들기</button>
        </div>
      </div>
    </div>
  );
}

function TypeButton({ active, label, detail, onClick }: { active: boolean; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border-2 p-3 text-left transition ${
        active ? 'border-primary bg-primary-soft' : 'border-transparent bg-muted hover:bg-border'
      }`}
    >
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </button>
  );
}

function EmptyPresetState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl bg-card text-center">
      <Layers size={44} className="text-muted-foreground/60" />
      <p className="mt-4 font-medium text-secondary-foreground">프리셋이 없습니다.</p>
      <p className="mt-1 text-sm text-muted-foreground">새 프리셋을 만들어 자동 반 배치를 준비하세요.</p>
      <button onClick={onCreate} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <Plus size={16} />
        새 프리셋
      </button>
    </div>
  );
}
