'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ChevronLeft, Trophy, Medal, Award } from 'lucide-react';

interface RecordType {
  id: number;
  record_type_id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
}

interface Participant {
  student_id?: number;
  test_applicant_id?: number;
  name: string;
  gender: 'M' | 'F';
  school?: string;
  grade?: string;
  participant_type: string;
  records: Record<number, number>;
  scores: Record<number, number | null>;
  total_score: number;
  scored_count: number;
}

interface Test {
  id: number;
  test_name: string;
  test_month: string;
  status: string;
}

const GENDER_LABELS: Record<string, string> = {
  M: '남',
  F: '여'
};

export default function TabletRankingsPage({
  params
}: {
  params: Promise<{ testId: string }>
}) {
  const { testId } = use(params);
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState<number | 'total'>('total');
  const [genderFilter, setGenderFilter] = useState<'all' | 'M' | 'F'>('all');

  useEffect(() => {
    fetchData();
  }, [testId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/monthly-tests/${testId}/all-records`);
      setTest(res.data.test);
      setRecordTypes(res.data.record_types || []);
      setParticipants(res.data.participants || []);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 정렬 및 순위 계산
  const rankedParticipants = useMemo(() => {
    let filtered = participants;

    // 성별 필터
    if (genderFilter !== 'all') {
      filtered = filtered.filter(p => p.gender === genderFilter);
    }

    // 정렬
    let sorted: Participant[];
    if (selectedTypeId === 'total') {
      // 종합 순위: 총점 내림차순
      sorted = [...filtered].sort((a, b) => b.total_score - a.total_score);
    } else {
      // 종목별 순위
      const type = recordTypes.find(t => t.record_type_id === selectedTypeId);
      const direction = type?.direction || 'higher';

      sorted = [...filtered].sort((a, b) => {
        const aVal = a.records[selectedTypeId] ?? (direction === 'higher' ? -Infinity : Infinity);
        const bVal = b.records[selectedTypeId] ?? (direction === 'higher' ? -Infinity : Infinity);
        return direction === 'higher' ? bVal - aVal : aVal - bVal;
      });
    }

    // 순위 부여 (동점자 처리)
    let rank = 1;
    let prevValue: number | null = null;

    return sorted.map((p, idx) => {
      let currentValue: number;
      if (selectedTypeId === 'total') {
        currentValue = p.total_score;
      } else {
        currentValue = p.records[selectedTypeId] ?? 0;
      }

      if (idx > 0 && currentValue !== prevValue) {
        rank = idx + 1;
      }
      prevValue = currentValue;

      return { ...p, rank };
    });
  }, [participants, genderFilter, selectedTypeId, recordTypes]);

  // 기록 포맷팅
  const formatValue = (value: number | undefined, unit: string): string => {
    if (value === undefined || value === null) return '-';
    if (unit === '초') {
      return value.toFixed(2);
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };

  // 순위 아이콘
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="text-yellow-500" size={20} />;
    if (rank === 2) return <Medal className="text-gray-400 dark:text-slate-500" size={20} />;
    if (rank === 3) return <Award className="text-amber-600" size={20} />;
    return <span className="w-5 text-center text-gray-500 dark:text-slate-400">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  const selectedType = selectedTypeId !== 'total'
    ? recordTypes.find(t => t.record_type_id === selectedTypeId)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-6">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/tablet/monthly-test/${testId}`)}
            className="min-h-10 min-w-10 p-0"
          >
            <ChevronLeft size={24} />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{test?.test_name || '월말테스트'}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              전체 순위 · {rankedParticipants.length}명
            </p>
          </div>
        </div>

        {/* 성별 필터 */}
        <div className="px-4 pb-2 flex gap-2">
          {(['all', 'M', 'F'] as const).map(g => (
            <Button
              key={g}
              variant={genderFilter === g ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setGenderFilter(g)}
              className="min-h-9"
            >
              {g === 'all' ? '전체' : GENDER_LABELS[g]}
            </Button>
          ))}
        </div>

        {/* 종목 탭 */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          <Button
            variant={selectedTypeId === 'total' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedTypeId('total')}
            className="min-h-10 whitespace-nowrap"
          >
            종합
          </Button>
          {recordTypes.map(type => (
            <Button
              key={type.record_type_id}
              variant={selectedTypeId === type.record_type_id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedTypeId(type.record_type_id)}
              className="min-h-10 whitespace-nowrap"
            >
              {type.short_name || type.name}
            </Button>
          ))}
        </div>
      </div>

      {/* 순위 테이블 */}
      <div className="px-4 mt-4">
        <Card className="overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="bg-gray-100 dark:bg-slate-900 px-4 py-3 grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 dark:text-slate-400 border-b">
            <div className="col-span-1 text-center">순위</div>
            <div className="col-span-3">이름</div>
            <div className="col-span-1 text-center">성별</div>
            <div className="col-span-2">학교</div>
            {selectedTypeId === 'total' ? (
              <>
                <div className="col-span-3 text-center">종목별 점수</div>
                <div className="col-span-2 text-center">총점</div>
              </>
            ) : (
              <>
                <div className="col-span-2 text-center">기록</div>
                <div className="col-span-3 text-center">점수</div>
              </>
            )}
          </div>

          {/* 테이블 바디 */}
          <div className="divide-y">
            {rankedParticipants.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                참가자가 없습니다
              </div>
            ) : (
              rankedParticipants.map((p) => (
                <div
                  key={p.student_id || p.test_applicant_id}
                  className={`px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm ${
                    (p as any).rank <= 3 ? 'bg-amber-50' : ''
                  }`}
                >
                  {/* 순위 */}
                  <div className="col-span-1 flex justify-center">
                    {getRankIcon((p as any).rank)}
                  </div>

                  {/* 이름 */}
                  <div className="col-span-3 font-medium truncate">
                    {p.name}
                    {p.participant_type === 'test_new' && (
                      <span className="ml-1 text-xs text-orange-500">(신규)</span>
                    )}
                  </div>

                  {/* 성별 */}
                  <div className="col-span-1 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      p.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                    }`}>
                      {GENDER_LABELS[p.gender]}
                    </span>
                  </div>

                  {/* 학교 */}
                  <div className="col-span-2 text-gray-600 dark:text-slate-400 truncate text-xs">
                    {p.school || '-'}
                  </div>

                  {selectedTypeId === 'total' ? (
                    <>
                      {/* 종목별 점수 */}
                      <div className="col-span-3 flex gap-1 flex-wrap justify-center">
                        {recordTypes.map(type => (
                          <span
                            key={type.record_type_id}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-900 rounded"
                            title={type.name}
                          >
                            {p.scores[type.record_type_id] ?? '-'}
                          </span>
                        ))}
                      </div>

                      {/* 총점 */}
                      <div className="col-span-2 text-center">
                        <span className="font-bold text-lg text-indigo-600">
                          {p.total_score}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">점</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 기록 */}
                      <div className="col-span-2 text-center font-medium">
                        {formatValue(p.records[selectedTypeId], selectedType?.unit || '')}
                        <span className="text-xs text-gray-400 dark:text-slate-500 ml-0.5">
                          {selectedType?.unit}
                        </span>
                      </div>

                      {/* 점수 */}
                      <div className="col-span-3 text-center">
                        <span className="font-bold text-lg text-indigo-600">
                          {p.scores[selectedTypeId] ?? '-'}
                        </span>
                        {p.scores[selectedTypeId] !== null && (
                          <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">점</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
