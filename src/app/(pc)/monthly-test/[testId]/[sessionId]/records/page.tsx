'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

interface RecordType {
  id: number;
  record_type_id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
}

interface Participant {
  id: number;
  student_id?: number;
  test_applicant_id?: number;
  name: string;
  gender: 'M' | 'F';
  school?: string;
  grade?: string;
  participant_type: string;
  records: Record<number, number>;
}

interface Session {
  id: number;
  test_date: string;
  time_slot: string;
  test_name?: string;
  monthly_test_id?: number;
}

export default function SessionRecordsPage({
  params
}: {
  params: Promise<{ testId: string; sessionId: string }>
}) {
  const { testId, sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, Record<number, string>>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/test-sessions/${sessionId}/records`);
      setSession(res.data.session);
      setRecordTypes(res.data.record_types || []);
      setParticipants(res.data.participants || []);

      // 첫 종목 선택
      if (res.data.record_types?.length > 0 && !selectedTypeId) {
        setSelectedTypeId(res.data.record_types[0].record_type_id);
      }

      // 기존 기록으로 inputs 초기화
      const initialInputs: Record<string, Record<number, string>> = {};
      res.data.participants?.forEach((p: Participant) => {
        const key = p.student_id ? `s_${p.student_id}` : `a_${p.test_applicant_id}`;
        initialInputs[key] = {};
        Object.entries(p.records || {}).forEach(([typeId, value]) => {
          initialInputs[key][parseInt(typeId)] = String(value);
        });
      });
      setInputs(initialInputs);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const getParticipantKey = (p: Participant): string => {
    return p.student_id ? `s_${p.student_id}` : `a_${p.test_applicant_id}`;
  };

  const handleInputChange = (participant: Participant, typeId: number, value: string) => {
    const key = getParticipantKey(participant);
    setInputs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [typeId]: value
      }
    }));
    // 저장 상태 초기화
    setSavedMap(prev => ({ ...prev, [`${key}-${typeId}`]: false }));
  };

  const handleSave = async (participant: Participant, typeId: number) => {
    const key = getParticipantKey(participant);
    const value = inputs[key]?.[typeId];

    if (!value || isNaN(parseFloat(value))) return;

    try {
      setSaving(true);
      await apiClient.post(`/test-sessions/${sessionId}/records/batch`, {
        records: [{
          student_id: participant.student_id,
          test_applicant_id: participant.test_applicant_id,
          record_type_id: typeId,
          value: parseFloat(value)
        }]
      });
      setSavedMap(prev => ({ ...prev, [`${key}-${typeId}`]: true }));
    } catch (error) {
      console.error('저장 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    const records: any[] = [];

    participants.forEach(p => {
      const key = getParticipantKey(p);
      recordTypes.forEach(type => {
        const value = inputs[key]?.[type.record_type_id];
        if (value && !isNaN(parseFloat(value))) {
          records.push({
            student_id: p.student_id,
            test_applicant_id: p.test_applicant_id,
            record_type_id: type.record_type_id,
            value: parseFloat(value)
          });
        }
      });
    });

    if (records.length === 0) {
      alert('저장할 기록이 없습니다.');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post(`/test-sessions/${sessionId}/records/batch`, { records });
      alert(`${records.length}개 기록이 저장되었습니다.`);
      fetchData();
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllRecords = async () => {
    if (!confirm('이 세션의 모든 기록을 삭제하시겠습니까?\n\n⚠️ 재원생 기록도 해당 날짜 기록이 삭제됩니다.')) return;

    try {
      setSaving(true);
      const res = await apiClient.delete(`/test-sessions/${sessionId}/records`);
      alert(`${res.data.deleted?.total || 0}개 기록이 삭제되었습니다.`);
      fetchData();
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = recordTypes.find(t => t.record_type_id === selectedTypeId);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => router.push(`/monthly-test/${testId}/${sessionId}`)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 조 편성으로 돌아가기
          </button>
          <h1 className="text-xl font-bold">
            기록 측정
          </h1>
          <div className="text-sm text-gray-500">
            {session && new Date(session.test_date).toLocaleDateString('ko-KR')} | 참가자 {participants.length}명
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDeleteAllRecords} disabled={saving}>
            🗑️ 기록 전체 삭제
          </Button>
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? '저장 중...' : '전체 저장'}
          </Button>
        </div>
      </div>

      {/* 종목 탭 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {recordTypes.map(type => (
          <button
            key={type.record_type_id}
            onClick={() => setSelectedTypeId(type.record_type_id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedTypeId === type.record_type_id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {type.short_name || type.name}
            <span className="text-xs ml-1 opacity-70">({type.unit})</span>
          </button>
        ))}
      </div>

      {/* 기록 입력 테이블 */}
      {selectedType && (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">이름</th>
                <th className="px-4 py-3 text-left text-sm font-medium">성별</th>
                <th className="px-4 py-3 text-left text-sm font-medium">유형</th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {selectedType.name} ({selectedType.unit})
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium w-24">저장</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {participants.map(p => {
                const key = getParticipantKey(p);
                const value = inputs[key]?.[selectedType.record_type_id] || '';
                const isSaved = savedMap[`${key}-${selectedType.record_type_id}`];

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                        p.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                      }`}>
                        {p.gender === 'M' ? '남' : '여'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${typeColors[p.participant_type]}`}>
                        {typeLabels[p.participant_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={value}
                        onChange={e => handleInputChange(p, selectedType.record_type_id, e.target.value)}
                        onBlur={() => handleSave(p, selectedType.record_type_id)}
                        placeholder={`${selectedType.unit} 입력`}
                        className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isSaved && (
                        <span className="text-green-500">✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {participants.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              참가자가 없습니다. 조 편성에서 학생을 추가해주세요.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
