'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';

interface RecordType {
  id: number;
  record_type_id: number;
  name: string;
  short_name: string;
  unit: string;
}

interface Session {
  id: number;
  test_date: string;
  time_slot: 'morning' | 'afternoon' | 'evening';
  participant_count: number;
  group_count: number;
}

interface MonthlyTest {
  id: number;
  test_month: string;
  test_name: string;
  status: 'draft' | 'active' | 'completed';
  notes: string | null;
  record_types: RecordType[];
  sessions: Session[];
}

interface AllRecordType {
  id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁'
};

export default function MonthlyTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const router = useRouter();
  const [test, setTest] = useState<MonthlyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionSlot, setNewSessionSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [addingSession, setAddingSession] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [allRecordTypes, setAllRecordTypes] = useState<AllRecordType[]>([]);
  const [editName, setEditName] = useState('');
  const [editSelectedTypes, setEditSelectedTypes] = useState<number[]>([]);
  const [editConflicts, setEditConflicts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTest();
    fetchRecordTypes();
  }, [testId]);

  const fetchRecordTypes = async () => {
    try {
      const res = await apiClient.get('/record-types');
      setAllRecordTypes((res.data.recordTypes || []).filter((t: AllRecordType) => t.is_active));
    } catch (error) {
      console.error('종목 목록 로드 오류:', error);
    }
  };

  const fetchTest = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/monthly-tests/${testId}`);
      setTest(res.data.test);
    } catch (error) {
      console.error('테스트 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSession = async () => {
    if (!newSessionDate) {
      alert('날짜를 선택해주세요.');
      return;
    }

    try {
      setAddingSession(true);
      await apiClient.post(`/monthly-tests/${testId}/sessions`, {
        test_date: newSessionDate,
        time_slot: newSessionSlot
      });
      setShowSessionModal(false);
      setNewSessionDate('');
      fetchTest();
    } catch (error: any) {
      alert(error.response?.data?.message || '세션 추가 실패');
    } finally {
      setAddingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;

    try {
      await apiClient.delete(`/test-sessions/${sessionId}`);
      fetchTest();
    } catch (error) {
      console.error('세션 삭제 오류:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await apiClient.put(`/monthly-tests/${testId}`, {
        ...test,
        status: newStatus
      });
      setShowStatusModal(false);
      fetchTest();
    } catch (error) {
      console.error('상태 변경 오류:', error);
    }
  };

  const fetchConflicts = async () => {
    try {
      const res = await apiClient.get(`/monthly-tests/${testId}/conflicts`);
      const conflicts = res.data.conflicts || [];
      const conflictSet = new Set<string>();
      conflicts.forEach((c: { record_type_id_1: number; record_type_id_2: number }) => {
        conflictSet.add(`${c.record_type_id_1}-${c.record_type_id_2}`);
      });
      setEditConflicts(conflictSet);
    } catch (error) {
      console.error('충돌 목록 로드 오류:', error);
    }
  };

  const openEditModal = async () => {
    if (test) {
      setEditName(test.test_name);
      setEditSelectedTypes(test.record_types.map(t => t.record_type_id));
      await fetchConflicts();
      setShowEditModal(true);
    }
  };

  const toggleConflict = (id1: number, id2: number) => {
    const [smaller, larger] = id1 < id2 ? [id1, id2] : [id2, id1];
    const key = `${smaller}-${larger}`;
    setEditConflicts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isConflict = (id1: number, id2: number): boolean => {
    const [smaller, larger] = id1 < id2 ? [id1, id2] : [id2, id1];
    return editConflicts.has(`${smaller}-${larger}`);
  };

  const toggleEditType = (typeId: number) => {
    setEditSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      alert('테스트 이름을 입력해주세요.');
      return;
    }
    if (editSelectedTypes.length === 0) {
      alert('최소 1개 이상의 종목을 선택해주세요.');
      return;
    }

    try {
      setSaving(true);

      // 테스트 정보 저장
      await apiClient.put(`/monthly-tests/${testId}`, {
        test_name: editName.trim(),
        status: test?.status,
        notes: test?.notes,
        record_type_ids: editSelectedTypes
      });

      // 충돌 정보 저장 (선택된 종목만 필터링)
      const conflictsToSave = Array.from(editConflicts)
        .map(key => {
          const [id1, id2] = key.split('-').map(Number);
          return { record_type_id_1: id1, record_type_id_2: id2 };
        })
        .filter(c =>
          editSelectedTypes.includes(c.record_type_id_1) &&
          editSelectedTypes.includes(c.record_type_id_2)
        );

      await apiClient.put(`/monthly-tests/${testId}/conflicts`, {
        conflicts: conflictsToSave
      });

      setShowEditModal(false);
      fetchTest();
    } catch (error: any) {
      alert(error.response?.data?.message || '수정 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="p-6 text-center text-gray-500">
        테스트를 찾을 수 없습니다.
      </div>
    );
  }

  const getStatusBadge = (status: string, clickable = false) => {
    const baseClass = clickable
      ? 'cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-offset-1 transition-all text-lg px-4 py-1.5'
      : '';
    switch (status) {
      case 'draft':
        return <Badge variant="default" className={baseClass}>준비중 {clickable && '▾'}</Badge>;
      case 'active':
        return <Badge variant="success" className={baseClass}>진행중 {clickable && '▾'}</Badge>;
      case 'completed':
        return <Badge variant="default" className={baseClass}>완료 {clickable && '▾'}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <button
            onClick={() => router.push('/monthly-test')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 목록으로
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{test.test_name}</h1>
            <button onClick={() => setShowStatusModal(true)} title="클릭하여 상태 변경">
              {getStatusBadge(test.status, true)}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {test.status === 'draft' && (
            <Button variant="outline" onClick={openEditModal}>
              ✏️ 수정
            </Button>
          )}
          <Button onClick={() => setShowSessionModal(true)}>
            + 세션 추가
          </Button>
        </div>
      </div>

      {/* 종목 정보 */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">측정 종목</h2>
        <div className="flex flex-wrap gap-2">
          {test.record_types.map(type => (
            <Badge key={type.record_type_id} variant="info">
              {type.name} ({type.unit})
            </Badge>
          ))}
        </div>
      </Card>

      {/* 세션 목록 */}
      <h2 className="text-lg font-semibold mb-4">세션 목록</h2>
      {test.sessions.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <p className="mb-4">아직 등록된 세션이 없습니다.</p>
          <Button onClick={() => setShowSessionModal(true)}>
            첫 세션 추가하기
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {test.sessions.map(session => (
            <Card key={session.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium">
                    {new Date(session.test_date).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short'
                    })}
                  </div>
                  <Badge variant="default" className="mt-1">
                    {TIME_SLOT_LABELS[session.time_slot]}
                  </Badge>
                </div>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm text-gray-500 mb-3">
                <span className="mr-3">조: {session.group_count}개</span>
                <span>참가자: {session.participant_count}명</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/monthly-test/${testId}/${session.id}`)}
                >
                  조 편성
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1"
                  onClick={() => router.push(`/monthly-test/${testId}/${session.id}/records`)}
                >
                  기록 측정
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 세션 추가 모달 */}
      <Modal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        title="세션 추가"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">날짜</label>
            <input
              type="date"
              value={newSessionDate}
              onChange={e => setNewSessionDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">시간대</label>
            <select
              value={newSessionSlot}
              onChange={e => setNewSessionSlot(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="morning">오전</option>
              <option value="afternoon">오후</option>
              <option value="evening">저녁</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowSessionModal(false)}>
              취소
            </Button>
            <Button onClick={handleAddSession} disabled={addingSession}>
              {addingSession ? '추가 중...' : '추가'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 상태 변경 모달 */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="테스트 상태 변경"
      >
        <div className="space-y-3">
          <button
            onClick={() => handleStatusChange('draft')}
            className={`w-full p-3 text-left border rounded-lg hover:bg-gray-50 ${
              test.status === 'draft' ? 'border-blue-500 bg-blue-50' : ''
            }`}
          >
            <div className="font-medium">준비중</div>
            <div className="text-sm text-gray-500">테스트 준비 단계</div>
          </button>
          <button
            onClick={() => handleStatusChange('active')}
            className={`w-full p-3 text-left border rounded-lg hover:bg-gray-50 ${
              test.status === 'active' ? 'border-green-500 bg-green-50' : ''
            }`}
          >
            <div className="font-medium">진행중</div>
            <div className="text-sm text-gray-500">테스트 진행 중 (전광판 활성화)</div>
          </button>
          <button
            onClick={() => handleStatusChange('completed')}
            className={`w-full p-3 text-left border rounded-lg hover:bg-gray-50 ${
              test.status === 'completed' ? 'border-gray-500 bg-gray-50' : ''
            }`}
          >
            <div className="font-medium">완료</div>
            <div className="text-sm text-gray-500">테스트 종료</div>
          </button>
        </div>
      </Modal>

      {/* 수정 모달 (준비중 상태에서만) */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="테스트 수정"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">테스트 이름</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">측정 종목 선택</label>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {allRecordTypes.map(type => (
                <label
                  key={type.id}
                  className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                    editSelectedTypes.includes(type.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={editSelectedTypes.includes(type.id)}
                    onChange={() => toggleEditType(type.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    {type.name}
                    <span className="text-gray-400 ml-1">({type.unit})</span>
                  </span>
                </label>
              ))}
            </div>
            {editSelectedTypes.length > 0 && (
              <p className="text-sm text-blue-600 mt-2">
                {editSelectedTypes.length}개 종목 선택됨
              </p>
            )}
          </div>

          {/* 충돌 종목 설정 매트릭스 */}
          {editSelectedTypes.length >= 2 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                충돌 종목 설정 <span className="text-gray-400 font-normal">(같은 장소/장비 사용)</span>
              </label>
              <div className="border rounded-lg p-3 bg-gray-50 max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th></th>
                      {editSelectedTypes.slice(1).map(id => {
                        const type = allRecordTypes.find(t => t.id === id);
                        return (
                          <th key={id} className="text-center px-2 py-1 text-xs font-medium text-gray-600">
                            {type?.short_name || type?.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {editSelectedTypes.slice(0, -1).map((rowId, rowIndex) => {
                      const rowType = allRecordTypes.find(t => t.id === rowId);
                      return (
                        <tr key={rowId}>
                          <td className="pr-3 py-1 text-xs font-medium text-gray-600 whitespace-nowrap">
                            {rowType?.short_name || rowType?.name}
                          </td>
                          {editSelectedTypes.slice(1).map((colId, colIndex) => {
                            if (colIndex < rowIndex) {
                              return <td key={colId}></td>;
                            }
                            return (
                              <td key={colId} className="text-center px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => toggleConflict(rowId, colId)}
                                  className={`w-6 h-6 rounded border-2 transition-colors ${
                                    isConflict(rowId, colId)
                                      ? 'bg-red-500 border-red-600 text-white'
                                      : 'bg-white border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  {isConflict(rowId, colId) && '✕'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {editConflicts.size > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  {editConflicts.size}개 충돌 설정됨
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              취소
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving || editSelectedTypes.length === 0}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
