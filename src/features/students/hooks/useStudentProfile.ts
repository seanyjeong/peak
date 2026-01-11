'use client';

import { useState, useEffect, useMemo } from 'react';
import apiClient from '@/lib/api/client';

export interface RecordType {
  id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
}

export interface StudentStats {
  averages: Record<number, number>;
  bests: Record<number, { value: number; date: string }>;
  latests: Record<number, { value: number; date: string }>;
  scores: Record<number, number>;
  trends: Record<number, 'up' | 'down' | 'stable' | 'need_more'>;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  grade: string;
  overallTrend: string;
  recordCount: number;
  typesWithRecords: number;
}

export interface StudentDetail {
  id: number;
  name: string;
  gender: 'M' | 'F';
  school: string;
  grade: string;
  phone: string;
  status: string;
}

export interface RecordHistory {
  measured_at: string;
  records: {
    record_type_id: number;
    record_type_name: string;
    unit: string;
    value: number;
  }[];
}

export interface ScoreTable {
  id: number;
  record_type_id: number;
  male_perfect: number;
  female_perfect: number;
  max_score: number;
}

interface ChartDataPoint {
  date: string;
  value: number;
}

interface RadarDataPoint {
  subject: string;
  student: number;
  academy: number;
}

interface CompareBarDataPoint {
  name: string;
  student: number;
  academy: number;
  studentRaw: number;
  academyRaw: number;
  unit: string;
}

interface UseStudentProfileReturn {
  student: StudentDetail | null;
  stats: StudentStats | null;
  recordTypes: RecordType[];
  recordHistory: RecordHistory[];
  academyAverages: Record<number, number>;
  academyScoreAverages: Record<number, number>;
  scoreTables: Record<number, ScoreTable>;
  loading: boolean;
  selectedGaugeTypes: number[];
  selectedTrendType: number | null;
  selectedRadarTypes: number[];
  showAllRecords: boolean;
  toggleGaugeType: (typeId: number, maxCount?: number) => void;
  setSelectedTrendType: (typeId: number | null) => void;
  setSelectedRadarTypes: (typeIds: number[]) => void;
  setShowAllRecords: (show: boolean) => void;
  loadData: () => Promise<void>;
  trendChartData: ChartDataPoint[];
  trendYDomain: [number, number];
  isTrendTypeLower: boolean;
  radarChartData: RadarDataPoint[];
  compareBarData: CompareBarDataPoint[];
  selectedStats: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade: string;
    recordedCount: number;
    selectedCount: number;
  };
  getRecordPercentage: (typeId: number, value: number, hasRecord: boolean) => number;
  getScoreColor: (percentage: number) => string;
  getGradeColor: (grade: string) => string;
}

