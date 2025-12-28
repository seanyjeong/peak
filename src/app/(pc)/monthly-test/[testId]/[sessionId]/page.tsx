'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  DndContext,
  DragOverlay,
  closestCorners,
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
      className="bg-white border rounded-lg p-2 mb-1 cursor-grab active:cursor-grabbing shadow-sm hover:shadow"
    >
      <div className="flex items-center gap-2">
        <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${
          participant.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
        }`}>
          {participant.gender === 'M' ? '남' : '여'}
        </span>
        <span className="font-medium text-sm flex-1">{participant.name}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[participant.participant_type]}`}>
          {typeLabels[participant.participant_type]}
        </span>
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
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm cursor-grab active:cursor-grabbing ${
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
    data: { type: 'participants', groupId: group.id }
  });

  const { setNodeRef: setSupervisorsRef, isOver: isOverSupervisors } = useDroppable({
    id: `group-${group.id}-supervisors`,
    data: { type: 'supervisors', groupId: group.id }
  });

  const mainSupervisor = group.supervisors.find(s => s.is_main);
  const groupTitle = mainSupervisor ? `${mainSupervisor.name}T` : `${group.group_num}조`;

  return (
    <div className="w-52 flex-shrink-0 bg-white rounded-lg border shadow-sm">
      {/* 조 헤더 */}
      <div className="flex justify-between items-center px-3 py-2 border-b bg-gray-50 rounded-t-lg">
        <span className="font-medium">{groupTitle}</span>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{group.participants.length}명</span>
          <button onClick={onDeleteGroup} className="ml-2 text-gray-400 hover:text-red-500">✕</button>
        </div>
      </div>

      {/* 감독관 영역 */}
      <div
        ref={setSupervisorsRef}
        className={`p-2 border-b min-h-[40px] flex flex-wrap gap-1 ${
          isOverSupervisors ? 'bg-blue-50' : 'bg-gray-50'
        }`}
      >
        {group.supervisors.length === 0 ? (
          <span className="text-xs text-gray-400">감독관을 여기에 드롭</span>
        ) : (
          group.supervisors.map(s => (
            <DraggableSupervisor key={s.instructor_id} supervisor={s} />
          ))
        )}
      </div>

      {/* 학생 영역 */}
      <div
        ref={setParticipantsRef}
        className={`p-2 min-h-[200px] max-h-[400px] overflow-y-auto ${
          isOverParticipants ? 'bg-green-50' : ''
        }`}
      >
        {group.participants.map(p => (
          <DraggableParticipant key={p.id} participant={p} />
        ))}
        {group.participants.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
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
      className={`w-48 flex-shrink-0 border-2 border-dashed rounded-lg flex items-center justify-center min-h-[300px] ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
    >
      <div className="text-center text-gray-400">
        <div className="text-3xl mb-2">+</div>
        <div className="text-sm">감독관 드롭하여<br/>새 조 생성</div>
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
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [waitingInstructors, setWaitingSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  useEffect(() => {
    fetchData();
  }, [sessionId]);

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(event.active.data.current);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    try {
      if (activeData?.type === 'participant') {
        const participant = activeData.participant as Participant;
        let toGroupId: number | null = null;

        if (overData?.type === 'participants') {
          toGroupId = overData.groupId;
        } else if (over.id === 'waiting-participants') {
          toGroupId = null;
        }

        await apiClient.put(`/test-sessions/${sessionId}/participants/${participant.id}`, {
          test_group_id: toGroupId
        });
      } else if (activeData?.type === 'supervisor') {
        const supervisor = activeData.supervisor as Supervisor;

        if (over.id === 'new-group') {
          // 새 조 생성 + 감독관 배치
          const newGroupRes = await apiClient.post(`/test-sessions/${sessionId}/groups`);
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: newGroupRes.data.id,
            is_main: true
          });
        } else if (overData?.type === 'supervisors') {
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: overData.groupId,
            is_main: false
          });
        } else if (over.id === 'waiting-supervisors') {
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: null
          });
        }
      }

      fetchData();
    } catch (error) {
      console.error('배치 오류:', error);
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

  const { setNodeRef: setWaitingParticipantsRef, isOver: isOverWaitingP } = useDroppable({
    id: 'waiting-participants',
    data: { type: 'waiting' }
  });

  const { setNodeRef: setWaitingSupervisorsRef, isOver: isOverWaitingS } = useDroppable({
    id: 'waiting-supervisors',
    data: { type: 'waiting' }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-4 h-screen flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <button
              onClick={() => router.push(`/monthly-test/${testId}`)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← 테스트로 돌아가기
            </button>
            <h1 className="text-xl font-bold">
              {session?.test_name} - 조 편성
            </h1>
            <div className="text-sm text-gray-500">
              {session && new Date(session.test_date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? '동기화 중...' : '재원생 동기화'}
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              + 참가자 추가
            </Button>
          </div>
        </div>

        {/* 메인 영역 */}
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* 대기 영역 */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-4">
            {/* 감독관 대기 */}
            <Card className="flex-shrink-0">
              <div className="p-2 border-b bg-gray-50 font-medium text-sm">
                감독관 대기 ({waitingInstructors.length})
              </div>
              <div
                ref={setWaitingSupervisorsRef}
                className={`p-2 min-h-[80px] flex flex-wrap gap-1 ${
                  isOverWaitingS ? 'bg-blue-50' : ''
                }`}
              >
                {waitingInstructors.map(s => (
                  <DraggableSupervisor key={s.instructor_id} supervisor={s} />
                ))}
              </div>
            </Card>

            {/* 학생 대기 */}
            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="p-2 border-b bg-gray-50 font-medium text-sm">
                미배치 학생 ({waitingParticipants.length})
              </div>
              <div
                ref={setWaitingParticipantsRef}
                className={`flex-1 p-2 overflow-y-auto ${
                  isOverWaitingP ? 'bg-green-50' : ''
                }`}
              >
                {waitingParticipants.map(p => (
                  <DraggableParticipant key={p.id} participant={p} />
                ))}
              </div>
            </Card>
          </div>

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
      </div>

      {/* 드래그 오버레이 */}
      <DragOverlay>
        {activeItem?.type === 'participant' && (
          <div className="bg-white border rounded-lg p-2 shadow-lg">
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

      {/* 참가자 추가 모달 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="참가자 추가"
      >
        <div className="text-center py-8 text-gray-500">
          휴원생/테스트신규 추가 기능은<br/>
          별도로 구현 예정입니다.
        </div>
      </Modal>
    </DndContext>
  );
}
