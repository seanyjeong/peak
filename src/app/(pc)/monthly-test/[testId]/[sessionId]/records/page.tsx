'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

interface RecordType {
  id: number;
  record_type_id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
}

interface ScoreRange {
  score: number;
  male_min: number | null;
  male_max: number | null;
  female_min: number | null;
  female_max: number | null;
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
  test_group_id?: number;
}

interface Instructor {
  instructor_id: number;
  name: string;
  is_main: boolean;
}

interface Group {
  id: number;
  group_num: number;
  instructors: Instructor[];
}

interface Session {
  id: number;
  test_date: string;
  time_slot: string;
  test_name?: string;
  monthly_test_id?: number;
}

// 점수 계산 함수 (범위 내에서 매칭)
const calculateScore = (value: number, ranges: ScoreRange[], gender: 'M' | 'F'): number => {
  if (!value || !ranges || ranges.length === 0) return 0;

  const genderKey = gender === 'M' ? 'male' : 'female';

  for (const range of ranges) {
    const min = range[`${genderKey}_min` as keyof ScoreRange] as number | null;
    const max = range[`${genderKey}_max` as keyof ScoreRange] as number | null;

    if (min !== null && max !== null) {
      if (value >= min && value <= max) {
        return range.score;
      }
    } else if (min !== null && value >= min) {
      return range.score;
    } else if (max !== null && value <= max) {
      return range.score;
    }
  }

  return 0;
};

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
  const [groups, setGroups] = useState<Group[]>([]);
  const [scoreRanges, setScoreRanges] = useState<Record<number, ScoreRange[]>>({});
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, Record<number, string>>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null); // null = 전체

  // Debounce timers
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetchData();
    return () => {
      // Cleanup timers
      Object.values(saveTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, [sessionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/test-sessions/${sessionId}/records`);
      setSession(res.data.session);
      setRecordTypes(res.data.record_types || []);
      setParticipants(res.data.participants || []);
      setGroups(res.data.groups || []);
      setScoreRanges(res.data.score_ranges || {});

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

  const saveRecord = useCallback(async (participant: Participant, typeId: number, value: string) => {
    if (!value || isNaN(parseFloat(value))) return;

    const key = getParticipantKey(participant);
    const saveKey = `${key}-${typeId}`;

    try {
      setSavingMap(prev => ({ ...prev, [saveKey]: true }));
      await apiClient.post(`/test-sessions/${sessionId}/records/batch`, {
        records: [{
          student_id: participant.student_id,
          test_applicant_id: participant.test_applicant_id,
          record_type_id: typeId,
          value: parseFloat(value)
        }]
      });
      setSavedMap(prev => ({ ...prev, [saveKey]: true }));
    } catch (error) {
      console.error('저장 오류:', error);
    } finally {
      setSavingMap(prev => ({ ...prev, [saveKey]: false }));
    }
  }, [sessionId]);

  const handleInputChange = (participant: Participant, typeId: number, value: string) => {
    const key = getParticipantKey(participant);
    const saveKey = `${key}-${typeId}`;

    setInputs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [typeId]: value
      }
    }));

    // 저장 상태 초기화
    setSavedMap(prev => ({ ...prev, [saveKey]: false }));

    // 기존 타이머 취소
    if (saveTimers.current[saveKey]) {
      clearTimeout(saveTimers.current[saveKey]);
    }

    // 500ms 후 자동 저장
    if (value && !isNaN(parseFloat(value))) {
      saveTimers.current[saveKey] = setTimeout(() => {
        saveRecord(participant, typeId, value);
      }, 500);
    }
  };

  const handleDeleteAllRecords = async () => {
    if (!confirm('이 세션의 모든 기록을 삭제하시겠습니까?\n\n⚠️ 재원생 기록도 해당 날짜 기록이 삭제됩니다.')) return;

    try {
      const res = await apiClient.delete(`/test-sessions/${sessionId}/records`);
      alert(`${res.data.deleted?.total || 0}개 기록이 삭제되었습니다.`);
      fetchData();
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const selectedType = recordTypes.find(t => t.record_type_id === selectedTypeId);

  // 필터링된 참가자 (선택된 조에 속한 학생만)
  const filteredParticipants = selectedGroupId === null
    ? participants
    : participants.filter(p => p.test_group_id === selectedGroupId);

  const typeColors: Record<string, string> = {
    enrolled: 'bg-green-100 text-green-700',
    rest: 'bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-400',
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
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700"
          >
            ← 조 편성으로 돌아가기
          </button>
          <h1 className="text-xl font-bold">
            기록 측정
          </h1>
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {session && new Date(session.test_date).toLocaleDateString('ko-KR')} | 참가자 {participants.length}명
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDeleteAllRecords}>
            🗑️ 기록 전체 삭제
          </Button>
        </div>
      </div>

      {/* 강사별 필터 */}
      {groups.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedGroupId(null)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedGroupId === null
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:bg-slate-700'
            }`}
          >
            전체 ({participants.length}명)
          </button>
          {groups.map(group => {
            const mainInstructor = group.instructors.find(i => i.is_main);
            const groupParticipants = participants.filter(p => p.test_group_id === group.id);
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
                  selectedGroupId === group.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span className="font-medium">
                  {mainInstructor?.name || `${group.group_num}조`}
                </span>
                <span className={`text-xs ${selectedGroupId === group.id ? 'text-blue-200' : 'text-gray-500 dark:text-slate-400'}`}>
                  ({groupParticipants.length}명)
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 종목 탭 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {recordTypes.map(type => (
          <button
            key={type.record_type_id}
            onClick={() => setSelectedTypeId(type.record_type_id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedTypeId === type.record_type_id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:bg-slate-700'
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
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">이름</th>
                <th className="px-4 py-3 text-left text-sm font-medium">성별</th>
                <th className="px-4 py-3 text-left text-sm font-medium">유형</th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {selectedType.name} ({selectedType.unit})
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium w-20">점수</th>
                <th className="px-4 py-3 text-center text-sm font-medium w-16">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredParticipants.map(p => {
                const key = getParticipantKey(p);
                const saveKey = `${key}-${selectedType.record_type_id}`;
                const value = inputs[key]?.[selectedType.record_type_id] || '';
                const numValue = parseFloat(value);
                const score = !isNaN(numValue)
                  ? calculateScore(numValue, scoreRanges[selectedType.record_type_id] || [], p.gender)
                  : 0;
                const isSaving = savingMap[saveKey];
                const isSaved = savedMap[saveKey];

                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:bg-slate-900">
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
                        placeholder={`${selectedType.unit} 입력`}
                        className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {value && !isNaN(numValue) && (
                        <span className={`font-bold text-lg ${
                          score >= 80 ? 'text-green-600' :
                          score >= 60 ? 'text-blue-600' :
                          score >= 40 ? 'text-yellow-600' :
                          'text-gray-500 dark:text-slate-400'
                        }`}>
                          {score}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isSaving ? (
                        <span className="text-blue-500 text-sm">저장중...</span>
                      ) : isSaved ? (
                        <span className="text-green-500">✓</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredParticipants.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              {selectedGroupId === null
                ? '참가자가 없습니다. 조 편성에서 학생을 추가해주세요.'
                : '이 조에 배치된 학생이 없습니다.'}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
