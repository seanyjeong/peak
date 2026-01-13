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

export default function TabletSessionRecordsPage({
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
  const [errorMap, setErrorMap] = useState<Record<string, boolean>>({});
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetchData();
    return () => {
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

      if (res.data.record_types?.length > 0 && !selectedTypeId) {
        setSelectedTypeId(res.data.record_types[0].record_type_id);
      }

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
      setErrorMap(prev => ({ ...prev, [saveKey]: false }));
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
      setErrorMap(prev => ({ ...prev, [saveKey]: true }));
      setSavedMap(prev => ({ ...prev, [saveKey]: false }));
      // 저장 실패 알림
      alert(`⚠️ ${participant.name} 기록 저장 실패!\n다시 시도해주세요.`);
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

    setSavedMap(prev => ({ ...prev, [saveKey]: false }));

    if (saveTimers.current[saveKey]) {
      clearTimeout(saveTimers.current[saveKey]);
    }

    if (value && !isNaN(parseFloat(value))) {
      saveTimers.current[saveKey] = setTimeout(() => {
        saveRecord(participant, typeId, value);
      }, 500);
    }
  };

  const selectedType = recordTypes.find(t => t.record_type_id === selectedTypeId);

  const filteredParticipants = selectedGroupId === null
    ? participants
    : participants.filter(p => p.test_group_id === selectedGroupId);

  const typeColors: Record<string, string> = {
    enrolled: 'bg-green-100 text-green-700',
    rest: 'bg-gray-100 dark:bg-slate-900 text-gray-600',
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
    <div className="p-4">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 min-h-12 flex items-center"
          >
            ← 뒤로가기
          </button>
          <h1 className="text-xl font-bold">기록 측정</h1>
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {session && new Date(session.test_date).toLocaleDateString('ko-KR')} | {filteredParticipants.length}명
          </div>
        </div>
      </div>

      {/* 강사별 필터 - 터치 친화적 */}
      {groups.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
          <button
            onClick={() => setSelectedGroupId(null)}
            className={`px-5 py-3 rounded-xl whitespace-nowrap transition-colors min-h-12 text-base font-medium ${
              selectedGroupId === null
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:bg-slate-700'
            }`}
          >
            전체 ({participants.length})
          </button>
          {groups.map(group => {
            const mainInstructor = group.instructors.find(i => i.is_main);
            const groupParticipants = participants.filter(p => p.test_group_id === group.id);
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`px-5 py-3 rounded-xl whitespace-nowrap transition-colors min-h-12 text-base font-medium ${
                  selectedGroupId === group.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:bg-slate-700'
                }`}
              >
                {mainInstructor?.name || `${group.group_num}조`}
                <span className={`text-sm ml-1 ${selectedGroupId === group.id ? 'text-blue-200' : 'text-gray-500 dark:text-slate-400'}`}>
                  ({groupParticipants.length})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 종목 탭 - 터치 친화적 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
        {recordTypes.map(type => (
          <button
            key={type.record_type_id}
            onClick={() => setSelectedTypeId(type.record_type_id)}
            className={`px-5 py-3 rounded-xl whitespace-nowrap transition-colors min-h-12 text-base font-medium ${
              selectedTypeId === type.record_type_id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:bg-slate-700'
            }`}
          >
            {type.short_name || type.name}
            <span className="text-sm ml-1 opacity-70">({type.unit})</span>
          </button>
        ))}
      </div>

      {/* 기록 입력 카드 - 태블릿 터치 최적화 */}
      {selectedType && (
        <div className="space-y-3">
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
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  {/* 학생 정보 */}
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      p.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    }`}>
                      {p.gender === 'M' ? '남' : '여'}
                    </span>
                    <div>
                      <div className="font-medium text-lg">{p.name}</div>
                      <span className={`text-xs px-2 py-0.5 rounded ${typeColors[p.participant_type]}`}>
                        {typeLabels[p.participant_type]}
                      </span>
                    </div>
                  </div>

                  {/* 기록 입력 */}
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={value}
                      onChange={e => handleInputChange(p, selectedType.record_type_id, e.target.value)}
                      placeholder={selectedType.unit}
                      className="w-28 px-4 py-3 text-lg border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                    />

                    {/* 점수 */}
                    <div className="w-16 text-center">
                      {value && !isNaN(numValue) ? (
                        <span className={`font-bold text-xl ${
                          score >= 80 ? 'text-green-600' :
                          score >= 60 ? 'text-blue-600' :
                          score >= 40 ? 'text-yellow-600' :
                          'text-gray-500 dark:text-slate-400'
                        }`}>
                          {score}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600">-</span>
                      )}
                    </div>

                    {/* 저장 상태 */}
                    <div className="w-8 text-center">
                      {isSaving ? (
                        <span className="text-blue-500 text-lg">...</span>
                      ) : errorMap[saveKey] ? (
                        <span className="text-red-500 text-xl">✗</span>
                      ) : isSaved ? (
                        <span className="text-green-500 text-xl">✓</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {filteredParticipants.length === 0 && (
            <Card className="p-8 text-center text-gray-500 dark:text-slate-400">
              {selectedGroupId === null
                ? '참가자가 없습니다.'
                : '이 조에 배치된 학생이 없습니다.'}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
