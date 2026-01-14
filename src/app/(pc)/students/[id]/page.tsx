'use client';

import { useState, useEffect, useMemo, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  ChevronDown,
  Printer,
  Edit,
  FileDown
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import apiClient from '@/lib/api/client';

interface RecordType {
  id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
}

interface StudentStats {
  averages: Record<number, number>;
  bests: Record<number, { value: number; date: string }>;
  latests: Record<number, { value: number; date: string }>;
  scores: Record<number, number>;
  trends: Record<number, 'up' | 'down' | 'stable'>;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  grade: string;
  overallTrend: string;
  recordCount: number;
  typesWithRecords: number;
}

interface Student {
  id: number;
  name: string;
  gender: 'M' | 'F';
  school: string;
  grade: string;
  phone: string;
  status: string;
}

interface RecordHistory {
  measured_at: string;
  records: {
    record_type_id: number;
    record_type_name: string;
    unit: string;
    value: number;
  }[];
}

interface ScoreTable {
  id: number;
  record_type_id: number;
  male_perfect: number;
  female_perfect: number;
  max_score: number;
}

export default function StudentProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [recordHistory, setRecordHistory] = useState<RecordHistory[]>([]);
  const [academyAverages, setAcademyAverages] = useState<Record<number, number>>({});
  const [academyScoreAverages, setAcademyScoreAverages] = useState<Record<number, number>>({});
  const [scoreTables, setScoreTables] = useState<Record<number, ScoreTable>>({});
  const [loading, setLoading] = useState(true);

  // 선택된 종목들 (원형 게이지용 4개)
  const [selectedGaugeTypes, setSelectedGaugeTypes] = useState<number[]>([]);
  // 선 그래프용 선택된 종목
  const [selectedTrendType, setSelectedTrendType] = useState<number | null>(null);
  // 레이더 차트용 선택된 종목들 (5개)
  const [selectedRadarTypes, setSelectedRadarTypes] = useState<number[]>([]);

  // 최근 기록 더보기 상태
  const [showAllRecords, setShowAllRecords] = useState(false);
  // PDF 다운로드 로딩 상태
  const [pdfLoading, setPdfLoading] = useState(false);

  // 게이지 종목 토글
  const toggleGaugeType = (typeId: number) => {
    if (selectedGaugeTypes.includes(typeId)) {
      setSelectedGaugeTypes(selectedGaugeTypes.filter(id => id !== typeId));
    } else if (selectedGaugeTypes.length < 6) {
      setSelectedGaugeTypes([...selectedGaugeTypes, typeId]);
    }
  };

  // PDF 다운로드 핸들러 (현재 화면 캡처)
  const handleDownloadPDF = async () => {
    if (!contentRef.current || !student) return;

    try {
      setPdfLoading(true);

      // 현재 화면을 캔버스로 캡처
      const canvas = await html2canvas(contentRef.current, {
        scale: 2, // 고해상도
        useCORS: true,
        logging: false,
        backgroundColor: '#f1f5f9' // slate-100 배경색
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4 사이즈 (210 x 297mm)
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // 이미지를 PDF 크기에 맞게 조정
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      // 중앙 정렬
      const x = (pdfWidth - scaledWidth) / 2;
      const y = (pdfHeight - scaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
      pdf.save(`${student.name}_성적표_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
      console.error('PDF download error:', error);
      alert('PDF 다운로드에 실패했습니다.');
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

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
      // 성별에 맞는 학원 평균 선택 (원시값 + 점수)
      const gender = statsRes.data.student?.gender;
      if (gender === 'M') {
        setAcademyAverages(academyRes.data.maleAverages || {});
        setAcademyScoreAverages(academyRes.data.maleScoreAverages || {});
      } else {
        setAcademyAverages(academyRes.data.femaleAverages || {});
        setAcademyScoreAverages(academyRes.data.femaleScoreAverages || {});
      }

      // 배점표 데이터를 종목ID별로 매핑
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

      // 첫 6개 종목 선택 (게이지용)
      setSelectedGaugeTypes(typesWithRecords.slice(0, 6).map((t: RecordType) => t.id));
      // 첫 번째 종목 선택 (트렌드용)
      setSelectedTrendType(typesWithRecords[0]?.id || null);
      // 첫 5개 종목 선택 (레이더용)
      setSelectedRadarTypes(typesWithRecords.slice(0, 5).map((t: RecordType) => t.id));
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 트렌드 차트 데이터 생성
  const trendChartData = useMemo(() => {
    if (!selectedTrendType || !recordHistory.length) return [];

    const data = recordHistory
      .filter(h => h.records.some(r => r.record_type_id === selectedTrendType))
      .map(h => {
        const record = h.records.find(r => r.record_type_id === selectedTrendType);
        return {
          date: new Date(h.measured_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
          value: record?.value || 0
        };
      })
      .reverse();

    return data;
  }, [selectedTrendType, recordHistory]);

  // 선 그래프 Y축 도메인 계산 (자동 범위 + 패딩)
  const trendYDomain = useMemo(() => {
    if (!trendChartData.length) return [0, 100];
    const values = trendChartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.2 || max * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [trendChartData]);

  // 현재 선택된 트렌드 종목이 lower인지
  const isTrendTypeLower = useMemo(() => {
    const type = recordTypes.find(t => t.id === selectedTrendType);
    return type?.direction === 'lower';
  }, [selectedTrendType, recordTypes]);

  // 레이더 차트 데이터 생성 (점수 기반)
  const radarChartData = useMemo(() => {
    if (!stats || !selectedRadarTypes.length) return [];

    return selectedRadarTypes.map(typeId => {
      const type = recordTypes.find(t => t.id === typeId);
      // 학생 점수 (0-100)
      const studentScore = stats.scores[typeId] || 0;
      // 학원 평균 점수 (0-100)
      const academyScore = academyScoreAverages[typeId] || 0;

      return {
        subject: type?.short_name || type?.name || `종목${typeId}`,
        student: studentScore,
        academy: academyScore
      };
    });
  }, [stats, selectedRadarTypes, recordTypes, academyScoreAverages]);

  // 비교 막대 차트 데이터 (선택된 게이지 종목 기준)
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

        // 만점 대비 달성률로 정규화 (direction 고려)
        let studentPercent = 0;
        let academyPercent = 0;

        if (perfectValue > 0) {
          if (type.direction === 'lower') {
            // 낮을수록 좋은 종목 (예: 달리기 시간)
            studentPercent = Math.max(0, Math.min(100, (2 - studentValue / perfectValue) * 100));
            academyPercent = Math.max(0, Math.min(100, (2 - academyValue / perfectValue) * 100));
          } else {
            // 높을수록 좋은 종목 (예: 멀리뛰기)
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

  // 선택된 종목 기준 종합평가 계산 (기록이 있는 종목만 평가에 포함)
  const selectedStats = useMemo(() => {
    if (!stats || !selectedGaugeTypes.length) {
      return { totalScore: 0, maxScore: 0, percentage: 0, grade: 'F', recordedCount: 0, selectedCount: 0 };
    }

    let totalScore = 0;
    let maxScore = 0;
    let recordedCount = 0;

    selectedGaugeTypes.forEach(typeId => {
      const scoreTable = scoreTables[typeId];
      // 기록이 있는지 확인 (latests 기준)
      const hasRecord = stats.latests[typeId] !== undefined;

      // 기록이 있는 경우에만 점수 계산에 포함
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

    // 등급 계산
    let grade = 'F';
    if (recordedCount === 0) {
      grade = '-'; // 기록이 없으면 등급 없음
    } else if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    return { totalScore, maxScore, percentage, grade, recordedCount, selectedCount: selectedGaugeTypes.length };
  }, [stats, selectedGaugeTypes, scoreTables]);

  // 기록 달성률 계산 (만점 대비)
  const getRecordPercentage = (typeId: number, value: number, hasRecord: boolean): number => {
    // 기록이 없으면 0%
    if (!hasRecord) return 0;

    const type = recordTypes.find(t => t.id === typeId);
    const scoreTable = scoreTables[typeId];
    if (!type || !scoreTable || !student) return 0;

    const perfectValue = student.gender === 'M' ? scoreTable.male_perfect : scoreTable.female_perfect;
    if (!perfectValue) return 0;

    // direction이 lower면 낮을수록 좋음 (예: 달리기 시간)
    if (type.direction === 'lower') {
      // 만점보다 기록이 좋으면(낮으면) 100%, 만점의 2배면 0%
      const percentage = Math.max(0, Math.min(100, (2 - value / perfectValue) * 100));
      return percentage;
    } else {
      // higher: 높을수록 좋음 (예: 멀리뛰기)
      const percentage = Math.min(100, (value / perfectValue) * 100);
      return percentage;
    }
  };

  // 달성률 기준 색상 결정
  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return '#22c55e'; // green
    if (percentage >= 70) return '#3b82f6'; // blue
    if (percentage >= 50) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  // 등급 색상
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      default: return 'text-red-600 bg-red-100';
    }
  };

  // 트렌드 아이콘
  const TrendIcon = ({ trend, showLabel = false }: { trend: string; showLabel?: boolean }) => {
    if (trend === 'up') return <TrendingUp className="text-green-500" size={16} />;
    if (trend === 'down') return <TrendingDown className="text-red-500" size={16} />;
    if (trend === 'need_more') {
      return showLabel
        ? <span className="text-[9px] text-gray-400">기록 부족</span>
        : <span className="text-[10px] text-gray-400">···</span>;
    }
    return <Minus className="text-gray-400" size={16} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!student || !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">학생 정보를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="mt-4 text-orange-500 hover:underline">
          돌아가기
        </button>
      </div>
    );
  }

  const visibleRecords = showAllRecords ? recordHistory : recordHistory.slice(0, 6);

  return (
    <div ref={contentRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <ArrowLeft size={24} className="text-slate-900 dark:text-slate-100" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
              <User size={24} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{student.name}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {student.gender === 'M' ? '남' : '여'} · {student.school} · {student.grade}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Edit size={18} />
            수정
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FileDown size={18} />
            {pdfLoading ? 'PDF 생성중...' : 'PDF 다운로드'}
          </button>
          <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Printer size={18} />
            인쇄
          </button>
        </div>
      </div>

      {/* 3 Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Record Gauges */}
        <div className="col-span-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 h-[500px] overflow-hidden flex flex-col">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">종목별 기록</h3>

            <div className="grid grid-cols-2 gap-2 flex-1">
              {selectedGaugeTypes.slice(0, 6).map((typeId) => {
                const type = recordTypes.find(t => t.id === typeId);
                const latestRecord = stats.latests[typeId];
                const hasRecord = latestRecord !== undefined && latestRecord !== null;
                const value = latestRecord?.value || 0;
                const percentage = getRecordPercentage(typeId, value, hasRecord);
                const trend = stats.trends[typeId];
                const scoreTable = scoreTables[typeId];
                const perfectValue = student && scoreTable
                  ? (student.gender === 'M' ? scoreTable.male_perfect : scoreTable.female_perfect)
                  : null;

                const gaugeData = [
                  { value: percentage, color: getScoreColor(percentage) },
                  { value: 100 - percentage, color: '#e5e7eb' }
                ];

                return (
                  <div key={typeId} className="relative h-[105px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gaugeData}
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="80%"
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          stroke="none"
                        >
                          {gaugeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {hasRecord ? value : '-'}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">{type?.unit}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{type?.short_name || type?.name}</span>
                      {perfectValue && (
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">만점: {perfectValue}</span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                      <TrendIcon trend={trend || 'need_more'} showLabel={true} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 종목 선택 버튼들 */}
            <div className="mt-2 flex flex-wrap gap-1">
              {recordTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => toggleGaugeType(type.id)}
                  className={`text-xs px-2 py-0.5 rounded transition ${
                    selectedGaugeTypes.includes(type.id)
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  } ${selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id)}
                >
                  {type.short_name || type.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">최대 6개 선택</p>
          </div>
        </div>

        {/* Middle Column - Trend Chart & Overall Grade */}
        <div className="col-span-5 space-y-4">
          {/* Trend Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 h-[300px] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">기록 추이</h3>
              <select
                className="text-sm border border-slate-200 dark:border-slate-700 rounded px-3 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={selectedTrendType || ''}
                onChange={(e) => setSelectedTrendType(parseInt(e.target.value))}
              >
                {recordTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={trendYDomain as [number, number]}
                  reversed={isTrendTypeLower}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                />
                <Tooltip
                  formatter={(value) => {
                    const type = recordTypes.find(t => t.id === selectedTrendType);
                    return [`${value}${type?.unit || ''}`, '기록'];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316' }}
                />
              </LineChart>
            </ResponsiveContainer>
            {isTrendTypeLower && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">* 낮을수록 좋은 종목 (Y축 반전)</p>
            )}
          </div>

          {/* Overall Grade */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 h-[184px] overflow-hidden">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">종합평가 <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">(선택 종목 기준)</span></h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getGradeColor(selectedStats.grade)}`}>
                  <span className="text-3xl font-bold">{selectedStats.grade}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedStats.totalScore}<span className="text-base font-normal">점</span></span>
                    <span className="text-slate-400 dark:text-slate-500">/ {selectedStats.maxScore}점</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ({selectedStats.percentage}% 달성)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendIcon trend={stats.overallTrend} />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {stats.overallTrend === 'up' ? '상승세' : stats.overallTrend === 'down' ? '하락세' : '유지'}
                </span>
              </div>
            </div>

            {/* 종목 수 */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">평가 대상</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {selectedStats.recordedCount}개
                <span className="text-slate-400 dark:text-slate-500"> / {selectedStats.selectedCount}개 선택</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column - Comparison */}
        <div className="col-span-4 space-y-4">
          {/* Bar Chart Comparison */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 h-[240px] overflow-hidden">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">학원평균 vs {student.name}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">만점 대비 달성률 (%)</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={compareBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={70}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    const data = props.payload;
                    if (name === '학원평균') return [`${data.academyRaw}${data.unit} (${value}%)`, name];
                    return [`${data.studentRaw}${data.unit} (${value}%)`, name];
                  }}
                />
                <Bar dataKey="academy" fill="#94a3b8" name="학원평균" />
                <Bar dataKey="student" fill="#f97316" name={student.name} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 h-[300px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">능력치 비교</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-400 rounded-sm"></span>학원평균</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded-sm"></span>{student.name}</span>
              </div>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar
                    name="학원평균"
                    dataKey="academy"
                    stroke="#94a3b8"
                    fill="#94a3b8"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name={student.name}
                    dataKey="student"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 레이더 종목 선택 */}
            <div className="flex flex-wrap gap-1">
              {recordTypes.slice(0, 8).map(type => (
                <button
                  key={type.id}
                  className={`text-xs px-2 py-0.5 rounded ${
                    selectedRadarTypes.includes(type.id)
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                  onClick={() => {
                    if (selectedRadarTypes.includes(type.id)) {
                      setSelectedRadarTypes(selectedRadarTypes.filter(id => id !== type.id));
                    } else if (selectedRadarTypes.length < 5) {
                      setSelectedRadarTypes([...selectedRadarTypes, type.id]);
                    }
                  }}
                >
                  {type.short_name || type.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Records Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">최근 기록</h3>
          {recordHistory.length > 6 && (
            <button
              onClick={() => setShowAllRecords(!showAllRecords)}
              className="text-sm text-orange-500 hover:text-orange-600 flex items-center gap-1"
            >
              {showAllRecords ? '접기' : `더보기 (${recordHistory.length}개)`}
              <ChevronDown size={16} className={`transition-transform ${showAllRecords ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        <div className={`overflow-x-auto ${showAllRecords ? 'max-h-60 overflow-y-auto' : ''}`}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-800">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-200">날짜</th>
                {recordTypes.slice(0, 6).map(type => (
                  <th key={type.id} className="text-center py-2 px-3 text-slate-700 dark:text-slate-200">
                    {type.short_name || type.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((history, idx) => (
                <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                    {new Date(history.measured_at).toLocaleDateString('ko-KR')}
                  </td>
                  {recordTypes.slice(0, 6).map(type => {
                    const record = history.records.find(r => r.record_type_id === type.id);
                    return (
                      <td key={type.id} className="text-center py-2 px-3">
                        {record ? (
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {record.value}
                            <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">{type.unit}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
