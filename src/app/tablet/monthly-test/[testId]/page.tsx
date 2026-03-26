'use client';

import { useState, useEffect, use } from 'react';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { BarChart2 } from 'lucide-react';

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

export default function TabletMonthlyTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const toast = useToast();
  const { testId } = use(params);
  const router = useRouter();
  const [test, setTest] = useState<MonthlyTest | null>(null);
  const [loading, setLoading] = useState(true);
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
      toast.error(error);
    }
  };

  const fetchTest = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/monthly-tests/${testId}`);
      setTest(res.data.test);
    } catch (error) {
      console.error('테스트 로드 오류:', error);
      toast.error(error);
    } finally {
      setLoading(false);
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
      toast.error(error);
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
      toast.error(error);
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
      toast.error('테스트 이름을 입력해주세요.');
      return;
    }
    if (editSelectedTypes.length === 0) {
      toast.error('최소 1개 이상의 종목을 선택해주세요.');
      return;
    }

    try {
      setSaving(true);

      await apiClient.put(`/monthly-tests/${testId}`, {
        test_name: editName.trim(),
        status: test?.status,
        notes: test?.notes,
        record_type_ids: editSelectedTypes
      });

      // 충돌 정보 저장
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
      toast.error(error);
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-slate-400">
        테스트를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/tablet/monthly-test')}
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 min-h-12 flex items-center"
        >
          ← 목록으로
        </button>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold">{test.test_name}</h1>
          <button onClick={() => setShowStatusModal(true)} title="클릭하여 상태 변경">
            {getStatusBadge(test.status, true)}
          </button>
          <Button
            variant="outline"
            onClick={() => router.push(`/tablet/monthly-test/${testId}/rankings`)}
            className="min-h-12 flex items-center gap-2"
          >
            <BarChart2 size={18} />
            전체 순위
          </Button>
          {test.status === 'draft' && (
            <Button variant="outline" onClick={openEditModal} className="min-h-12">
              ✏️ 수정
            </Button>
          )}
        </div>
      </div>

      {/* 종목 정보 */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">측정 종목</h2>
        <div className="flex flex-wrap gap-2">
          {test.record_types.map(type => (
            <Badge key={type.record_type_id} variant="info">
              {type.short_name || type.name}
            </Badge>
          ))}
        </div>
      </Card>

      {/* 세션 목록 */}
      <h2 className="text-lg font-semibold mb-4">세션 목록</h2>
      {test.sessions.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 dark:text-slate-400">
          <p>등록된 세션이 없습니다.</p>
          <p className="text-sm mt-2">PC에서 세션을 추가해주세요.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {test.sessions.map(session => (
            <Card key={session.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-lg">
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
                <div className="text-sm text-gray-500 dark:text-slate-400 text-right">
                  <div>{session.group_count}개 조</div>
                  <div>{session.participant_count}명</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 min-h-14 text-lg"
                  onClick={() => router.push(`/tablet/monthly-test/${testId}/${session.id}`)}
                >
                  👥 조 편성
                </Button>
                <Button
                  size="lg"
                  variant="primary"
                  className="flex-1 min-h-14 text-lg"
                  onClick={() => router.push(`/tablet/monthly-test/${testId}/${session.id}/records`)}
                >
                  📝 기록 측정
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 상태 변경 모달 */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="테스트 상태 변경"
      >
        <div className="space-y-3">
          <button
            onClick={() => handleStatusChange('draft')}
            className={`w-full p-4 text-left border rounded-xl hover:bg-gray-50 dark:bg-slate-900 min-h-16 ${
              test.status === 'draft' ? 'border-blue-500 bg-blue-50' : ''
            }`}
          >
            <div className="font-medium text-lg">준비중</div>
            <div className="text-sm text-gray-500 dark:text-slate-400">테스트 준비 단계</div>
          </button>
          <button
            onClick={() => handleStatusChange('active')}
            className={`w-full p-4 text-left border rounded-xl hover:bg-gray-50 dark:bg-slate-900 min-h-16 ${
              test.status === 'active' ? 'border-green-500 bg-green-50' : ''
            }`}
          >
            <div className="font-medium text-lg">진행중</div>
            <div className="text-sm text-gray-500 dark:text-slate-400">테스트 진행 중 (전광판 활성화)</div>
          </button>
          <button
            onClick={() => handleStatusChange('completed')}
            className={`w-full p-4 text-left border rounded-xl hover:bg-gray-50 dark:bg-slate-900 min-h-16 ${
              test.status === 'completed' ? 'border-gray-500 bg-gray-50 dark:bg-slate-900' : ''
            }`}
          >
            <div className="font-medium text-lg">완료</div>
            <div className="text-sm text-gray-500 dark:text-slate-400">테스트 종료</div>
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
              className="w-full px-4 py-3 border rounded-xl text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">측정 종목 선택</label>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {allRecordTypes.map(type => (
                <label
                  key={type.id}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors min-h-14 ${
                    editSelectedTypes.includes(type.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={editSelectedTypes.includes(type.id)}
                    onChange={() => toggleEditType(type.id)}
                    className="w-5 h-5"
                  />
                  <span className="text-base">
                    {type.name}
                    <span className="text-gray-400 dark:text-slate-500 ml-1">({type.unit})</span>
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
                충돌 종목 설정 <span className="text-gray-400 dark:text-slate-500 font-normal">(같은 장소/장비)</span>
              </label>
              <div className="border rounded-xl p-3 bg-gray-50 dark:bg-slate-900 max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th></th>
                      {editSelectedTypes.slice(1).map(id => {
                        const type = allRecordTypes.find(t => t.id === id);
                        return (
                          <th key={id} className="text-center px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-400">
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
                          <td className="pr-3 py-1 text-xs font-medium text-gray-600 dark:text-slate-400 whitespace-nowrap">
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
                                  className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                                    isConflict(rowId, colId)
                                      ? 'bg-red-500 border-red-600 text-white'
                                      : 'bg-white dark:bg-slate-800 border-gray-300'
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

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="flex-1 min-h-14 text-lg"
            >
              취소
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving || editSelectedTypes.length === 0}
              className="flex-1 min-h-14 text-lg"
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
