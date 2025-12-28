'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

interface MonthlyTest {
  id: number;
  test_month: string;
  test_name: string;
  status: 'draft' | 'active' | 'completed';
  notes: string | null;
  session_count: number;
  participant_count: number;
  created_at: string;
}

export default function TabletMonthlyTestListPage() {
  const router = useRouter();
  const [tests, setTests] = useState<MonthlyTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/monthly-tests');
      setTests(res.data.tests || []);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">월말테스트</h1>
      </div>

      {tests.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <p>등록된 월말테스트가 없습니다.</p>
          <p className="text-sm mt-2">PC에서 테스트를 생성해주세요.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map(test => (
            <Card
              key={test.id}
              className="p-4 cursor-pointer active:bg-gray-50"
              onClick={() => router.push(`/tablet/monthly-test/${test.id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold">{test.test_name}</h2>
                    {getStatusBadge(test.status)}
                  </div>
                  <div className="text-sm text-gray-500 flex gap-4">
                    <span>세션 {test.session_count}개</span>
                    <span>참가자 {test.participant_count}명</span>
                  </div>
                </div>
                <span className="text-gray-400 text-2xl">›</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
