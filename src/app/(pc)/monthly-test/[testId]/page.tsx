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

  useEffect(() => {
    fetchTest();
  }, [testId]);

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

  const copyBoardUrl = () => {
    // TODO: 실제 슬러그 사용
    const url = `${window.location.origin}/board/ilsan-max`;
    navigator.clipboard.writeText(url);
    alert('전광판 URL이 복사되었습니다.');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="default">준비중</Badge>;
      case 'active':
        return <Badge variant="success">진행중</Badge>;
      case 'completed':
        return <Badge variant="default">완료</Badge>;
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
            <button onClick={() => setShowStatusModal(true)}>
              {getStatusBadge(test.status)}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyBoardUrl}>
            📋 전광판 URL 복사
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open('/board/ilsan-max', '_blank')}
          >
            📺 전광판 미리보기
          </Button>
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
    </div>
  );
}
