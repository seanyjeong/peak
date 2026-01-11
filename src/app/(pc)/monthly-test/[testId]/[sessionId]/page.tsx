'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface Participant {
  id: number;
  student_id?: number;
  test_applicant_id?: number;
  name: string;
  gender: 'M' | 'F';
  school?: string;
  grade?: string;
  participant_type: 'enrolled' | 'rest' | 'trial' | 'test_new';
  attendance_status: string;
}

interface Supervisor {
  id?: number;
  instructor_id: number;
  name: string;
  is_main?: boolean;
  isOwner?: boolean;
}

interface Group {
  id: number;
  group_num: number;
  group_name?: string;
  supervisors: Supervisor[];
  participants: Participant[];
}

interface Session {
  id: number;
  test_date: string;
  time_slot: string;
  test_name: string;
  test_month: string;
}

interface ScheduleItem {
  group_id: number;
  group_num: number;
  group_name: string | null;
  time_order: number;
  record_type_id: number | null;
  record_type_name: string | null;
  record_type_short: string | null;
}

interface RecordType {
  id: number;
  name: string;
  short_name: string;
}

// 드래그 가능한 참가자 카드
function DraggableParticipant({ participant }: { participant: Participant }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `participant-${participant.id}`,
    data: { type: 'participant', participant }
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const typeColors: Record<string, string> = {
    enrolled: 'bg-green-100 text-green-700',
    rest: 'bg-gray-100 text-gray-600',
    trial: 'bg-purple-100 text-purple-700',
    test_new: 'bg-orange-100 text-orange-700'
  };

  const typeLabels: Record<string, string> = {
    enrolled: '재원',
    rest: '휴원',
    trial: '체험',
    test_new: '신규'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white dark:bg-slate-800 border rounded-lg p-2 mb-1 cursor-grab active:cursor-grabbing shadow-sm hover:shadow touch-none"
    >
      <div className="flex items-center gap-2">
        <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 ${
          participant.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
        }`}>
          {participant.gender === 'M' ? '남' : '여'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">{participant.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[participant.participant_type]}`}>
              {typeLabels[participant.participant_type]}
            </span>
          </div>
          {(participant.school || participant.grade) && (
            <div className="text-xs text-gray-400 dark:text-slate-500 truncate">
              {participant.school} {participant.grade}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 드래그 가능한 감독관 칩
function DraggableSupervisor({ supervisor }: { supervisor: Supervisor }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `supervisor-${supervisor.instructor_id}`,
    data: { type: 'supervisor', supervisor }
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm cursor-grab active:cursor-grabbing touch-none ${
        supervisor.isOwner
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-blue-100 text-blue-700'
      }`}
    >
      {supervisor.is_main && <span className="text-yellow-500">★</span>}
      {supervisor.isOwner && <span>👑</span>}
      {supervisor.name}
    </div>
  );
}

// 드롭 영역 (조)
function GroupColumn({
  group,
  onDeleteGroup
}: {
  group: Group;
  onDeleteGroup: () => void;
}) {
  const { setNodeRef: setParticipantsRef, isOver: isOverParticipants } = useDroppable({
    id: `group-${group.id}-participants`,
    data: { type: 'group-participants', groupId: group.id }
  });

  const { setNodeRef: setSupervisorsRef, isOver: isOverSupervisors } = useDroppable({
    id: `group-${group.id}-supervisors`,
    data: { type: 'group-supervisors', groupId: group.id }
  });

  const mainSupervisor = group.supervisors.find(s => s.is_main);
  const groupTitle = mainSupervisor ? `${mainSupervisor.name}T` : `${group.group_num}조`;

  return (
    <div className="w-56 flex-shrink-0 bg-white dark:bg-slate-800 rounded-lg border shadow-sm flex flex-col">
      {/* 조 헤더 */}
      <div className="flex justify-between items-center px-3 py-2 border-b bg-gray-50 dark:bg-slate-900 rounded-t-lg">
        <span className="font-medium">{groupTitle}</span>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
          <span>{group.participants.length}명</span>
          <button onClick={onDeleteGroup} className="ml-2 text-gray-400 dark:text-slate-500 hover:text-red-500">✕</button>
        </div>
      </div>

      {/* 감독관 영역 */}
      <div
        ref={setSupervisorsRef}
        className={`p-2 border-b min-h-[48px] flex flex-wrap gap-1 transition-colors ${
          isOverSupervisors ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50 dark:bg-slate-900'
        }`}
      >
        {group.supervisors.length === 0 ? (
          <span className="text-xs text-gray-400 dark:text-slate-500">감독관을 여기에 드롭</span>
        ) : (
          group.supervisors.map(s => (
            <DraggableSupervisor key={s.instructor_id} supervisor={s} />
          ))
        )}
      </div>

      {/* 학생 영역 - 크기 확대 */}
      <div
        ref={setParticipantsRef}
        className={`flex-1 p-2 min-h-[300px] overflow-y-auto transition-colors ${
          isOverParticipants ? 'bg-green-100 ring-2 ring-green-400' : ''
        }`}
      >
        {group.participants.map(p => (
          <DraggableParticipant key={p.id} participant={p} />
        ))}
        {group.participants.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
            학생을 여기에 드롭
          </div>
        )}
      </div>
    </div>
  );
}

// 새 조 생성 드롭존
function NewGroupZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'new-group',
    data: { type: 'new-group' }
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-48 flex-shrink-0 border-2 border-dashed rounded-lg flex items-center justify-center min-h-[300px] transition-colors ${
        isOver ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-400' : 'border-gray-300 dark:border-slate-700'
      }`}
    >
      <div className="text-center text-gray-400 dark:text-slate-500">
        <div className="text-3xl mb-2">+</div>
        <div className="text-sm">감독관 드롭하여<br/>새 조 생성</div>
      </div>
    </div>
  );
}

// 대기 영역 컴포넌트 (DndContext 안에서 useDroppable 호출해야 함)
function WaitingArea({
  waitingParticipants,
  waitingInstructors,
  isDragging
}: {
  waitingParticipants: Participant[];
  waitingInstructors: Supervisor[];
  isDragging: boolean;
}) {
  const { setNodeRef: setWaitingParticipantsRef, isOver: isOverWaitingP } = useDroppable({
    id: 'waiting-participants',
    data: { type: 'waiting-participants' }
  });

  const { setNodeRef: setWaitingSupervisorsRef, isOver: isOverWaitingS } = useDroppable({
    id: 'waiting-supervisors',
    data: { type: 'waiting-supervisors' }
  });

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-4">
      {/* 감독관 대기 */}
      <Card className={`flex-shrink-0 transition-all ${isDragging ? 'ring-2 ring-dashed ring-blue-300' : ''}`}>
        <div className="p-2 border-b bg-gray-50 dark:bg-slate-900 font-medium text-sm">
          감독관 대기 ({waitingInstructors.length})
        </div>
        <div
          ref={setWaitingSupervisorsRef}
          className={`p-3 min-h-[80px] flex flex-wrap gap-1 transition-colors ${
            isOverWaitingS ? 'bg-blue-100 ring-2 ring-blue-400' : isDragging ? 'bg-blue-50' : ''
          }`}
        >
          {waitingInstructors.length === 0 ? (
            <div className={`w-full h-full flex items-center justify-center text-sm ${isDragging ? 'text-blue-500 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
              {isDragging ? '여기에 드롭하여 미배치' : '감독관을 여기로 드롭'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 items-start">
              {waitingInstructors.map(s => (
                <DraggableSupervisor key={s.instructor_id} supervisor={s} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* 학생 대기 */}
      <div
        ref={setWaitingParticipantsRef}
        className={`flex-1 overflow-hidden flex flex-col rounded-lg border bg-white dark:bg-slate-800 shadow-sm transition-all ${
          isOverWaitingP ? 'ring-2 ring-green-400 bg-green-50' : isDragging ? 'ring-2 ring-dashed ring-green-300' : ''
        }`}
      >
        <div className="p-2 border-b bg-gray-50 dark:bg-slate-900 font-medium text-sm rounded-t-lg">
          미배치 학생 ({waitingParticipants.length})
        </div>
        <div className={`flex-1 p-3 overflow-y-auto min-h-[200px] transition-colors ${isOverWaitingP ? 'bg-green-100' : isDragging ? 'bg-green-50' : ''}`}>
          {waitingParticipants.length === 0 ? (
            <div className={`h-full flex items-center justify-center text-sm ${isDragging ? 'text-green-600 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
              {isDragging ? '여기에 드롭하여 미배치' : '학생을 여기로 드롭하면 미배치'}
            </div>
          ) : (
            waitingParticipants.map(p => (
              <DraggableParticipant key={p.id} participant={p} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionGroupPage({
  params
}: {
  params: Promise<{ testId: string; sessionId: string }>
}) {
  const { testId, sessionId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'grouping' | 'schedule'>('grouping');
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [waitingInstructors, setWaitingSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // 순서표 관련 상태
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchSchedule();
    }
  }, [activeTab, sessionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/test-sessions/${sessionId}/groups`);
      setSession(res.data.session);
      setGroups(res.data.groups || []);
      setWaitingParticipants(res.data.waitingParticipants || []);
      setWaitingSupervisors(res.data.waitingInstructors || []);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    try {
      const res = await apiClient.get(`/test-sessions/${sessionId}/schedule`);
      const scheduleData = res.data.schedule || {};
      // 백엔드에서 { groups, recordTypes, timeSlots } 형태로 반환
      // 프론트엔드용 flat 배열로 변환
      const flatSchedule: ScheduleItem[] = [];
      if (scheduleData.timeSlots) {
        scheduleData.timeSlots.forEach((slot: any) => {
          (slot.assignments || []).forEach((a: any) => {
            const group = scheduleData.groups?.find((g: any) => g.id === a.group_id);
            flatSchedule.push({
              group_id: a.group_id,
              group_num: group?.group_num || 0,
              group_name: group?.group_name || null,
              time_order: slot.order,
              record_type_id: a.record_type_id,
              record_type_name: a.record_type_name || null,
              record_type_short: a.short_name || null
            });
          });
        });
      }
      setSchedule(flatSchedule);
      setRecordTypes(scheduleData.recordTypes || []);
    } catch (error) {
      console.error('스케줄 로드 오류:', error);
    }
  };

  const handleGenerateSchedule = async () => {
    if (groups.length === 0) {
      alert('조가 없습니다. 먼저 조를 편성해주세요.');
      return;
    }

    try {
      setGeneratingSchedule(true);
      await apiClient.post(`/test-sessions/${sessionId}/schedule/generate`);
      await fetchSchedule();
    } catch (error: any) {
      alert(error.response?.data?.message || '스케줄 생성 실패');
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await apiClient.post(`/test-sessions/${sessionId}/participants/sync`);
      fetchData();
    } catch (error) {
      console.error('동기화 오류:', error);
    } finally {
      setSyncing(false);
    }
  };

  // 전체 조에 균일하게 자동배치
  const handleAutoAssignAll = async () => {
    if (waitingParticipants.length === 0 || groups.length === 0) return;

    try {
      // 각 조의 현재 인원수를 기준으로 정렬 (적은 순)
      const sortedGroups = [...groups].sort((a, b) => a.participants.length - b.participants.length);

      // 라운드 로빈 방식으로 균일 배분
      const assignments: { participantId: number; groupId: number }[] = [];
      waitingParticipants.forEach((p, index) => {
        const targetGroup = sortedGroups[index % sortedGroups.length];
        assignments.push({ participantId: p.id, groupId: targetGroup.id });
      });

      await Promise.all(
        assignments.map(a =>
          apiClient.put(`/test-sessions/${sessionId}/participants/${a.participantId}`, {
            test_group_id: a.groupId
          })
        )
      );
      fetchData();
    } catch (error) {
      console.error('자동배치 오류:', error);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    console.log('🟢 드래그 시작:', {
      id: event.active.id,
      type: data?.type,
      name: data?.participant?.name || data?.supervisor?.name
    });
    setActiveItem(data);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setIsDragging(false);

    console.log('🔴 드래그 끝:', {
      activeId: active.id,
      overId: over?.id || 'NULL (드롭 영역 없음)',
      overType: over?.data.current?.type || 'N/A'
    });

    if (!over) {
      console.log('❌ over가 null - 유효한 드롭 영역에 드롭하지 않음');
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;
    const overId = String(over.id);

    try {
      if (activeData?.type === 'participant') {
        const participant = activeData.participant as Participant;
        let toGroupId: number | null = null;

        // 조의 학생 영역에 드롭
        if (overData?.type === 'group-participants') {
          toGroupId = overData.groupId;
          console.log('✅ 조로 이동:', toGroupId);
        }
        // 미배치 영역에 드롭
        else if (overId === 'waiting-participants' || overData?.type === 'waiting-participants') {
          toGroupId = null;
          console.log('✅ 미배치로 이동');
        }
        // 유효하지 않은 드롭 위치면 무시
        else {
          console.log('⚠️ 학생: 유효하지 않은 드롭 위치 - overId:', overId, 'overType:', overData?.type);
          return;
        }

        console.log('📤 API 호출: PUT /test-sessions/' + sessionId + '/participants/' + participant.id, { test_group_id: toGroupId });
        await apiClient.put(`/test-sessions/${sessionId}/participants/${participant.id}`, {
          test_group_id: toGroupId
        });
        console.log('✅ API 성공');
      } else if (activeData?.type === 'supervisor') {
        const supervisor = activeData.supervisor as Supervisor;

        if (overId === 'new-group' || overData?.type === 'new-group') {
          console.log('✅ 감독관: 새 조 생성');
          const newGroupRes = await apiClient.post(`/test-sessions/${sessionId}/groups`);
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: newGroupRes.data.id,
            is_main: true
          });
        } else if (overData?.type === 'group-supervisors') {
          console.log('✅ 감독관: 조로 이동:', overData.groupId);
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: overData.groupId,
            is_main: false
          });
        } else if (overId === 'waiting-supervisors' || overData?.type === 'waiting-supervisors') {
          console.log('✅ 감독관: 대기로 이동');
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: null
          });
        } else {
          console.log('⚠️ 감독관: 유효하지 않은 드롭 위치 - overId:', overId, 'overType:', overData?.type);
          return;
        }
      } else {
        console.log('⚠️ 알 수 없는 타입:', activeData?.type);
      }

      fetchData();
    } catch (error) {
      console.error('❌ 배치 오류:', error);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('이 조를 삭제하시겠습니까? 배치된 학생들은 대기로 이동됩니다.')) return;

    try {
      await apiClient.delete(`/test-sessions/${sessionId}/groups/${groupId}`);
      fetchData();
    } catch (error) {
      console.error('조 삭제 오류:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 h-screen flex flex-col">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <button
            onClick={() => router.push(`/monthly-test/${testId}`)}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700"
          >
            ← 테스트로 돌아가기
          </button>
          <h1 className="text-xl font-bold">
            {session?.test_name}
          </h1>
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {session && new Date(session.test_date).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short'
            })}
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === 'grouping' && (
            <>
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? '동기화 중...' : '재원생 동기화'}
              </Button>
              {groups.length > 0 && waitingParticipants.length > 0 && (
                <Button variant="outline" onClick={handleAutoAssignAll}>
                  ⚡ 전체 균일 배치
                </Button>
              )}
              <Button onClick={() => setShowAddModal(true)}>
                + 참가자 추가
              </Button>
            </>
          )}
          {activeTab === 'schedule' && (
            <Button onClick={handleGenerateSchedule} disabled={generatingSchedule || groups.length === 0}>
              {generatingSchedule ? '생성 중...' : '🔄 스케줄 재생성'}
            </Button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('grouping')}
          className={`px-6 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'grouping'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
          }`}
        >
          조 편성
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-6 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'schedule'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
          }`}
        >
          순서표
        </button>
      </div>

      {/* 조 편성 탭 */}
      {activeTab === 'grouping' && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setActiveItem(null); setIsDragging(false); }}
        >

        {/* 메인 영역 */}
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* 대기 영역 - 별도 컴포넌트로 분리 (useDroppable이 DndContext 안에서 호출되도록) */}
          <WaitingArea
            waitingParticipants={waitingParticipants}
            waitingInstructors={waitingInstructors}
            isDragging={isDragging}
          />

          {/* 조 영역 */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 h-full pb-4">
              {groups.map(group => (
                <GroupColumn
                  key={group.id}
                  group={group}
                  onDeleteGroup={() => handleDeleteGroup(group.id)}
                />
              ))}
              <NewGroupZone />
            </div>
          </div>
        </div>

        {/* 드래그 오버레이 */}
        <DragOverlay>
          {activeItem?.type === 'participant' && (
            <div className="bg-white dark:bg-slate-800 border rounded-lg p-2 shadow-lg">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${
                  activeItem.participant.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                }`}>
                  {activeItem.participant.gender === 'M' ? '남' : '여'}
                </span>
                <span className="font-medium text-sm">{activeItem.participant.name}</span>
              </div>
            </div>
          )}
          {activeItem?.type === 'supervisor' && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-700 shadow-lg">
              {activeItem.supervisor.name}
            </div>
          )}
        </DragOverlay>
        </DndContext>
      )}

      {/* 순서표 탭 */}
      {activeTab === 'schedule' && (
        <div className="flex-1 overflow-auto">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-slate-400">
              <p className="mb-4">먼저 조를 편성해주세요.</p>
              <Button onClick={() => setActiveTab('grouping')}>
                조 편성으로 이동
              </Button>
            </div>
          ) : schedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-slate-400">
              <p className="mb-4">아직 생성된 스케줄이 없습니다.</p>
              <Button onClick={handleGenerateSchedule} disabled={generatingSchedule}>
                {generatingSchedule ? '생성 중...' : '스케줄 생성'}
              </Button>
            </div>
          ) : (
            <Card className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-3 bg-gray-100 text-left w-24">타임</th>
                      {groups.map(group => {
                        const mainSupervisor = group.supervisors.find(s => s.is_main);
                        return (
                          <th key={group.id} className="border p-3 bg-gray-100 text-center min-w-[120px]">
                            {mainSupervisor ? `${mainSupervisor.name}T` : `${group.group_num}조`}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const timeSlots = [...new Set(schedule.map(s => s.time_order))].sort((a, b) => a - b);
                      return timeSlots.map(timeOrder => (
                        <tr key={timeOrder}>
                          <td className="border p-3 bg-gray-50 dark:bg-slate-900 font-medium">
                            타임 {timeOrder + 1}
                          </td>
                          {groups.map(group => {
                            const item = schedule.find(
                              s => s.group_id === group.id && s.time_order === timeOrder
                            );
                            return (
                              <td key={group.id} className="border p-3 text-center">
                                {item?.record_type_id ? (
                                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                    {item.record_type_short || item.record_type_name}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-slate-500 text-sm">휴식</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {recordTypes.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-600 mb-2">종목 안내</div>
                  <div className="flex flex-wrap gap-2">
                    {recordTypes.map(type => (
                      <span key={type.id} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                        {type.short_name || type.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* 참가자 추가 모달 */}
      <AddParticipantModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        sessionId={sessionId}
        testMonth={session?.test_month || ''}
        onAdded={fetchData}
      />
    </div>
  );
}

// 참가자 추가 모달 컴포넌트
function AddParticipantModal({
  isOpen,
  onClose,
  sessionId,
  testMonth,
  onAdded
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  testMonth: string;
  onAdded: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'rest' | 'trial' | 'pending' | 'test_new'>('rest');
  const [students, setStudents] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // 새 테스트신규 등록 폼
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<'M' | 'F'>('M');
  const [newSchool, setNewSchool] = useState('');
  const [newGrade, setNewGrade] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      fetchList();
    }
  }, [isOpen, activeTab]);

  const fetchList = async () => {
    setLoading(true);
    try {
      // 모든 타입을 available-students API로 통일
      const res = await apiClient.get(`/test-sessions/${sessionId}/available-students?type=${activeTab}`);
      if (activeTab === 'test_new') {
        setApplicants(res.data.students || []);
        setStudents([]);
      } else {
        setStudents(res.data.students || []);
        setApplicants([]);
      }
    } catch (error) {
      console.error('목록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;

    setAdding(true);
    try {
      const items = Array.from(selected);
      // participant_type 매핑: pending → test_new (미등록학생도 테스트신규로 취급)
      const participantType = activeTab === 'rest' ? 'rest'
        : activeTab === 'trial' ? 'trial'
        : activeTab === 'pending' ? 'test_new'  // 미등록학생은 test_new로 저장
        : 'test_new';

      await Promise.all(
        items.map(id =>
          apiClient.post(`/test-sessions/${sessionId}/participants`, {
            // 휴원생/체험생/미등록학생은 P-ACA ID로 전송
            paca_student_id: (activeTab === 'rest' || activeTab === 'trial' || activeTab === 'pending') ? id : undefined,
            test_applicant_id: activeTab === 'test_new' ? id : undefined,
            participant_type: participantType
          })
        )
      );

      setSelected(new Set());
      onAdded();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.message || '추가 실패');
    } finally {
      setAdding(false);
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    setAdding(true);
    try {
      // 1. 테스트신규로 등록
      const res = await apiClient.post('/test-applicants', {
        name: newName,
        gender: newGender,
        school: newSchool,
        grade: newGrade,
        test_month: testMonth
      });

      // 2. 참가자로 추가
      await apiClient.post(`/test-sessions/${sessionId}/participants`, {
        test_applicant_id: res.data.id,
        participant_type: 'test_new'
      });

      setNewName('');
      setNewSchool('');
      setNewGrade('');
      setShowNewForm(false);
      onAdded();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.message || '등록 실패');
    } finally {
      setAdding(false);
    }
  };

  const tabs = [
    { key: 'rest', label: '휴원생' },
    { key: 'trial', label: '체험생' },
    { key: 'pending', label: '미등록학생' },
    { key: 'test_new', label: '테스트신규' }
  ];

  const currentList = activeTab === 'test_new' ? applicants : students;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="참가자 추가">
      <div className="min-h-[400px]">
        {/* 탭 */}
        <div className="flex border-b mb-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as any); setSelected(new Set()); }}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {activeTab === 'test_new' && (
              <div className="mb-4">
                {!showNewForm ? (
                  <button
                    onClick={() => setShowNewForm(true)}
                    className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500"
                  >
                    + 새 테스트신규 등록
                  </button>
                ) : (
                  <div className="p-3 border rounded-lg bg-gray-50 dark:bg-slate-900 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="이름"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded"
                      />
                      <select
                        value={newGender}
                        onChange={e => setNewGender(e.target.value as 'M' | 'F')}
                        className="px-3 py-2 border rounded"
                      >
                        <option value="M">남</option>
                        <option value="F">여</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="학교"
                        value={newSchool}
                        onChange={e => setNewSchool(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded"
                      />
                      <input
                        type="text"
                        placeholder="학년"
                        value={newGrade}
                        onChange={e => setNewGrade(e.target.value)}
                        className="w-20 px-3 py-2 border rounded"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>
                        취소
                      </Button>
                      <Button size="sm" onClick={handleAddNew} disabled={adding}>
                        {adding ? '등록 중...' : '등록 및 추가'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentList.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                {activeTab === 'rest' && '추가 가능한 휴원생이 없습니다.'}
                {activeTab === 'trial' && '추가 가능한 체험생이 없습니다.'}
                {activeTab === 'pending' && '추가 가능한 미등록학생이 없습니다.'}
                {activeTab === 'test_new' && '등록된 테스트신규가 없습니다.'}
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto space-y-1">
                {currentList.map((item: any) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      selected.has(item.id) ? 'bg-blue-50' : 'hover:bg-gray-50 dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4"
                    />
                    <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${
                      item.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    }`}>
                      {item.gender === 'M' ? '남' : '여'}
                    </span>
                    <span className="font-medium flex-1">{item.name}</span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      {item.school || ''} {item.grade || ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        {/* 하단 버튼 */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {selected.size > 0 && `${selected.size}명 선택됨`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button onClick={handleAdd} disabled={adding || selected.size === 0}>
              {adding ? '추가 중...' : '추가'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
