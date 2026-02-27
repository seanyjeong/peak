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
  closestCenter,
  useSensor,
  useSensors,
  TouchSensor,
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
      className="bg-white dark:bg-slate-800 border rounded-xl p-3 mb-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow touch-none"
    >
      <div className="flex items-center gap-3">
        <span className={`w-8 h-8 rounded-full text-sm flex items-center justify-center flex-shrink-0 ${
          participant.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
        }`}>
          {participant.gender === 'M' ? '남' : '여'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{participant.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${typeColors[participant.participant_type]}`}>
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
      className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm cursor-grab active:cursor-grabbing touch-none ${
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
    <div className="w-64 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border shadow-sm flex flex-col">
      {/* 조 헤더 */}
      <div className="flex justify-between items-center px-4 py-3 border-b bg-gray-50 dark:bg-slate-900 rounded-t-xl">
        <span className="font-semibold text-lg">{groupTitle}</span>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <span>{group.participants.length}명</span>
          <button
            onClick={onDeleteGroup}
            className="ml-2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 감독관 영역 */}
      <div
        ref={setSupervisorsRef}
        className={`p-3 border-b min-h-[56px] flex flex-wrap gap-2 transition-colors ${
          isOverSupervisors ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50 dark:bg-slate-900'
        }`}
      >
        {group.supervisors.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-slate-500">감독관을 여기에 드롭</span>
        ) : (
          group.supervisors.map(s => (
            <DraggableSupervisor key={s.instructor_id} supervisor={s} />
          ))
        )}
      </div>

      {/* 학생 영역 */}
      <div
        ref={setParticipantsRef}
        className={`flex-1 p-3 min-h-[250px] overflow-y-auto transition-colors ${
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
      className={`w-56 flex-shrink-0 border-2 border-dashed rounded-xl flex items-center justify-center min-h-[250px] transition-colors ${
        isOver ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-400' : 'border-gray-300 dark:border-slate-700'
      }`}
    >
      <div className="text-center text-gray-400 dark:text-slate-500">
        <div className="text-4xl mb-2">+</div>
        <div className="text-base">감독관 드롭하여<br/>새 조 생성</div>
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
    <div className="w-80 flex-shrink-0 flex flex-col gap-4">
      {/* 감독관 대기 */}
      <Card className={`flex-shrink-0 transition-all ${isDragging ? 'ring-2 ring-dashed ring-blue-300' : ''}`}>
        <div className="p-3 border-b bg-gray-50 dark:bg-slate-900 font-medium">
          감독관 대기 ({waitingInstructors.length})
        </div>
        <div
          ref={setWaitingSupervisorsRef}
          className={`p-3 min-h-[100px] flex flex-wrap gap-2 transition-colors ${
            isOverWaitingS ? 'bg-blue-100 ring-2 ring-blue-400' : isDragging ? 'bg-blue-50' : ''
          }`}
        >
          {waitingInstructors.length === 0 ? (
            <div className={`w-full flex items-center justify-center text-base ${isDragging ? 'text-blue-500 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
              {isDragging ? '여기에 드롭' : '감독관을 여기로 드롭'}
            </div>
          ) : (
            waitingInstructors.map(s => (
              <DraggableSupervisor key={s.instructor_id} supervisor={s} />
            ))
          )}
        </div>
      </Card>

      {/* 학생 대기 */}
      <div
        ref={setWaitingParticipantsRef}
        className={`flex-1 overflow-hidden flex flex-col rounded-xl border bg-white dark:bg-slate-800 shadow-sm transition-all ${
          isOverWaitingP ? 'ring-2 ring-green-400 bg-green-50' : isDragging ? 'ring-2 ring-dashed ring-green-300' : ''
        }`}
      >
        <div className="p-3 border-b bg-gray-50 dark:bg-slate-900 font-medium rounded-t-xl">
          미배치 학생 ({waitingParticipants.length})
        </div>
        <div className={`flex-1 p-3 overflow-y-auto min-h-[200px] transition-colors ${isOverWaitingP ? 'bg-green-100' : isDragging ? 'bg-green-50' : ''}`}>
          {waitingParticipants.length === 0 ? (
            <div className={`h-full flex items-center justify-center text-base ${isDragging ? 'text-green-600 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
              {isDragging ? '여기에 드롭하여 미배치' : '학생을 여기로 드롭'}
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

export default function TabletSessionGroupPage({
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
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // 터치 센서 (태블릿 최적화)
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 }
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const [isDragging, setIsDragging] = useState(false);

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

  // 전체 조에 균일하게 자동배치
  const handleAutoAssignAll = async () => {
    if (waitingParticipants.length === 0 || groups.length === 0) return;

    try {
      const sortedGroups = [...groups].sort((a, b) => a.participants.length - b.participants.length);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(event.active.data.current);
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
        let toGroupId: number | null = null;

        if (overData?.type === 'group-participants') {
          toGroupId = overData.groupId;
        } else if (overId === 'waiting-participants' || overData?.type === 'waiting-participants') {
          toGroupId = null;
        } else {
          return;
        }

        await apiClient.put(`/test-sessions/${sessionId}/participants/${participant.id}`, {
          test_group_id: toGroupId
        });
      } else if (activeData?.type === 'supervisor') {
        const supervisor = activeData.supervisor as Supervisor;

        if (overId === 'new-group' || overData?.type === 'new-group') {
          const newGroupRes = await apiClient.post(`/test-sessions/${sessionId}/groups`);
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: newGroupRes.data.id,
            is_main: true
          });
        } else if (overData?.type === 'group-supervisors') {
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: overData.groupId,
            is_main: false
          });
        } else if (overId === 'waiting-supervisors' || overData?.type === 'waiting-supervisors') {
          await apiClient.post(`/test-sessions/${sessionId}/supervisor`, {
            instructor_id: supervisor.instructor_id,
            to_group_id: null
          });
        } else {
          return;
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
      onDragCancel={() => { setActiveItem(null); setIsDragging(false); }}
    >
      <div className="p-4 min-h-screen flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <button
              onClick={() => router.push(`/tablet/monthly-test/${testId}`)}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 min-h-12 flex items-center"
            >
              ← 테스트로 돌아가기
            </button>
            <h1 className="text-xl font-bold">
              {session?.test_name} - 조 편성
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="min-h-12"
            >
              {syncing ? '동기화 중...' : '재원생 동기화'}
            </Button>
            {groups.length > 0 && waitingParticipants.length > 0 && (
              <Button
                variant="outline"
                onClick={handleAutoAssignAll}
                className="min-h-12"
              >
                ⚡ 전체 균일 배치
              </Button>
            )}
            <Button
              onClick={() => setShowAddModal(true)}
              className="min-h-12"
            >
              + 참가자 추가
            </Button>
          </div>
        </div>

        {/* 기록측정 / 순서표 버튼 */}
        <div className="mb-4 flex gap-3">
          <Button
            variant="primary"
            size="lg"
            className="flex-1 min-h-14 text-lg"
            onClick={() => router.push(`/tablet/monthly-test/${testId}/${sessionId}/records`)}
          >
            📝 기록 측정
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1 min-h-14 text-lg"
            onClick={() => setShowScheduleModal(true)}
          >
            📋 순서표
          </Button>
        </div>

        {/* 메인 영역 - 좌측 대기 / 우측 조 (가로 배치) */}
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* 좌측: 대기 영역 - WaitingArea 컴포넌트 사용 (useDroppable이 DndContext 안에서 호출됨) */}
          <WaitingArea
            waitingParticipants={waitingParticipants}
            waitingInstructors={waitingInstructors}
            isDragging={isDragging}
          />

          {/* 우측: 조 영역 - 가로 스크롤 */}
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
          <div className="bg-white dark:bg-slate-800 border rounded-xl p-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full text-sm flex items-center justify-center ${
                activeItem.participant.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
              }`}>
                {activeItem.participant.gender === 'M' ? '남' : '여'}
              </span>
              <span className="font-medium">{activeItem.participant.name}</span>
            </div>
          </div>
        )}
        {activeItem?.type === 'supervisor' && (
          <div className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm bg-blue-100 text-blue-700 shadow-lg">
            {activeItem.supervisor.name}
          </div>
        )}
      </DragOverlay>

      {/* 참가자 추가 모달 */}
      <AddParticipantModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        sessionId={sessionId}
        testMonth={session?.test_month || ''}
        onAdded={fetchData}
      />

      {/* 순서표 모달 */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        sessionId={sessionId}
        groups={groups}
      />
    </DndContext>
  );
}

// 참가자 추가 모달 컴포넌트 (터치 최적화)
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
      const participantType = activeTab === 'rest' ? 'rest'
        : activeTab === 'trial' ? 'trial'
        : activeTab === 'pending' ? 'test_new'
        : 'test_new';

      await Promise.all(
        items.map(id =>
          apiClient.post(`/test-sessions/${sessionId}/participants`, {
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
      const res = await apiClient.post('/test-applicants', {
        name: newName,
        gender: newGender,
        school: newSchool,
        grade: newGrade,
        test_month: testMonth
      });

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
    { key: 'pending', label: '미등록' },
    { key: 'test_new', label: '신규' }
  ];

  const currentList = activeTab === 'test_new' ? applicants : students;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="참가자 추가">
      <div className="min-h-[450px]">
        {/* 탭 - 터치 친화적 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as any); setSelected(new Set()); }}
              className={`flex-1 min-h-12 px-4 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 min-h-14"
                  >
                    + 새 테스트신규 등록
                  </button>
                ) : (
                  <div className="p-4 border rounded-xl bg-gray-50 dark:bg-slate-900 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="이름"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="flex-1 px-4 py-3 border rounded-xl text-lg"
                      />
                      <select
                        value={newGender}
                        onChange={e => setNewGender(e.target.value as 'M' | 'F')}
                        className="px-4 py-3 border rounded-xl"
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
                        className="flex-1 px-4 py-3 border rounded-xl"
                      />
                      <select
                        value={newGrade}
                        onChange={e => setNewGrade(e.target.value)}
                        className="w-28 px-4 py-3 border rounded-xl"
                      >
                        <option value="">학년</option>
                        <option value="중1">중1</option>
                        <option value="중2">중2</option>
                        <option value="중3">중3</option>
                        <option value="고1">고1</option>
                        <option value="고2">고2</option>
                        <option value="고3">고3</option>
                        <option value="N수">N수</option>
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" onClick={() => setShowNewForm(false)} className="min-h-12">
                        취소
                      </Button>
                      <Button onClick={handleAddNew} disabled={adding} className="min-h-12">
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
              <div className="max-h-[280px] overflow-y-auto space-y-2">
                {currentList.map((item: any) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors min-h-14 ${
                      selected.has(item.id) ? 'bg-blue-50 border-2 border-blue-400' : 'bg-gray-50 dark:bg-slate-900 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-5 h-5"
                    />
                    <span className={`w-8 h-8 rounded-full text-sm flex items-center justify-center ${
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
            <Button variant="outline" onClick={onClose} className="min-h-12 px-6">
              취소
            </Button>
            <Button onClick={handleAdd} disabled={adding || selected.size === 0} className="min-h-12 px-6">
              {adding ? '추가 중...' : '추가'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// 태블릿 순서표 드래그앤드롭 셀 (같은 ID로 자기 셀 자동 제외)
function TabletScheduleCell({ id, timeOrder, groupId, children }: {
  id: string;
  timeOrder: number;
  groupId: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id,
    data: { type: 'schedule-cell', timeOrder, groupId }
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    data: { type: 'schedule-cell', timeOrder, groupId }
  });

  return (
    <td
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      className={`border px-3 py-2 text-center select-none transition-colors ${
        isOver ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400 ring-inset' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      {children}
    </td>
  );
}

// 순서표 모달 컴포넌트
function ScheduleModal({
  isOpen,
  onClose,
  sessionId,
  groups
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  groups: Group[];
}) {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [recordTypes, setRecordTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragItem, setDragItem] = useState<{ timeOrder: number; groupId: number; name: string } | null>(null);

  const scheduleSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (isOpen) {
      fetchSchedule();
    }
  }, [isOpen]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/test-sessions/${sessionId}/schedule`);
      const scheduleData = res.data.schedule || {};

      // timeSlots를 flat array로 변환
      const flatSchedule: any[] = [];
      if (scheduleData.timeSlots) {
        scheduleData.timeSlots.forEach((slot: any) => {
          (slot.assignments || []).forEach((a: any) => {
            const group = scheduleData.groups?.find((g: any) => g.id === a.group_id);
            flatSchedule.push({
              group_id: a.group_id,
              group_num: group?.group_num || 0,
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
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!confirm('스케줄을 새로 생성하시겠습니까? 기존 스케줄은 삭제됩니다.')) return;

    setGenerating(true);
    try {
      await apiClient.post(`/test-sessions/${sessionId}/schedule/generate`);
      await fetchSchedule();
    } catch (error: any) {
      alert(error.response?.data?.message || '스케줄 생성 실패');
    } finally {
      setGenerating(false);
    }
  };

  const handleScheduleDragStart = (event: DragStartEvent) => {
    const { timeOrder, groupId } = event.active.data.current as any;
    const item = schedule.find(s => s.group_id === groupId && s.time_order === timeOrder);
    setDragItem({
      timeOrder,
      groupId,
      name: item?.record_type_id ? (item.record_type_short || item.record_type_name || '?') : '휴식'
    });
  };

  const handleScheduleDragEnd = async (event: DragEndEvent) => {
    setDragItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as any;
    const overData = over.data.current as any;
    if (!activeData || !overData) return;

    if (activeData.timeOrder === overData.timeOrder && activeData.groupId === overData.groupId) return;

    try {
      await apiClient.put(`/test-sessions/${sessionId}/schedule/swap`, {
        time_order_1: activeData.timeOrder,
        group_id_1: activeData.groupId,
        time_order_2: overData.timeOrder,
        group_id_2: overData.groupId
      });
      await fetchSchedule();
    } catch (error: any) {
      alert(error.response?.data?.message || '교체 실패');
    }
  };

  // 타임별로 그룹화
  const timeOrders = [...new Set(schedule.map(s => s.time_order))].sort((a, b) => a - b);
  const groupList = [...new Set(schedule.map(s => s.group_id))];

  // 그룹 정보 매핑 (groups prop에서)
  const getGroupName = (groupId: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return `${groupId}조`;
    const mainSupervisor = group.supervisors.find(s => s.is_main);
    return mainSupervisor ? `${mainSupervisor.name}반` : `${group.group_num}조`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="순서표">
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : schedule.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-slate-400 mb-4">스케줄이 없습니다.</p>
            <Button onClick={handleGenerate} disabled={generating || groups.length === 0}>
              {generating ? '생성 중...' : '스케줄 생성'}
            </Button>
            {groups.length === 0 && (
              <p className="text-sm text-red-500 mt-2">먼저 조를 생성해주세요.</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">종목을 드래그하여 다른 셀과 교체할 수 있습니다.</p>
            {/* 스케줄 테이블 (DnD) */}
            <DndContext
              sensors={scheduleSensors}
              collisionDetection={closestCenter}
              onDragStart={handleScheduleDragStart}
              onDragEnd={handleScheduleDragEnd}
            >
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-3 py-2 text-left">타임</th>
                      {groupList.map(gId => (
                        <th key={gId} className="border px-3 py-2 text-center">
                          {getGroupName(gId)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeOrders.map(time => (
                      <tr key={time}>
                        <td className="border px-3 py-2 font-medium bg-gray-50 dark:bg-slate-900">
                          {time + 1}타임
                        </td>
                        {groupList.map(gId => {
                          const item = schedule.find(s => s.time_order === time && s.group_id === gId);
                          const typeName = item?.record_type_id
                            ? (item.record_type_short || item.record_type_name || '?')
                            : '휴식';
                          const isRest = !item?.record_type_id;
                          const cellId = `tablet-schedule-${time}-${gId}`;
                          return (
                            <TabletScheduleCell key={cellId} id={cellId} timeOrder={time} groupId={gId}>
                              <span className={isRest ? 'text-gray-500 dark:text-slate-400' : ''}>
                                {typeName}
                              </span>
                            </TabletScheduleCell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DragOverlay>
                {dragItem && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 shadow-lg">
                    {dragItem.name}
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {/* 재생성 버튼 */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
                className="min-h-12"
              >
                {generating ? '생성 중...' : '스케줄 재생성'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
