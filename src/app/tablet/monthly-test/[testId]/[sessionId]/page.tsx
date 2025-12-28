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
      className="bg-white border rounded-xl p-3 mb-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow touch-none"
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
            <div className="text-xs text-gray-400 truncate">
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
    <div className="w-64 flex-shrink-0 bg-white rounded-xl border shadow-sm flex flex-col">
      {/* 조 헤더 */}
      <div className="flex justify-between items-center px-4 py-3 border-b bg-gray-50 rounded-t-xl">
        <span className="font-semibold text-lg">{groupTitle}</span>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{group.participants.length}명</span>
          <button
            onClick={onDeleteGroup}
            className="ml-2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 감독관 영역 */}
      <div
        ref={setSupervisorsRef}
        className={`p-3 border-b min-h-[56px] flex flex-wrap gap-2 transition-colors ${
          isOverSupervisors ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50'
        }`}
      >
        {group.supervisors.length === 0 ? (
          <span className="text-sm text-gray-400">감독관을 여기에 드롭</span>
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
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
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
        isOver ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-400' : 'border-gray-300'
      }`}
    >
      <div className="text-center text-gray-400">
        <div className="text-4xl mb-2">+</div>
        <div className="text-base">감독관 드롭하여<br/>새 조 생성</div>
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

  // 터치 센서 (태블릿 최적화)
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 }
    }),
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
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

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
          return; // 유효하지 않은 드롭 위치
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

  const { setNodeRef: setWaitingParticipantsRef, isOver: isOverWaitingP } = useDroppable({
    id: 'waiting-participants',
    data: { type: 'waiting-participants' }
  });

  const { setNodeRef: setWaitingSupervisorsRef, isOver: isOverWaitingS } = useDroppable({
    id: 'waiting-supervisors',
    data: { type: 'waiting-supervisors' }
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
      <div className="p-4 min-h-screen flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <button
              onClick={() => router.push(`/tablet/monthly-test/${testId}`)}
              className="text-sm text-gray-500 hover:text-gray-700 min-h-12 flex items-center"
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

        {/* 기록측정 버튼 */}
        <div className="mb-4">
          <Button
            variant="primary"
            size="lg"
            className="w-full min-h-14 text-lg"
            onClick={() => router.push(`/tablet/monthly-test/${testId}/${sessionId}/records`)}
          >
            📝 기록 측정
          </Button>
        </div>

        {/* 메인 영역 - 세로로 배치 (태블릿 최적화) */}
        <div className="flex-1 flex flex-col gap-4">
          {/* 대기 영역 */}
          <div className="flex gap-4">
            {/* 감독관 대기 */}
            <Card className="flex-1">
              <div className="p-3 border-b bg-gray-50 font-medium">
                감독관 대기 ({waitingInstructors.length})
              </div>
              <div
                ref={setWaitingSupervisorsRef}
                className={`p-3 min-h-[70px] flex flex-wrap gap-2 transition-colors ${
                  isOverWaitingS ? 'bg-blue-100 ring-2 ring-blue-400' : ''
                }`}
              >
                {waitingInstructors.length === 0 ? (
                  <span className="text-sm text-gray-400">감독관을 여기로 드롭하면 미배치</span>
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
              className={`flex-1 max-h-[200px] overflow-hidden flex flex-col rounded-lg border bg-white shadow-sm transition-colors ${
                isOverWaitingP ? 'ring-2 ring-green-400 bg-green-50' : ''
              }`}
            >
              <div className="p-3 border-b bg-gray-50 font-medium rounded-t-lg">
                미배치 학생 ({waitingParticipants.length})
              </div>
              <div className={`flex-1 p-3 overflow-y-auto ${isOverWaitingP ? 'bg-green-100' : ''}`}>
                {waitingParticipants.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    학생을 여기로 드롭하면 미배치
                  </div>
                ) : (
                  waitingParticipants.map(p => (
                    <DraggableParticipant key={p.id} participant={p} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 조 영역 - 가로 스크롤 */}
          <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-4 min-h-[350px]">
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
          <div className="bg-white border rounded-xl p-3 shadow-lg">
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
                    className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 min-h-14"
                  >
                    + 새 테스트신규 등록
                  </button>
                ) : (
                  <div className="p-4 border rounded-xl bg-gray-50 space-y-3">
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
                      <input
                        type="text"
                        placeholder="학년"
                        value={newGrade}
                        onChange={e => setNewGrade(e.target.value)}
                        className="w-24 px-4 py-3 border rounded-xl"
                      />
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
              <div className="text-center py-8 text-gray-500">
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
                      selected.has(item.id) ? 'bg-blue-50 border-2 border-blue-400' : 'bg-gray-50 hover:bg-gray-100'
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
                    <span className="text-sm text-gray-500">
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
          <span className="text-sm text-gray-500">
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
