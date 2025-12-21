'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Edit
} from 'lucide-react';
import {
  RadialBarChart,
  RadialBar,
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

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [recordHistory, setRecordHistory] = useState<RecordHistory[]>([]);
  const [academyAverages, setAcademyAverages] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  // 선택된 종목들 (원형 게이지용 4개)
  const [selectedGaugeTypes, setSelectedGaugeTypes] = useState<number[]>([]);
  // 선 그래프용 선택된 종목
  const [selectedTrendType, setSelectedTrendType] = useState<number | null>(null);
  // 레이더 차트용 선택된 종목들 (5개)
  const [selectedRadarTypes, setSelectedRadarTypes] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, historyRes, typesRes, academyRes] = await Promise.all([
        apiClient.get(`/students/${studentId}/stats`),
        apiClient.get(`/students/${studentId}/records`),
        apiClient.get('/record-types?active=true'),
        apiClient.get('/stats/academy-average')
      ]);

      setStudent(statsRes.data.student);
      setStats(statsRes.data.stats);
      setRecordHistory(historyRes.data.records || []);
      setRecordTypes(typesRes.data.recordTypes || []);
      setAcademyAverages(academyRes.data.averages || {});

      // 초기 선택 설정
      const types = typesRes.data.recordTypes || [];
      const typesWithScores = types.filter((t: RecordType) =>
        statsRes.data.stats?.scores?.[t.id] !== undefined
      );

      // 첫 4개 종목 선택 (게이지용)
      setSelectedGaugeTypes(typesWithScores.slice(0, 4).map((t: RecordType) => t.id));
      // 첫 번째 종목 선택 (트렌드용)
      setSelectedTrendType(typesWithScores[0]?.id || null);
      // 첫 5개 종목 선택 (레이더용)
      setSelectedRadarTypes(typesWithScores.slice(0, 5).map((t: RecordType) => t.id));
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 트렌드 차트 데이터 생성
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

  // 레이더 차트 데이터 생성
  const radarChartData = useMemo(() => {
    if (!stats || !selectedRadarTypes.length) return [];

    return selectedRadarTypes.map(typeId => {
      const type = recordTypes.find(t => t.id === typeId);
      const studentValue = stats.latests[typeId]?.value || 0;
      const academyAvg = academyAverages[typeId] || 0;

      // 상대값 계산 (학원평균 대비 %)
      const relativeValue = academyAvg > 0
        ? Math.min((studentValue / academyAvg) * 50, 100) // 학원평균 = 50 기준
        : 50;

      return {
        subject: type?.short_name || type?.name || `종목${typeId}`,
        student: relativeValue,
        academy: 50 // 기준선
      };
    });
  }, [stats, selectedRadarTypes, recordTypes, academyAverages]);

  // 비교 막대 차트 데이터
  const compareBarData = useMemo(() => {
    if (!stats || !recordTypes.length) return [];

    return recordTypes
      .filter(t => stats.latests[t.id] !== undefined)
      .slice(0, 5)
      .map(type => ({
        name: type.short_name || type.name,
        student: stats.latests[type.id]?.value || 0,
        academy: academyAverages[type.id] || 0,
        unit: type.unit
      }));
  }, [stats, recordTypes, academyAverages]);

  // 점수 색상 결정
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#22c55e'; // green
    if (score >= 70) return '#3b82f6'; // blue
    if (score >= 50) return '#eab308'; // yellow
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
  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="text-green-500" size={16} />;
    if (trend === 'down') return <TrendingDown className="text-red-500" size={16} />;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <User size={24} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{student.name}</h1>
              <p className="text-gray-500 text-sm">
                {student.gender === 'M' ? '남' : '여'} · {student.school} · {student.grade}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Edit size={18} />
            수정
          </button>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Printer size={18} />
            인쇄
          </button>
        </div>
      </div>

      {/* 3 Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Score Gauges */}
        <div className="col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">종목별 점수</h3>
              <select
                className="text-xs border rounded px-2 py-1"
                onChange={(e) => {
                  const newTypes = [...selectedGaugeTypes];
                  newTypes[0] = parseInt(e.target.value);
                  setSelectedGaugeTypes(newTypes);
                }}
                value={selectedGaugeTypes[0] || ''}
              >
                {recordTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {selectedGaugeTypes.slice(0, 4).map((typeId, idx) => {
                const type = recordTypes.find(t => t.id === typeId);
                const score = stats.scores[typeId] || 0;
                const trend = stats.trends[typeId];

                return (
                  <div key={typeId} className="relative">
                    <ResponsiveContainer width="100%" height={100}>
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="60%"
                        outerRadius="80%"
                        data={[{ value: score, fill: getScoreColor(score) }]}
                        startAngle={180}
                        endAngle={0}
                      >
                        <RadialBar
                          dataKey="value"
                          cornerRadius={10}
                          background={{ fill: '#e5e7eb' }}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold">{score}</span>
                      <span className="text-[10px] text-gray-500">{type?.short_name || type?.name}</span>
                    </div>
                    <div className="flex justify-center mt-1">
                      <TrendIcon trend={trend || 'stable'} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 종목 변경 드롭다운들 */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map(idx => (
                <select
                  key={idx}
                  className="text-xs border rounded px-2 py-1 w-full"
                  value={selectedGaugeTypes[idx] || ''}
                  onChange={(e) => {
                    const newTypes = [...selectedGaugeTypes];
                    newTypes[idx] = parseInt(e.target.value);
                    setSelectedGaugeTypes(newTypes);
                  }}
                >
                  {recordTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.short_name || t.name}</option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column - Trend Chart & Overall Grade */}
        <div className="col-span-5 space-y-4">
          {/* Trend Chart */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">기록 추이</h3>
              <select
                className="text-sm border rounded px-3 py-1"
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
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Overall Grade */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-4">종합평가</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getGradeColor(stats.grade)}`}>
                  <span className="text-3xl font-bold">{stats.grade}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{stats.totalScore}</span>
                    <span className="text-gray-400">/ {stats.maxPossibleScore}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    상위 {100 - stats.percentage}% (달성률 {stats.percentage}%)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendIcon trend={stats.overallTrend} />
                <span className="text-sm text-gray-500">
                  {stats.overallTrend === 'up' ? '상승세' : stats.overallTrend === 'down' ? '하락세' : '유지'}
                </span>
              </div>
            </div>

            {/* 종목 수 */}
            <div className="mt-4 pt-4 border-t flex justify-between text-sm">
              <span className="text-gray-500">기록된 종목</span>
              <span className="font-medium">{stats.typesWithRecords}개 / {recordTypes.length}개</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">총 기록 수</span>
              <span className="font-medium">{stats.recordCount}회</span>
            </div>
          </div>
        </div>

        {/* Right Column - Comparison */}
        <div className="col-span-4 space-y-4">
          {/* Bar Chart Comparison */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-4">학원평균 vs 나</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={compareBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="academy" fill="#94a3b8" name="학원평균" />
                <Bar dataKey="student" fill="#f97316" name="나" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-4">능력치 비교</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarChartData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar
                  name="학원평균"
                  dataKey="academy"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.3}
                />
                <Radar
                  name="나"
                  dataKey="student"
                  stroke="#f97316"
                  fill="#f97316"
                  fillOpacity={0.5}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>

            {/* 레이더 종목 선택 */}
            <div className="mt-2 flex flex-wrap gap-1">
              {recordTypes.slice(0, 8).map(type => (
                <button
                  key={type.id}
                  className={`text-xs px-2 py-1 rounded ${
                    selectedRadarTypes.includes(type.id)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
            <p className="text-xs text-gray-400 mt-1">최대 5개 선택 가능</p>
          </div>
        </div>
      </div>

      {/* Recent Records Table */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-gray-800 mb-4">최근 기록</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">날짜</th>
                {recordTypes.slice(0, 6).map(type => (
                  <th key={type.id} className="text-center py-2 px-3">
                    {type.short_name || type.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recordHistory.slice(0, 5).map((history, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">
                    {new Date(history.measured_at).toLocaleDateString('ko-KR')}
                  </td>
                  {recordTypes.slice(0, 6).map(type => {
                    const record = history.records.find(r => r.record_type_id === type.id);
                    return (
                      <td key={type.id} className="text-center py-2 px-3">
                        {record ? (
                          <span className="font-medium">
                            {record.value}
                            <span className="text-gray-400 text-xs ml-1">{type.unit}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
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