export function useStudentProfile(studentId: string, initialGaugeCount: number = 6): UseStudentProfileReturn {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [recordHistory, setRecordHistory] = useState<RecordHistory[]>([]);
  const [academyAverages, setAcademyAverages] = useState<Record<number, number>>({});
  const [academyScoreAverages, setAcademyScoreAverages] = useState<Record<number, number>>({});
  const [scoreTables, setScoreTables] = useState<Record<number, ScoreTable>>({});
  const [loading, setLoading] = useState(true);

  const [selectedGaugeTypes, setSelectedGaugeTypes] = useState<number[]>([]);
  const [selectedTrendType, setSelectedTrendType] = useState<number | null>(null);
  const [selectedRadarTypes, setSelectedRadarTypes] = useState<number[]>([]);
  const [showAllRecords, setShowAllRecords] = useState(false);

  // 게이지 종목 토글
  const toggleGaugeType = (typeId: number, maxCount: number = 6) => {
    if (selectedGaugeTypes.includes(typeId)) {
      setSelectedGaugeTypes(selectedGaugeTypes.filter(id => id !== typeId));
    } else if (selectedGaugeTypes.length < maxCount) {
      setSelectedGaugeTypes([...selectedGaugeTypes, typeId]);
    }
  };

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, historyRes, typesRes, academyRes, scoreTablesRes] = await Promise.all([
        apiClient.get(`/students/${studentId}/stats`),
        apiClient.get(`/students/${studentId}/records`),
        apiClient.get('/record-types?active=true'),
        apiClient.get('/stats/academy-average'),
        apiClient.get('/score-tables')
      ]);

      setStudent(statsRes.data.student);
      setStats(statsRes.data.stats);
      setRecordHistory(historyRes.data.records || []);
      setRecordTypes(typesRes.data.recordTypes || []);

      // 성별에 맞는 학원 평균 선택
      const gender = statsRes.data.student?.gender;
      if (gender === 'M') {
        setAcademyAverages(academyRes.data.maleAverages || {});
        setAcademyScoreAverages(academyRes.data.maleScoreAverages || {});
      } else {
        setAcademyAverages(academyRes.data.femaleAverages || {});
        setAcademyScoreAverages(academyRes.data.femaleScoreAverages || {});
      }

      // 배점표 매핑
      const tables: Record<number, ScoreTable> = {};
      (scoreTablesRes.data.scoreTables || []).forEach((st: ScoreTable) => {
        tables[st.record_type_id] = st;
      });
      setScoreTables(tables);

      // 초기 선택 설정
      const types = typesRes.data.recordTypes || [];
      const typesWithRecords = types.filter((t: RecordType) =>
        statsRes.data.stats?.latests?.[t.id] !== undefined
      );

      setSelectedGaugeTypes(typesWithRecords.slice(0, initialGaugeCount).map((t: RecordType) => t.id));
      setSelectedTrendType(typesWithRecords[0]?.id || null);
      setSelectedRadarTypes(typesWithRecords.slice(0, 5).map((t: RecordType) => t.id));
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

  // 트렌드 차트 데이터
  const trendChartData = useMemo(() => {
    if (!selectedTrendType || !recordHistory.length) return [];

    return recordHistory
      .filter(h => h.records.some(r => r.record_type_id === selectedTrendType))
      .map(h => {
        const record = h.records.find(r => r.record_type_id === selectedTrendType);
        return {
          date: new Date(h.measured_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
          value: record?.value || 0
        };
      })
      .reverse();
  }, [selectedTrendType, recordHistory]);

  // 트렌드 Y축 도메인
  const trendYDomain = useMemo((): [number, number] => {
    if (!trendChartData.length) return [0, 100];
    const values = trendChartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.2 || max * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [trendChartData]);

  // 트렌드 종목이 lower인지
  const isTrendTypeLower = useMemo(() => {
    const type = recordTypes.find(t => t.id === selectedTrendType);
    return type?.direction === 'lower';
  }, [selectedTrendType, recordTypes]);

  // 레이더 차트 데이터
  const radarChartData = useMemo(() => {
    if (!stats || !selectedRadarTypes.length) return [];

    return selectedRadarTypes.map(typeId => {
      const type = recordTypes.find(t => t.id === typeId);
      const studentScore = stats.scores[typeId] || 0;
      const academyScore = academyScoreAverages[typeId] || 0;

      return {
        subject: type?.short_name || type?.name || `종목${typeId}`,
        student: studentScore,
        academy: academyScore
      };
    });
  }, [stats, selectedRadarTypes, recordTypes, academyScoreAverages]);

  // 비교 막대 차트 데이터
  const compareBarData = useMemo(() => {
    if (!stats || !recordTypes.length || !student || !selectedGaugeTypes.length) return [];

    return selectedGaugeTypes
      .map(typeId => recordTypes.find(t => t.id === typeId))
      .filter((type): type is RecordType => type !== undefined)
      .map(type => {
        const scoreTable = scoreTables[type.id];
        const perfectValue = scoreTable
          ? (student.gender === 'M' ? scoreTable.male_perfect : scoreTable.female_perfect)
          : 0;

        const studentValue = stats.latests[type.id]?.value || 0;
        const academyValue = academyAverages[type.id] || 0;

        let studentPercent = 0;
        let academyPercent = 0;

        if (perfectValue > 0) {
          if (type.direction === 'lower') {
            studentPercent = Math.max(0, Math.min(100, (2 - studentValue / perfectValue) * 100));
            academyPercent = Math.max(0, Math.min(100, (2 - academyValue / perfectValue) * 100));
          } else {
            studentPercent = Math.min(100, (studentValue / perfectValue) * 100);
            academyPercent = Math.min(100, (academyValue / perfectValue) * 100);
          }
        }

        return {
          name: type.short_name || type.name,
          student: Math.round(studentPercent),
          academy: Math.round(academyPercent),
          studentRaw: studentValue,
          academyRaw: Math.round(academyValue * 100) / 100,
          unit: type.unit
        };
      });
  }, [stats, recordTypes, academyAverages, scoreTables, student, selectedGaugeTypes]);

  // 선택된 종목 기준 종합평가
  const selectedStats = useMemo(() => {
    if (!stats || !selectedGaugeTypes.length) {
      return { totalScore: 0, maxScore: 0, percentage: 0, grade: 'F', recordedCount: 0, selectedCount: 0 };
    }

    let totalScore = 0;
    let maxScore = 0;
    let recordedCount = 0;

    selectedGaugeTypes.forEach(typeId => {
      const scoreTable = scoreTables[typeId];
      const hasRecord = stats.latests[typeId] !== undefined;

      if (hasRecord) {
        recordedCount++;
        if (scoreTable) {
          maxScore += scoreTable.max_score || 100;
          if (stats.scores[typeId] !== undefined) {
            totalScore += stats.scores[typeId];
          }
        }
      }
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    let grade = 'F';
    if (recordedCount === 0) grade = '-';
    else if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    return { totalScore, maxScore, percentage, grade, recordedCount, selectedCount: selectedGaugeTypes.length };
  }, [stats, selectedGaugeTypes, scoreTables]);

  // 기록 달성률 계산
  const getRecordPercentage = (typeId: number, value: number, hasRecord: boolean): number => {
    if (!hasRecord) return 0;

    const type = recordTypes.find(t => t.id === typeId);
    const scoreTable = scoreTables[typeId];
    if (!type || !scoreTable || !student) return 0;

    const perfectValue = student.gender === 'M' ? scoreTable.male_perfect : scoreTable.female_perfect;
    if (!perfectValue) return 0;

    if (type.direction === 'lower') {
      return Math.max(0, Math.min(100, (2 - value / perfectValue) * 100));
    } else {
      return Math.min(100, (value / perfectValue) * 100);
    }
  };

  // 달성률 기준 색상
  const getScoreColor = (percentage: number): string => {
    if (percentage >= 90) return '#22c55e'; // green
    if (percentage >= 70) return '#3b82f6'; // blue
    if (percentage >= 50) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  // 등급 색상
  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'B': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
      case 'C': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'D': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20';
      default: return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
    }
  };

  return {
    student,
    stats,
    recordTypes,
    recordHistory,
    academyAverages,
    academyScoreAverages,
    scoreTables,
    loading,
    selectedGaugeTypes,
    selectedTrendType,
    selectedRadarTypes,
    showAllRecords,
    toggleGaugeType,
    setSelectedTrendType,
    setSelectedRadarTypes,
    setShowAllRecords,
    loadData,
    trendChartData,
    trendYDomain,
    isTrendTypeLower,
    radarChartData,
    compareBarData,
    selectedStats,
    getRecordPercentage,
    getScoreColor,
    getGradeColor,
  };
}
