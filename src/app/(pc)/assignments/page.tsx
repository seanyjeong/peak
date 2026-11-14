'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Calendar, ChevronDown, Layers, RefreshCw, RotateCcw } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { BranchTabs } from '@/components/BranchTabs';
import { PageHeader, StatTile, chipClass, toolbarButtonClass } from '@/components/ui/page';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/hooks/useToast';
import {
  SLOT_ORDER,
  TIME_SLOT_INFO,
  createEmptySlots,
  formatDateKorean,
  getAssignedStudentCount,
  getDefaultSlot,
  getLocalDateString,
  getSlotStudentCount,
  type AssignmentBranch,
  type AssignmentPreset,
  type Instructor,
  type SlotsData,
  type Student,
  type TimeSlot,
} from './assignments-model';
import {
  ClassColumn,
  CompactStudentCard,
  InstructorChip,
  NewClassZone,
  WaitingArea,
} from './assignments-dnd';
import { AssignmentLegend, PresetConfirmModal, ResetConfirmModal } from './assignments-overlays';

type ActiveDragItem =
  | { type: 'student'; data: Student }
  | { type: 'instructor'; data: Instructor };

type PresetConfirm = { id: number; name: string } | null;

export default function AssignmentsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const [slotsData, setSlotsData] = useState<SlotsData>(createEmptySlots);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeItem, setActiveItem] = useState<ActiveDragItem | null>(null);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [presets, setPresets] = useState<AssignmentPreset[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showPresetConfirm, setShowPresetConfirm] = useState<PresetConfirm>(null);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);
  // P-ACA 지점별 보기. null = 전체(지점이 없는 학원은 늘 null).
  const [branches, setBranches] = useState<AssignmentBranch[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const branchChosenRef = useRef(false);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const loadAssignments = useCallback(async ({
    sync = false,
    preserveActiveSlot = !sync,
  }: {
    sync?: boolean;
    preserveActiveSlot?: boolean;
  } = {}) => {
    try {
      setLoading(true);
      if (sync) {
        setSyncing(true);
        setSlotsData(createEmptySlots());
        await apiClient.post('/assignments/sync', { date: selectedDate });
      }

      const branchQuery = branchId ? `&branch_id=${branchId}` : '';
      const res = await apiClient.get<{ slots?: SlotsData; branches?: AssignmentBranch[] }>(
        `/assignments?date=${selectedDate}${branchQuery}`
      );
      const loadedBranches = res.data.branches || [];
      setBranches(loadedBranches);
      // 지점이 있는 학원은 처음에 첫 지점을 골라 둔다 (그 뒤로는 고른 대로)
      if (loadedBranches.length > 0 && !branchChosenRef.current) {
        branchChosenRef.current = true;
        setBranchId(loadedBranches[0].id);
        return;
      }
      const slots = res.data.slots || createEmptySlots();
      setSlotsData(slots);
      setActiveSlot((currentSlot) => (preserveActiveSlot ? currentSlot : getDefaultSlot(slots)));
    } catch {
      toastRef.current.error('반 배치 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [branchId, selectedDate]);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await apiClient.get<{ presets?: AssignmentPreset[] }>('/presets');
      setPresets(res.data.presets || []);
    } catch {
    }
  }, []);

  const { isConnected } = useSocket({
    onAssignmentsUpdated: (data) => {
      if (data.date === selectedDate) {
        loadAssignments();
      }
    },
  });

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  useEffect(() => {
    loadAssignments({ sync: true });
  }, [loadAssignments]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setShowPresetMenu(false);
      }
    };
    if (showPresetMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPresetMenu]);

  const currentSlotData = slotsData[activeSlot];
  const totalStudents = getSlotStudentCount(currentSlotData);
  const assignedStudents = getAssignedStudentCount(currentSlotData);
  const waitingStudents = currentSlotData.waitingStudents.length;
  const instructorCount = currentSlotData.waitingInstructors.length
    + currentSlotData.classes.reduce((sum, classData) => sum + classData.instructors.length, 0);

  const getNextClassNum = async () => {
    // 지점별로 볼 때는 다른 지점의 조 번호가 안 보이므로 서버에 다음 번호를 묻는다
    if (branchId) {
      const res = await apiClient.get<{ next_class_num: number }>(
        `/assignments/next-class-num?date=${selectedDate}&time_slot=${activeSlot}`
      );
      return res.data.next_class_num;
    }
    const classNums = currentSlotData.classes.map((classData) => classData.class_num);
    return classNums.length > 0 ? Math.max(...classNums) + 1 : 1;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'student') setActiveItem({ type: 'student', data: data.student });
    if (data?.type === 'instructor') setActiveItem({ type: 'instructor', data: data.instructor });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const data = active.data.current;
    setActiveItem(null);
    if (!over) return;

    try {
      const overId = String(over.id);

      if (data?.type === 'student') {
        const student = data.student as Student;
        if (overId === 'waiting-students') {
          await apiClient.put(`/assignments/${student.id}`, { class_id: null });
        } else if (overId.startsWith('class-') && overId.endsWith('-students')) {
          await apiClient.put(`/assignments/${student.id}`, { class_id: Number(overId.split('-')[1]) });
        }
      }

      if (data?.type === 'instructor') {
        const instructor = data.instructor as Instructor;
        const payload = {
          date: selectedDate,
          time_slot: activeSlot,
          instructor_id: instructor.id,
          branch_id: branchId,
        };

        if (overId === 'waiting-instructors') {
          await apiClient.post('/assignments/instructor', { ...payload, to_class_num: null });
        } else if (overId.startsWith('class-') && overId.endsWith('-instructors')) {
          await apiClient.post('/assignments/instructor', {
            ...payload,
            to_class_num: Number(overId.split('-')[1]),
            is_main: false,
          });
        } else if (overId === 'new-class') {
          await apiClient.post('/assignments/instructor', {
            ...payload,
            to_class_num: await getNextClassNum(),
            is_main: true,
          });
        }
      }

      await loadAssignments();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toastRef.current.error(message && message !== 'Internal Server Error' ? message : '배치를 저장하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const handleReset = async () => {
    try {
      setResetting(true);
      await apiClient.post('/assignments/reset', { date: selectedDate, time_slot: activeSlot, branch_id: branchId });
      setShowResetConfirm(false);
      await loadAssignments();
      toastRef.current.success('현재 시간대 배치를 초기화했습니다.');
    } catch {
      toastRef.current.error('초기화에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setResetting(false);
    }
  };

  const handleApplyPreset = async (presetId: number) => {
    try {
      setApplyingPreset(true);
      setShowPresetConfirm(null);
      const res = await apiClient.post(`/presets/${presetId}/apply`, {
        date: selectedDate,
        time_slot: activeSlot,
      });
      await loadAssignments();
      const result = res.data?.result;
      const summary = result
        ? `반 ${result.classes_created}개, 학생 ${result.students_assigned}명 배정`
          + (result.instructors_absent > 0
            ? ` · 근무가 없거나 다른 반에 있는 강사 ${result.instructors_absent}명의 그룹은 대기로 둠`
            : '')
        : '프리셋을 적용했습니다.';
      toastRef.current.success(summary);
    } catch {
      toastRef.current.error('프리셋 적용에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setApplyingPreset(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1540px] space-y-4" data-testid="assignments-page">
      <PageHeader
        title="반 배치"
        description={formatDateKorean(selectedDate)}
        actions={(
          <>
            <label className={toolbarButtonClass()}>
              <Calendar size={16} className="text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="border-none bg-transparent p-0 text-sm focus:ring-0"
              />
            </label>
            <PresetMenu
              presets={presets.filter((preset) => (preset.branch_id ?? null) === branchId)}
              disabled={loading || applyingPreset}
              open={showPresetMenu}
              menuRef={presetMenuRef}
              onToggle={() => setShowPresetMenu((open) => !open)}
              onSelect={(preset) => {
                setShowPresetMenu(false);
                setShowPresetConfirm({ id: preset.id, name: preset.name });
              }}
            />
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={loading || resetting}
              className={toolbarButtonClass('danger')}
            >
              <RotateCcw size={16} />
              초기화
            </button>
            <button
              onClick={() => loadAssignments()}
              disabled={loading}
              className={toolbarButtonClass()}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} title={isConnected ? '실시간 연결됨' : '연결 끊김'} />
          </>
        )}
      />

      <BranchTabs branches={branches} value={branchId} onChange={setBranchId} />

      <section className="grid grid-cols-3 gap-3" aria-label="반 배치 요약">
        <StatTile label="배정" value={`${assignedStudents}/${totalStudents}`} note={syncing ? '동기화 중' : '현재 시간대'} />
        <StatTile label="운영 반" value={`${currentSlotData.classes.length}개`} note="강사 기준" />
        <StatTile label="강사" value={`${instructorCount}명`} note={isConnected ? '실시간 연결' : '수동 새로고침'} />
      </section>

      <section className="space-y-4 rounded-2xl bg-card p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {SLOT_ORDER.map((slot) => {
          const info = TIME_SLOT_INFO[slot];
          const count = getSlotStudentCount(slotsData[slot]);
          const isActive = activeSlot === slot;
          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              aria-pressed={isActive}
              className={chipClass(isActive, 'card')}
            >
              {info.label}
              <span className="tabular-nums opacity-70">{count}명</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
          <RefreshCw size={18} className="mr-2 animate-spin text-primary" />
          반 배치 데이터를 불러오는 중입니다.
        </div>
      ) : totalStudents === 0 && currentSlotData.waitingInstructors.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <p className="font-medium">{TIME_SLOT_INFO[activeSlot].label} 수업 데이터가 없습니다.</p>
          <p className="mt-1 text-sm">날짜 또는 P-ACA 출석 동기화를 확인하세요.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div data-testid="assignments-board">
            <WaitingArea
              waitingStudents={currentSlotData.waitingStudents}
              waitingInstructors={currentSlotData.waitingInstructors}
            />
            <div className="flex flex-wrap gap-3">
              {currentSlotData.classes.map((classData) => (
                <ClassColumn key={classData.class_num} classData={classData} />
              ))}
              <NewClassZone />
            </div>
          </div>
          <DragOverlay>
            {activeItem?.type === 'student' ? <CompactStudentCard student={activeItem.data} isDragging /> : null}
            {activeItem?.type === 'instructor' ? <InstructorChip instructor={activeItem.data} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <AssignmentLegend />
      </section>

      {showResetConfirm ? (
        <ResetConfirmModal
          activeSlot={activeSlot}
          branchName={branches.find((branch) => branch.id === branchId)?.name ?? null}
          date={selectedDate}
          hasBranches={branches.length > 0}
          resetting={resetting}
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={handleReset}
        />
      ) : null}
      {showPresetConfirm ? (
        <PresetConfirmModal
          activeSlot={activeSlot}
          presetName={showPresetConfirm.name}
          onCancel={() => setShowPresetConfirm(null)}
          onConfirm={() => handleApplyPreset(showPresetConfirm.id)}
        />
      ) : null}
    </div>
  );
}

function PresetMenu({
  presets,
  disabled,
  open,
  menuRef,
  onToggle,
  onSelect,
}: {
  presets: AssignmentPreset[];
  disabled: boolean;
  open: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onSelect: (preset: AssignmentPreset) => void;
}) {
  if (presets.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={toolbarButtonClass('primary')}
      >
        <Layers size={16} />
        프리셋
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-2xl bg-popover p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelect(preset)}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-muted"
            >
              <span className="text-foreground">{preset.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{preset.type === 'homeroom' ? '담임' : '그룹'}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
