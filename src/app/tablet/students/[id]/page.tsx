'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronDown
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
import apiClient from '@/lib/api/client';
import { useOrientation } from '../../layout';

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

export default function TabletStudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const orientation = useOrientation();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [recordHistory, setRecordHistory] = useState<RecordHistory[]>([]);
  const [academyAverages, setAcademyAverages] = useState<Record<number, number>>({});
  const [scoreTables, setScoreTables] = useState<Record<number, ScoreTable>>({});
  const [loading, setLoading] = useState(true);

  const [selectedGaugeTypes, setSelectedGaugeTypes] = useState<number[]>([]);
  const [selectedTrendType, setSelectedTrendType] = useState<number | null>(null);
  const [selectedRadarTypes, setSelectedRadarTypes] = useState<number[]>([]);

  // 더보기 상태
  const [showAllRecords, setShowAllRecords] = useState(false);

  const toggleGaugeType = (typeId: number) => {
    if (selectedGaugeTypes.includes(typeId)) {
      setSelectedGaugeTypes(selectedGaugeTypes.filter(id => id !== typeId));
    } else if (selectedGaugeTypes.length < 6) {
      setSelectedGaugeTypes([...selectedGaugeTypes, typeId]);
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

      const gender = statsRes.data.student?.gender;
      if (gender === 'M') {
        setAcademyAverages(academyRes.data.maleAverages || {});
      } else {
        setAcademyAverages(academyRes.data.femaleAverages || {});
      }

      const tables: Record<number, ScoreTable> = {};
      (scoreTablesRes.data.scoreTables || []).forEach((st: ScoreTable) => {
        tables[st.record_type_id] = st;
      });
      setScoreTables(tables);

      const types = typesRes.data.recordTypes || [];
      const typesWithRecords = types.filter((t: RecordType) =>
        statsRes.data.stats?.latests?.[t.id] !== undefined
      );

      setSelectedGaugeTypes(typesWithRecords.slice(0, 4).map((t: RecordType) => t.id));
      setSelectedTrendType(typesWithRecords[0]?.id || null);
      setSelectedRadarTypes(typesWithRecords.slice(0, 5).map((t: RecordType) => t.id));
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const trendYDomain = useMemo(() => {
    if (!trendChartData.length) return [0, 100];
    const values = trendChartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.2 || max * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [trendChartData]);

  const isTrendTypeLower = useMemo(() => {
    const type = recordTypes.find(t => t.id === selectedTrendType);
    return type?.direction === 'lower';
  }, [selectedTrendType, recordTypes]);

  const radarChartData = useMemo(() => {
    if (!stats || !selectedRadarTypes.length) return [];

    return selectedRadarTypes.map(typeId => {
      const type = recordTypes.find(t => t.id === typeId);
      const studentValue = stats.latests[typeId]?.value || 0;
      const academyAvg = academyAverages[typeId] || 0;

      const relativeValue = academyAvg > 0
        ? Math.min((studentValue / academyAvg) * 50, 100)
        : 50;

      return {
        subject: type?.short_name || type?.name || `종목${typeId}`,
        student: relativeValue,
        academy: 50
      };
    });
  }, [stats, selectedRadarTypes, recordTypes, academyAverages]);

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

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return '#22c55e';
    if (percentage >= 70) return '#3b82f6';
    if (percentage >= 50) return '#eab308';
    return '#ef4444';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      default: return 'text-red-600 bg-red-100';
    }
  };

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

  const visibleRecords = showAllRecords ? recordHistory : recordHistory.slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={40} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!student || !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">학생 정보를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="mt-4 text-orange-500 hover:underline">
          돌아가기
        </button>
      </div>
    );
  }

  // 가로 모드 (2000x1200 태블릿 기준)
  if (orientation === 'landscape') {
    return (
      <div className="flex flex-col h-[calc(100vh-100px)]">
        {/* Header - 컴팩트하게 */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
              }`}>
                <User size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold">{student.name}</h1>
                <p className="text-gray-500 text-sm">
                  {student.gender === 'M' ? '남' : '여'} · {student.school} · {student.grade}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Main Grid - 3 컬럼 (2000x1200 최적화) */}
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left: 게이지 + 종합평가 */}
          <div className="col-span-3 flex flex-col gap-3 min-h-0">
            {/* Record Gauges */}
            <div className="bg-white rounded-xl shadow-sm p-3 flex-[2] overflow-hidden flex flex-col min-h-0">
              <h3 className="text-base font-semibold text-gray-800 mb-2 flex-shrink-0">종목별 기록</h3>
              <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                {selectedGaugeTypes.slice(0, 4).map((typeId) => {
                  const type = recordTypes.find(t => t.id === typeId);
                  const latestRecord = stats.latests[typeId];
                  const hasRecord = latestRecord !== undefined && latestRecord !== null;
                  const value = latestRecord?.value || 0;
                  const percentage = getRecordPercentage(typeId, value, hasRecord);
                  const trend = stats.trends[typeId];

                  const gaugeData = [
                    { value: percentage, color: getScoreColor(percentage) },
                    { value: 100 - percentage, color: '#e5e7eb' }
                  ];

                  return (
                    <div key={typeId} className="relative flex flex-col items-center justify-center">
                      <div className="w-full aspect-square max-h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={gaugeData}
                              cx="50%"
                              cy="50%"
                              innerRadius="55%"
                              outerRadius="75%"
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
                          <span className="text-lg font-bold">
                            {hasRecord ? value : '-'}<span className="text-xs font-normal text-gray-400">{type?.unit}</span>
                          </span>
                          <span className="text-xs text-gray-500">{type?.short_name || type?.name}</span>
                          <TrendIcon trend={trend || 'need_more'} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-1 flex-shrink-0">
                {recordTypes.slice(0, 6).map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleGaugeType(type.id)}
                    className={`text-xs px-2 py-0.5 rounded ${
                      selectedGaugeTypes.includes(type.id)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    disabled={selectedGaugeTypes.length >= 4 && !selectedGaugeTypes.includes(type.id)}
                  >
                    {type.short_name || type.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Overall Grade */}
            <div className="bg-white rounded-xl shadow-sm p-3 flex-1 overflow-hidden flex flex-col min-h-0">
              <h3 className="text-base font-semibold text-gray-800 mb-2 flex-shrink-0">종합평가</h3>
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${getGradeColor(selectedStats.grade)}`}>
                  <span className="text-3xl font-bold">{selectedStats.grade}</span>
                </div>
                <div>
                  <div>
                    <span className="text-2xl font-bold">{selectedStats.totalScore}</span>
                    <span className="text-sm font-normal">점</span>
                    <span className="text-gray-400 text-sm"> / {selectedStats.maxScore}점</span>
                  </div>
                  <p className="text-sm text-gray-500">({selectedStats.percentage}% 달성)</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIcon trend={stats.overallTrend} />
                    <span className="text-xs text-gray-500">
                      {stats.overallTrend === 'up' ? '상승세' : stats.overallTrend === 'down' ? '하락세' : '유지'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle: 기록추이 + 최근기록 */}
          <div className="col-span-5 flex flex-col gap-3 min-h-0">
            {/* Trend Chart */}
            <div className="bg-white rounded-xl shadow-sm p-3 flex-[3] overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-800">기록 추이</h3>
                <select
                  className="text-sm border rounded-lg px-3 py-1.5"
                  value={selectedTrendType || ''}
                  onChange={(e) => setSelectedTrendType(parseInt(e.target.value))}
                >
                  {recordTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={trendYDomain as [number, number]}
                      reversed={isTrendTypeLower}
                      tickFormatter={(value) => Number(value).toFixed(1)}
                      width={50}
                    />
                    <Tooltip
                      formatter={(value) => {
                        const type = recordTypes.find(t => t.id === selectedTrendType);
                        return [`${value}${type?.unit || ''}`, '기록'];
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Records */}
            <div className="bg-white rounded-xl shadow-sm p-3 flex-[2] overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-800">최근 기록</h3>
                {recordHistory.length > 5 && (
                  <button
                    onClick={() => setShowAllRecords(!showAllRecords)}
                    className="text-xs text-orange-500 flex items-center gap-1"
                  >
                    {showAllRecords ? '접기' : '더보기'}
                    <ChevronDown size={14} className={showAllRecords ? 'rotate-180' : ''} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">날짜</th>
                      {recordTypes.slice(0, 5).map(type => (
                        <th key={type.id} className="text-center py-2 px-2">
                          {type.short_name || type.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllRecords ? recordHistory : recordHistory.slice(0, 5)).map((history, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2 px-2 font-medium">
                          {new Date(history.measured_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                        </td>
                        {recordTypes.slice(0, 5).map(type => {
                          const record = history.records.find(r => r.record_type_id === type.id);
                          return (
                            <td key={type.id} className="text-center py-2 px-2">
                              {record ? (
                                <span className="font-medium">{record.value}</span>
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

          {/* Right: 학원비교 + 레이더 */}
          <div className="col-span-4 flex flex-col gap-3 min-h-0">
            {/* Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm p-3 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-800">학원평균 vs {student.name}</h3>
                <p className="text-xs text-gray-400 mb-2">만점 대비 달성률 (%)</p>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareBarData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <YAxis dataKey="name" type="category" width={50} tick={{ fontSize: 11 }} />
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
            </div>

            {/* Radar Chart */}
            <div className="bg-white rounded-xl shadow-sm p-3 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-800">능력치 비교</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-400 rounded-sm"></span>학원</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-sm"></span>{student.name}</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="학원평균" dataKey="academy" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
                    <Radar name={student.name} dataKey="student" stroke="#f97316" fill="#f97316" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-1 flex-shrink-0">
                {recordTypes.slice(0, 6).map(type => (
                  <button
                    key={type.id}
                    className={`text-xs px-2 py-0.5 rounded ${
                      selectedRadarTypes.includes(type.id)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600'
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
      </div>
    );
  }

  // 세로 모드: 스크롤 가능
  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-3 hover:bg-gray-100 rounded-xl transition">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
            }`}>
              <User size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">{student.name}</h1>
              <p className="text-gray-500 text-sm">
                {student.gender === 'M' ? '남' : '여'} · {student.school} · {student.grade}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={loadData}
          className="p-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 2 Column: 게이지 + 종합평가 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Record Gauges */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">종목별 기록</h3>
          <div className="grid grid-cols-2 gap-2">
            {selectedGaugeTypes.slice(0, 4).map((typeId) => {
              const type = recordTypes.find(t => t.id === typeId);
              const latestRecord = stats.latests[typeId];
              const hasRecord = latestRecord !== undefined && latestRecord !== null;
              const value = latestRecord?.value || 0;
              const percentage = getRecordPercentage(typeId, value, hasRecord);
              const trend = stats.trends[typeId];

              const gaugeData = [
                { value: percentage, color: getScoreColor(percentage) },
                { value: 100 - percentage, color: '#e5e7eb' }
              ];

              return (
                <div key={typeId} className="relative">
                  <ResponsiveContainer width="100%" height={100}>
                    <PieChart>
                      <Pie
                        data={gaugeData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="75%"
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
                    <span className="text-sm font-bold">
                      {hasRecord ? value : '-'}<span className="text-[10px] font-normal text-gray-400">{type?.unit}</span>
                    </span>
                    <span className="text-[9px] text-gray-500">{type?.short_name || type?.name}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                    <TrendIcon trend={trend || 'need_more'} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {recordTypes.slice(0, 6).map(type => (
              <button
                key={type.id}
                onClick={() => toggleGaugeType(type.id)}
                className={`text-xs px-2 py-1 rounded ${
                  selectedGaugeTypes.includes(type.id)
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
                disabled={selectedGaugeTypes.length >= 4 && !selectedGaugeTypes.includes(type.id)}
              >
                {type.short_name || type.name}
              </button>
            ))}
          </div>
        </div>

        {/* Overall Grade */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col justify-center">
          <h3 className="font-semibold text-gray-800 mb-3">종합평가</h3>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getGradeColor(selectedStats.grade)}`}>
              <span className="text-3xl font-bold">{selectedStats.grade}</span>
            </div>
            <div>
              <span className="text-2xl font-bold">{selectedStats.totalScore}<span className="text-sm font-normal">점</span></span>
              <span className="text-gray-400 text-sm"> / {selectedStats.maxScore}점</span>
              <p className="text-sm text-gray-500">({selectedStats.percentage}%)</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            <TrendIcon trend={stats.overallTrend} />
            <span className="text-sm text-gray-500">
              {stats.overallTrend === 'up' ? '상승세' : stats.overallTrend === 'down' ? '하락세' : '유지'}
            </span>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">기록 추이</h3>
          <select
            className="text-sm border rounded-lg px-3 py-2"
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
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              domain={trendYDomain as [number, number]}
              reversed={isTrendTypeLower}
              tickFormatter={(value) => Number(value).toFixed(1)}
            />
            <Tooltip
              formatter={(value) => {
                const type = recordTypes.find(t => t.id === selectedTrendType);
                return [`${value}${type?.unit || ''}`, '기록'];
              }}
            />
            <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 2 Column: 비교 차트들 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">학원평균 vs {student.name}</h3>
          <ResponsiveContainer width="100%" height={compareBarData.length * 35 + 40}>
            <BarChart data={compareBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
              <YAxis dataKey="name" type="category" width={50} tick={{ fontSize: 9 }} />
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
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">능력치 비교</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarChartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8 }} />
              <Radar name="학원평균" dataKey="academy" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
              <Radar name={student.name} dataKey="student" stroke="#f97316" fill="#f97316" fillOpacity={0.5} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-1">
            {recordTypes.slice(0, 6).map(type => (
              <button
                key={type.id}
                className={`text-xs px-2 py-1 rounded ${
                  selectedRadarTypes.includes(type.id)
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600'
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

      {/* Recent Records Table */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">최근 기록</h3>
          {recordHistory.length > 6 && (
            <button
              onClick={() => setShowAllRecords(!showAllRecords)}
              className="text-xs text-orange-500 flex items-center gap-1"
            >
              {showAllRecords ? '접기' : `더보기 (${recordHistory.length}개)`}
              <ChevronDown size={14} className={showAllRecords ? 'rotate-180' : ''} />
            </button>
          )}
        </div>
        <div className={`overflow-x-auto ${showAllRecords ? 'max-h-60 overflow-y-auto' : ''}`}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="text-left py-2 px-3">날짜</th>
                {recordTypes.slice(0, 4).map(type => (
                  <th key={type.id} className="text-center py-2 px-3">
                    {type.short_name || type.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((history, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">
                    {new Date(history.measured_at).toLocaleDateString('ko-KR')}
                  </td>
                  {recordTypes.slice(0, 4).map(type => {
                    const record = history.records.find(r => r.record_type_id === type.id);
                    return (
                      <td key={type.id} className="text-center py-2 px-3">
                        {record ? (
                          <span className="font-medium">
                            {record.value}
                            <span className="text-gray-400 text-xs ml-0.5">{type.unit}</span>
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
