'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
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

interface RecordType {
  id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
}

export default function MonthlyTestListPage() {
  const router = useRouter();
  const [tests, setTests] = useState<MonthlyTest[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 생성 폼 상태
  const [newTestMonth, setNewTestMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [newTestName, setNewTestName] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [testsRes, typesRes] = await Promise.all([
        apiClient.get('/monthly-tests'),
        apiClient.get('/record-types')
      ]);
      setTests(testsRes.data.tests || []);
      setRecordTypes((typesRes.data.recordTypes || []).filter((t: RecordType) => t.is_active));
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTestMonth || selectedTypes.length === 0) {
      alert('월과 종목을 선택해주세요.');
      return;
    }

    try {
      setCreating(true);
      const [year, month] = newTestMonth.split('-');
      const defaultName = `${year}. ${parseInt(month)}월 실기 테스트`;

      await apiClient.post('/monthly-tests', {
        test_month: newTestMonth,
        test_name: newTestName || defaultName,
        record_type_ids: selectedTypes
      });

      setShowCreateModal(false);
      setNewTestName('');
      setSelectedTypes([]);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까? 모든 세션과 참가자 정보가 삭제됩니다.')) return;

    try {
      await apiClient.delete(`/monthly-tests/${id}`);
      fetchData();
    } catch (error) {
      console.error('삭제 오류:', error);
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

  const toggleType = (typeId: number) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">월말테스트</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          + 새 테스트 만들기
        </Button>
      </div>

      {tests.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <p className="mb-4">아직 등록된 월말테스트가 없습니다.</p>
          <Button onClick={() => setShowCreateModal(true)}>
            첫 테스트 만들기
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tests.map(test => (
            <Card key={test.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold">{test.test_name}</h2>
                    {getStatusBadge(test.status)}
                  </div>
                  <div className="text-sm text-gray-500 space-x-4">
                    <span>세션: {test.session_count}개</span>
                    <span>참가자: {test.participant_count}명</span>
                    <span>생성일: {new Date(test.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/monthly-test/${test.id}`)}
                  >
                    상세보기
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(test.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    삭제
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="새 월말테스트 만들기"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">테스트 월</label>
            <input
              type="month"
              value={newTestMonth}
              onChange={e => setNewTestMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">테스트 이름 (선택)</label>
            <input
              type="text"
              value={newTestName}
              onChange={e => setNewTestName(e.target.value)}
              placeholder="예: 2026. 1월 실기 테스트"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">측정 종목 선택</label>
            <div className="grid grid-cols-2 gap-2">
              {recordTypes.map(type => (
                <label
                  key={type.id}
                  className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedTypes.includes(type.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type.id)}
                    onChange={() => toggleType(type.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    {type.name}
                    <span className="text-gray-400 ml-1">({type.unit})</span>
                  </span>
                </label>
              ))}
            </div>
            {selectedTypes.length > 0 && (
              <p className="text-sm text-blue-600 mt-2">
                {selectedTypes.length}개 종목 선택됨
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              취소
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || selectedTypes.length === 0}
            >
              {creating ? '생성 중...' : '생성'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
