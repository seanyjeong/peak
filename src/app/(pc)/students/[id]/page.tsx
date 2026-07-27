'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Download,
  LineChart as LineChartIcon,
  Medal,
  Plus,
  Radar as RadarIcon,
  TableProperties,
  Target,
  User,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useToast } from '@/hooks/useToast';
import apiClient from '@/lib/api/client';
import {
  displayTypeName,
  formatDate,
  formatRecordValue,
  getProfileErrorMessage,
  getRecordPercentage,
  gradeClass,
  RecordHistory,
  RecordType,
  ScoreTable,
  Student,
  StudentStats,
  trendClass,
  trendLabel,
} from './student-profile-model';

export default function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [academyAverages, setAcademyAverages] = useState<Record<number, number>>({});
  const [academyScoreAverages, setAcademyScoreAverages] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [recordHistory, setRecordHistory] = useState<RecordHistory[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [scoreTables, setScoreTables] = useState<Record<number, ScoreTable>>({});
  const [selectedChartType, setSelectedChartType] = useState<number | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<number[]>([]);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    loadData();
  }, [studentId]);

  const typesWithRecords = useMemo(
    () => recordTypes.filter((type) => stats?.latests[type.id] !== undefined),
    [recordTypes, stats],
  );

  const selectedTypeObjects = useMemo(
    () => selectedTypes.map((id) => recordTypes.find((type) => type.id === id)).filter((type): type is RecordType => Boolean(type)),
    [recordTypes, selectedTypes],
  );

  const selectedSummary = useMemo(() => {
    if (!stats) return { totalScore: 0, maxScore: 0, percentage: 0, recordedCount: 0, grade: '-' };
    let totalScore = 0;
    let maxScore = 0;
    let recordedCount = 0;
    selectedTypes.forEach((typeId) => {
      if (stats.latests[typeId] === undefined) return;
      recordedCount += 1;
      maxScore += scoreTables[typeId]?.max_score || 100;
      totalScore += stats.scores[typeId] || 0;
    });
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const grade = recordedCount === 0 ? '-' : percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F';
    return { totalScore, maxScore, percentage, recordedCount, grade };
  }, [scoreTables, selectedTypes, stats]);

  const trendChartData = useMemo(() => {
    if (!selectedChartType) return [];
    const points: { date: string; value: number; sortKey: string }[] = [];
    recordHistory.forEach((history) => {
      history.records
        .filter((record) => record.record_type_id === selectedChartType)
        .forEach((record, idx) => {
          const isMonthly = (record as { source?: string }).source === 'monthly_test';
          const base = formatDate(history.measured_at);
          points.push({
            date: isMonthly ? `${base} 월말` : base,
            value: Number(record.value) || 0,
            sortKey: `${history.measured_at}#${isMonthly ? 'm' : 't'}#${idx}`,
          });
        });
    });
    return points.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [recordHistory, selectedChartType]);

  const trendDomain = useMemo(() => {
    if (trendChartData.length === 0) return [0, 100] as [number, number];
    const values = trendChartData.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.2, 1);
    return [Math.max(0, min - padding), max + padding] as [number, number];
  }, [trendChartData]);

  const comparisonData = useMemo(() => {
    if (!stats || !student) return [];
    return selectedTypeObjects.map((type) => {
      const value = stats.latests[type.id]?.value || 0;
      const academyValue = academyAverages[type.id] || 0;
      return {
        name: displayTypeName(type),
        student: Math.round(getRecordPercentage({ recordTypes, scoreTables, student, typeId: type.id, value })),
        academy: Math.round(getRecordPercentage({ recordTypes, scoreTables, student, typeId: type.id, value: academyValue })),
        raw: formatRecordValue(value, type.unit),
        academyRaw: formatRecordValue(academyValue, type.unit),
      };
    });
  }, [academyAverages, recordTypes, scoreTables, selectedTypeObjects, stats, student]);

  const radarData = useMemo(() => {
    if (!stats) return [];
    return selectedTypeObjects.slice(0, 5).map((type) => ({
      subject: displayTypeName(type),
      student: stats.scores[type.id] || 0,
      academy: academyScoreAverages[type.id] || 0,
    }));
  }, [academyScoreAverages, selectedTypeObjects, stats]);

  async function loadData() {
    try {
      setLoading(true);
      const [statsRes, historyRes, typesRes, academyRes, scoreTablesRes] = await Promise.all([
        apiClient.get(`/students/${studentId}/stats`),
        apiClient.get(`/students/${studentId}/records`),
        apiClient.get('/record-types?active=true'),
        apiClient.get('/stats/academy-average'),
        apiClient.get('/score-tables'),
      ]);

      const loadedStudent = statsRes.data.student as Student;
      const loadedStats = statsRes.data.stats as StudentStats;
      const loadedTypes = typesRes.data.recordTypes || [];
      const tableMap: Record<number, ScoreTable> = {};
      (scoreTablesRes.data.scoreTables || []).forEach((table: ScoreTable) => {
        tableMap[table.record_type_id] = table;
      });

      setStudent(loadedStudent);
      setStats(loadedStats);
      setRecordHistory(historyRes.data.records || []);
      setRecordTypes(loadedTypes);
      setScoreTables(tableMap);
      setAcademyAverages(loadedStudent.gender === 'M' ? academyRes.data.maleAverages || {} : academyRes.data.femaleAverages || {});
      setAcademyScoreAverages(loadedStudent.gender === 'M' ? academyRes.data.maleScoreAverages || {} : academyRes.data.femaleScoreAverages || {});

      const initialTypes = loadedTypes.filter((type: RecordType) => loadedStats.latests?.[type.id] !== undefined);
      setSelectedTypes(initialTypes.slice(0, 6).map((type: RecordType) => type.id));
      setSelectedChartType(initialTypes[0]?.id || null);
    } catch (error) {
      toast.error(getProfileErrorMessage(error, '학생 상세 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!student) return;
    try {
      setPdfLoading(true);
      const token = localStorage.getItem('peak_token');
      const response = await apiClient.get(`/students/${studentId}/export-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${student.name}_실기기록_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getProfileErrorMessage(error, 'PDF를 저장하지 못했습니다.'));
    } finally {
      setPdfLoading(false);
    }
  }

  const toggleType = (typeId: number) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeId)) return prev.filter((id) => id !== typeId);
      if (prev.length >= 6) return prev;
      return [...prev, typeId];
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!student || !stats) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">학생 정보를 찾지 못했습니다.</p>
          <button type="button" onClick={() => router.push('/students')} className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            학생 관리로 이동
          </button>
        </div>
      </div>
    );
  }

  const chartType = recordTypes.find((type) => type.id === selectedChartType);
  const visibleRecords = showAllRecords ? recordHistory : recordHistory.slice(0, 5);

  return (
    <main className="max-w-[1440px] space-y-5 px-6 py-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-bold text-blue-700">STUDENT PROFILE</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{student.name}</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{student.gender === 'M' ? '남' : '여'}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{student.school || '-'} · {student.grade || '-'} · {trendLabel(stats.overallTrend)} 추세</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => router.push('/records')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            기록 입력
          </button>
          <button type="button" onClick={() => router.push('/students/records')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <TableProperties className="h-4 w-4" />
            전체 기록표
          </button>
          <button type="button" onClick={handleDownloadPDF} disabled={pdfLoading} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
            <Download className="h-4 w-4" />
            {pdfLoading ? '저장 중' : 'PDF 저장'}
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<Target className="h-4 w-4" />} label="선택 종목 점수" value={`${selectedSummary.totalScore}`} sub={`/ ${selectedSummary.maxScore}점 · ${selectedSummary.percentage}%`} />
        <MetricCard icon={<Medal className="h-4 w-4" />} label="등급" value={selectedSummary.grade} sub={`${selectedSummary.recordedCount}개 종목 반영`} badgeClass={gradeClass(selectedSummary.grade)} />
        <MetricCard icon={<Activity className="h-4 w-4" />} label="전체 추세" value={trendLabel(stats.overallTrend)} sub={`${stats.recordCount}개 기록`} badgeClass={trendClass(stats.overallTrend)} />
        <MetricCard icon={<User className="h-4 w-4" />} label="기록 종목" value={`${stats.typesWithRecords}`} sub={`${recordHistory.length}회 측정`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">종목 선택</h2>
            <p className="mt-1 text-sm text-slate-500">비교와 점수 요약에 반영할 종목을 고릅니다. 최대 6개입니다.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {typesWithRecords.map((type) => {
                const selected = selectedTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleType(type.id)}
                    disabled={!selected && selectedTypes.length >= 6}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold transition disabled:opacity-40 ${
                      selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {displayTypeName(type)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">최근 기록 요약</h2>
            <div className="mt-3 space-y-2">
              {selectedTypeObjects.map((type) => {
                const latest = stats.latests[type.id];
                const score = stats.scores[type.id];
                return (
                  <div key={type.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">{type.name}</p>
                      <p className="text-xs text-slate-500">최고 {formatRecordValue(stats.bests[type.id]?.value, type.unit)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-slate-950">{formatRecordValue(latest?.value, type.unit)}</p>
                      <p className="text-xs font-bold text-blue-700">{score ?? '-'}점</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-blue-700" />
                  <h2 className="text-base font-bold text-slate-950 dark:text-white">기록 추이</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">선택한 종목의 날짜별 기록입니다.</p>
              </div>
              <select
                value={selectedChartType ?? ''}
                onChange={(event) => setSelectedChartType(Number(event.target.value))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                {typesWithRecords.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis domain={trendDomain} reversed={chartType?.direction === 'lower'} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value}${chartType?.unit || ''}`, '기록']} />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ fill: '#2563eb', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="학원 평균 비교" icon={<BarChart3 className="h-5 w-5 text-cyan-700" />}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={70} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip formatter={(value, name, props) => [`${value}%`, name === 'student' ? `${student.name} ${props.payload.raw}` : `학원 ${props.payload.academyRaw}`]} />
                  <Bar dataKey="academy" name="academy" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="student" name="student" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="점수 밸런스" icon={<RadarIcon className="h-5 w-5 text-violet-700" />}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar dataKey="academy" name="학원" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.18} />
                  <Radar dataKey="student" name={student.name} stroke="#f97316" fill="#f97316" fillOpacity={0.28} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-950 dark:text-white">최근 기록</h2>
          {recordHistory.length > 5 && (
            <button type="button" onClick={() => setShowAllRecords((prev) => !prev)} className="text-sm font-bold text-blue-700">
              {showAllRecords ? '접기' : `전체 ${recordHistory.length}회 보기`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-5 py-3 text-left font-bold">날짜</th>
                {selectedTypeObjects.map((type) => <th key={type.id} className="px-3 py-3 text-center font-bold">{displayTypeName(type)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRecords.map((history) => (
                <tr key={history.measured_at}>
                  <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">{formatDate(history.measured_at)}</td>
                  {selectedTypeObjects.map((type) => {
                    const matches = history.records.filter((item) => item.record_type_id === type.id);
                    return (
                      <td key={type.id} className="px-3 py-3 text-center font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {matches.length === 0
                          ? '-'
                          : matches.map((record, idx) => {
                              const isMonthly = (record as { source?: string }).source === 'monthly_test';
                              return (
                                <span key={`${type.id}-${idx}`} className="block">
                                  {formatRecordValue(record.value, type.unit)}
                                  {isMonthly ? <span className="ml-1 text-[10px] font-bold text-violet-600">월말</span> : null}
                                </span>
                              );
                            })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ badgeClass, icon, label, sub, value }: { badgeClass?: string; icon: React.ReactNode; label: string; sub: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-bold">{label}</span>
        {icon}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={`rounded-lg border px-3 py-1 text-2xl font-black tracking-tight ${badgeClass || 'border-transparent text-slate-950 dark:text-white'}`}>{value}</span>
      </div>
      <p className="mt-2 text-sm text-slate-500">{sub}</p>
    </div>
  );
}

function ChartCard({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}
