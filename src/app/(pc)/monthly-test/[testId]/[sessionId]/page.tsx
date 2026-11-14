'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ArrowLeft, Loader2, Plus, RefreshCw, Shuffle, Users } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import apiClient from '@/lib/api/client';
import { AddParticipantModal } from './session-add-participant-modal';
import { GroupColumn, NewGroupZone, WaitingArea } from './session-group-dnd';
import {
  ActiveDragItem,
  formatSessionDate,
  getSessionErrorMessage,
  Group,
  Participant,
  RecordType,
  ScheduleItem,
  Session,
  Supervisor,
} from './session-group-model';
import { ScheduleTable } from './session-schedule-ui';
import { PageHeader, StatTile, toolbarButtonClass } from '@/components/ui/page';

export default function SessionGroupPage({ params }: { params: Promise<{ testId: string; sessionId: string }> }) {
  const { sessionId, testId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [activeItem, setActiveItem] = useState<ActiveDragItem>(null);
  const [activeTab, setActiveTab] = useState<'grouping' | 'schedule'>('grouping');
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [waitingInstructors, setWaitingInstructors] = useState<Supervisor[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  useEffect(() => {
    if (activeTab === 'schedule') fetchSchedule();
  }, [activeTab, sessionId]);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await apiClient.get(`/test-sessions/${sessionId}/groups`);
      setSession(res.data.session);
      setGroups(res.data.groups || []);
      setWaitingParticipants(res.data.waitingParticipants || []);
      setWaitingInstructors(res.data.waitingInstructors || []);
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '세션 조 편성 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchSchedule() {
    try {
      const res = await apiClient.get(`/test-sessions/${sessionId}/schedule`);
      const scheduleData = res.data.schedule || {};
      const flatSchedule: ScheduleItem[] = [];
      if (scheduleData.timeSlots) {
        scheduleData.timeSlots.forEach((slot: { order: number; assignments?: { group_id: number; record_type_id: number | null; record_type_name?: string; short_name?: string }[] }) => {
          (slot.assignments || []).forEach((assignment) => {
            const group = scheduleData.groups?.find((item: Group) => item.id === assignment.group_id);
            flatSchedule.push({
              group_id: assignment.group_id,
              group_name: group?.group_name || null,
              group_num: group?.group_num || 0,
              record_type_id: assignment.record_type_id,
              record_type_name: assignment.record_type_name || null,
              record_type_short: assignment.short_name || null,
              time_order: slot.order,
            });
          });
        });
      }
      setSchedule(flatSchedule);
      setRecordTypes(scheduleData.recordTypes || []);
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '순서표를 불러오지 못했습니다.'));
    }
  }

  async function handleGenerateSchedule() {
    if (groups.length === 0) return toast.error('먼저 조를 편성해주세요.');
    try {
      setGeneratingSchedule(true);
      await apiClient.post(`/test-sessions/${sessionId}/schedule/generate`);
      await fetchSchedule();
      toast.success('순서표를 생성했습니다.');
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '순서표를 생성하지 못했습니다.'));
    } finally {
      setGeneratingSchedule(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      await apiClient.post(`/test-sessions/${sessionId}/participants/sync`);
      toast.success('참가자 명단을 동기화했습니다.');
      await fetchData();
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '참가자 명단을 동기화하지 못했습니다.'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleAutoAssignAll() {
    if (waitingParticipants.length === 0 || groups.length === 0) return;
    try {
      const sortedGroups = [...groups].sort((a, b) => a.participants.length - b.participants.length);
      await Promise.all(waitingParticipants.map((participant, index) => (
        apiClient.put(`/test-sessions/${sessionId}/participants/${participant.id}`, {
          test_group_id: sortedGroups[index % sortedGroups.length].id,
        })
      )));
      toast.success('미배치 학생을 균일하게 배치했습니다.');
      await fetchData();
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '자동 배치를 완료하지 못했습니다.'));
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(event.active.data.current as ActiveDragItem);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setIsDragging(false);
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    const overId = String(over.id);

    try {
      if (activeData?.type === 'participant') {
        const participant = activeData.participant as Participant;
        const toGroupId = overData?.type === 'group-participants'
          ? overData.groupId
          : overId === 'waiting-participants' || overData?.type === 'waiting-participants'
            ? null
            : undefined;
        if (toGroupId === undefined) return;
        await apiClient.put(`/test-sessions/${sessionId}/participants/${participant.id}`, { test_group_id: toGroupId });
      }

      if (activeData?.type === 'supervisor') {
        const supervisor = activeData.supervisor as Supervisor;
        if (overId === 'new-group' || overData?.type === 'new-group') {
          const newGroupRes = await apiClient.post(`/test-sessions/${sessionId}/groups`);
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            is_main: true,
            to_group_id: newGroupRes.data.id,
          });
        } else if (overData?.type === 'group-supervisors') {
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            is_main: false,
            to_group_id: overData.groupId,
          });
        } else if (overId === 'waiting-supervisors' || overData?.type === 'waiting-supervisors') {
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: null,
          });
        } else {
          return;
        }
      }

      await fetchData();
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '배치를 저장하지 못했습니다.'));
    }
  };

  async function handleDeleteGroup(groupId: number) {
    if (!window.confirm('이 조를 삭제할까요? 배치된 학생은 미배치로 이동합니다.')) return;
    try {
      await apiClient.delete(`/test-sessions/${sessionId}/groups/${groupId}`);
      toast.success('조를 삭제했습니다.');
      await fetchData();
    } catch (error) {
      toast.error(getSessionErrorMessage(error, '조를 삭제하지 못했습니다.'));
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-140px)] min-h-[640px] max-w-[1600px] flex-col gap-4">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => router.push(`/monthly-test/${testId}`)} className={`${toolbarButtonClass()} mt-2.5 w-10 px-0`} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader
          className="min-w-0 flex-1"
          title={session?.test_name || '월말테스트 세션'}
          description={session ? formatSessionDate(session.test_date) : undefined}
          actions={activeTab === 'grouping' ? (
            <>
              <ActionButton disabled={syncing} icon={<RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />} label={syncing ? '동기화 중' : '재원생 동기화'} onClick={handleSync} />
              {groups.length > 0 && waitingParticipants.length > 0 && <ActionButton icon={<Shuffle className="h-4 w-4" />} label="균일 배치" onClick={handleAutoAssignAll} />}
              <ActionButton icon={<Plus className="h-4 w-4" />} label="참가자 추가" onClick={() => setShowAddModal(true)} primary />
            </>
          ) : (
            <ActionButton disabled={generatingSchedule || groups.length === 0} icon={<RefreshCw className={`h-4 w-4 ${generatingSchedule ? 'animate-spin' : ''}`} />} label={generatingSchedule ? '생성 중' : '순서표 생성'} onClick={handleGenerateSchedule} primary />
          )}
        />
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Metric label="편성 조" value={`${groups.length}개`} />
        <Metric label="배치 학생" value={`${groups.reduce((sum, group) => sum + group.participants.length, 0)}명`} />
      </section>

      <nav className="inline-grid w-fit grid-cols-2 gap-1 rounded-xl bg-card p-1">
        <TabButton active={activeTab === 'grouping'} label="조 편성" onClick={() => setActiveTab('grouping')} />
        <TabButton active={activeTab === 'schedule'} label="순서표" onClick={() => setActiveTab('schedule')} />
      </nav>

      {activeTab === 'grouping' ? (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => { setActiveItem(null); setIsDragging(false); }}>
          <section className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            <WaitingArea waitingParticipants={waitingParticipants} waitingInstructors={waitingInstructors} isDragging={isDragging} />
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="flex h-full gap-4 pb-4">
                {groups.map((group) => <GroupColumn key={group.id} group={group} onDeleteGroup={() => handleDeleteGroup(group.id)} />)}
                <NewGroupZone />
              </div>
            </div>
          </section>
          <DragOverlay>
            {activeItem?.type === 'participant' && <OverlayLabel label={activeItem.participant.name} gender={activeItem.participant.gender} />}
            {activeItem?.type === 'supervisor' && <OverlayLabel label={activeItem.supervisor.name} />}
          </DragOverlay>
        </DndContext>
      ) : (
        <section className="min-h-0 flex-1 overflow-auto">
          {groups.length === 0 ? (
            <EmptyState actionLabel="조 편성으로 이동" message="먼저 조를 편성해주세요." onAction={() => setActiveTab('grouping')} />
          ) : schedule.length === 0 ? (
            <EmptyState actionLabel="순서표 생성" message="아직 생성된 순서표가 없습니다." onAction={handleGenerateSchedule} />
          ) : (
            <ScheduleTable schedule={schedule} groups={groups} recordTypes={recordTypes} sessionId={sessionId} onSwapped={fetchSchedule} />
          )}
        </section>
      )}

      <AddParticipantModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} sessionId={sessionId} testMonth={session?.test_month || ''} onAdded={fetchData} />
    </div>
  );
}

function ActionButton({ disabled, icon, label, onClick, primary = false }: { disabled?: boolean; icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={primary
        ? 'inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50'
        : toolbarButtonClass()}
    >
      {icon}
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <StatTile icon={Users} label={label} value={value} />
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`h-9 rounded-lg px-5 text-sm font-semibold transition ${active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>
      {label}
    </button>
  );
}

function EmptyState({ actionLabel, message, onAction }: { actionLabel: string; message: string; onAction: () => void }) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl bg-card text-sm font-semibold text-muted-foreground">
      <p>{message}</p>
      <button type="button" onClick={onAction} className="mt-4 h-10 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">{actionLabel}</button>
    </div>
  );
}

function OverlayLabel({ gender, label }: { gender?: 'M' | 'F'; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground shadow-lg">
      {gender ? `${gender === 'M' ? '남' : '여'} · ${label}` : label}
    </div>
  );
}
