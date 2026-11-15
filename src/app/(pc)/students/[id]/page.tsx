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
import { PageHeader, StatTile, chipClass, toolbarButtonClass } from '@/components/ui/page';
import apiClient from '@/lib/api/client';
import {
  displayTypeName,
  formatDate,
  formatRecordValue,
  getLocalDateString,
  getProfileErrorMessage,
  getRecordPercentage,
  getTrendAxis,
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

  const trendAxis = useMemo(() => getTrendAxis(
    trendChartData.map((item) => item.value),
    selectedChartType ? scoreTables[selectedChartType]?.decimal_places : undefined,
  ), [scoreTables, selectedChartType, trendChartData]);

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
      link.download = `${student.name}_실기기록_${getLocalDateString()}.pdf`;
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
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student || !stats) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="rounded-2xl bg-card p-6 text-center">
          <p className="text-sm font-semibold text-secondary-foreground">학생 정보를 찾지 못했습니다.</p>
          <button type="button" onClick={() => router.push('/students')} className="mt-4 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
            학생 관리로 이동
          </button>
        </div>
      </div>
    );
  }

  const chartType = recordTypes.find((type) => type.id === selectedChartType);
  const visibleRecords = showAllRecords ? recordHistory : recordHistory.slice(0, 5);

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => router.back()} className={`${toolbarButtonClass()} mt-2.5 w-10 px-0`} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader
          className="min-w-0 flex-1"
          title={student.name}
          description={`${student.gender === 'M' ? '남' : '여'} · ${student.school || '-'} · ${student.grade || '-'} · ${trendLabel(stats.overallTrend)} 추세`}
          actions={(
            <>
              <button type="button" onClick={() => router.push('/records')} className={toolbarButtonClass()}>
                <Plus className="h-4 w-4" />
                기록 입력
              </button>
              <button type="button" onClick={() => router.push('/students/records')} className={toolbarButtonClass()}>
                <TableProperties className="h-4 w-4" />
                전체 기록표
              </button>
              <button type="button" onClick={handleDownloadPDF} disabled={pdfLoading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                <Download className="h-4 w-4" />
                {pdfLoading ? '저장 중' : 'PDF 저장'}
              </button>
            </>
          )}
        />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Target} tone="primary" label="선택 종목 점수" value={`${selectedSummary.totalScore}`} note={`/ ${selectedSummary.maxScore}점 · ${selectedSummary.percentage}%`} />
        <StatTile icon={Medal} label="등급" value={<BadgeValue value={selectedSummary.grade} className={gradeClass(selectedSummary.grade)} />} note={`${selectedSummary.recordedCount}개 종목 반영`} />
        <StatTile icon={Activity} label="전체 추세" value={<BadgeValue value={trendLabel(stats.overallTrend)} className={trendClass(stats.overallTrend)} />} note={`${stats.recordCount}개 기록`} />
        <StatTile icon={User} label="기록 종목" value={`${stats.typesWithRecords}`} note={`${recordHistory.length}회 측정`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl bg-card p-5">
            <h2 className="text-[17px] font-bold tracking-tight text-foreground">종목 선택</h2>
            <p className="mt-1 text-sm text-muted-foreground">비교와 점수 요약에 반영할 종목을 고릅니다. 최대 6개입니다.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {typesWithRecords.map((type) => {
                const selected = selectedTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleType(type.id)}
                    disabled={!selected && selectedTypes.length >= 6}
                    aria-pressed={selected}
                    className={`${chipClass(selected, 'card')} disabled:opacity-40`}
                  >
                    {displayTypeName(type)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-card p-5">
            <h2 className="text-[17px] font-bold tracking-tight text-foreground">최근 기록 요약</h2>
            <div className="mt-3 space-y-2">
              {selectedTypeObjects.map((type) => {
                const latest = stats.latests[type.id];
                const score = stats.scores[type.id];
                return (
                  <div key={type.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-muted px-3.5 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{type.name}</p>
                      <p className="text-xs text-muted-foreground">최고 {formatRecordValue(stats.bests[type.id]?.value, type.unit)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-foreground">{formatRecordValue(latest?.value, type.unit)}</p>
                      <p className="text-xs font-bold text-primary">{score ?? '-'}점</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <section className="rounded-2xl bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-primary" />
                  <h2 className="text-[17px] font-bold tracking-tight text-foreground">기록 추이</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">선택한 종목의 날짜별 기록입니다.</p>
              </div>
              <select
                value={selectedChartType ?? ''}
                onChange={(event) => setSelectedChartType(Number(event.target.value))}
                className="h-10 rounded-xl border border-transparent bg-muted px-3 text-sm font-semibold text-secondary-foreground outline-none focus:border-primary"
              >
                {typesWithRecords.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    domain={trendAxis.domain}
                    reversed={chartType?.direction === 'lower'}
                    allowDecimals={trendAxis.decimalPlaces > 0}
                    tickFormatter={(value: number) => value.toFixed(trendAxis.decimalPlaces)}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip formatter={(value) => [`${value}${chartType?.unit || ''}`, '기록']} />
                  <Line type="monotone" dataKey="value" stroke="#3182F6" strokeWidth={3} dot={{ fill: '#3182F6', r: 4 }} />
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
                  <Bar dataKey="student" name="student" fill="#3182F6" radius={[0, 4, 4, 0]} />
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
                  <Radar dataKey="student" name={student.name} stroke="#3182F6" fill="#3182F6" fillOpacity={0.28} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>
        </div>
      </section>

      <section className="rounded-2xl bg-card">
        <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">최근 기록</h2>
          {recordHistory.length > 5 && (
            <button type="button" onClick={() => setShowAllRecords((prev) => !prev)} className="text-sm font-bold text-primary">
              {showAllRecords ? '접기' : `전체 ${recordHistory.length}회 보기`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[13px] text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-5 py-3 text-left font-semibold sm:px-6">날짜</th>
                {selectedTypeObjects.map((type) => <th key={type.id} className="px-3 py-3 text-center font-semibold">{displayTypeName(type)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {visibleRecords.map((history) => (
                <tr key={history.measured_at}>
                  <td className="px-5 py-3.5 font-semibold text-secondary-foreground sm:px-6">{formatDate(history.measured_at)}</td>
                  {selectedTypeObjects.map((type) => {
                    const matches = history.records.filter((item) => item.record_type_id === type.id);
                    return (
                      <td key={type.id} className="px-3 py-3.5 text-center font-semibold tabular-nums text-foreground">
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
    </div>
  );
}

function BadgeValue({ className, value }: { className: string; value: string }) {
  return <span className={`inline-flex rounded-lg border px-2.5 py-0.5 ${className}`}>{value}</span>;
}

function ChartCard({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}
