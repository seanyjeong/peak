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

export default function TabletMonthlyTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const router = useRouter();
  const [test, setTest] = useState<MonthlyTest | null>(null);
  const [loading, setLoading] = useState(true);
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
      <div className="p-6 text-center text-gray-500">
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
          className="text-sm text-gray-500 hover:text-gray-700 min-h-12 flex items-center"
        >
          ← 목록으로
        </button>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold">{test.test_name}</h1>
          <button onClick={() => setShowStatusModal(true)} title="클릭하여 상태 변경">
            {getStatusBadge(test.status, true)}
          </button>
        </div>
      </div>

      {/* 종목 정보 */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">측정 종목</h2>
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
        <Card className="p-8 text-center text-gray-500">
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
                <div className="text-sm text-gray-500 text-right">
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
            className={`w-full p-4 text-left border rounded-xl hover:bg-gray-50 min-h-16 ${
              test.status === 'draft' ? 'border-blue-500 bg-blue-50' : ''
            }`}
          >
            <div className="font-medium text-lg">준비중</div>
            <div className="text-sm text-gray-500">테스트 준비 단계</div>
          </button>
          <button
            onClick={() => handleStatusChange('active')}
            className={`w-full p-4 text-left border rounded-xl hover:bg-gray-50 min-h-16 ${
              test.status === 'active' ? 'border-green-500 bg-green-50' : ''
            }`}
          >
            <div className="font-medium text-lg">진행중</div>
            <div className="text-sm text-gray-500">테스트 진행 중 (전광판 활성화)</div>
          </button>
          <button
            onClick={() => handleStatusChange('completed')}
            className={`w-full p-4 text-left border rounded-xl hover:bg-gray-50 min-h-16 ${
              test.status === 'completed' ? 'border-gray-500 bg-gray-50' : ''
            }`}
          >
            <div className="font-medium text-lg">완료</div>
            <div className="text-sm text-gray-500">테스트 종료</div>
          </button>
        </div>
      </Modal>
    </div>
  );
}
