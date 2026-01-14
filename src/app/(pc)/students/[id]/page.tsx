'use client';

import { useState, useEffect, useMemo, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Trophy,
  Activity,
  FileDown,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Radar as RadarIcon,
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

  const [selectedGaugeTypes, setSelectedGaugeTypes] = useState<number[]>([]);
  const [selectedTrendType, setSelectedTrendType] = useState<number | null>(null);
  const [selectedRadarTypes, setSelectedRadarTypes] = useState<number[]>([]);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const toggleGaugeType = (typeId: number) => {
    if (selectedGaugeTypes.includes(typeId)) {
      setSelectedGaugeTypes(selectedGaugeTypes.filter(id => id !== typeId));
    } else if (selectedGaugeTypes.length < 6) {
      setSelectedGaugeTypes([...selectedGaugeTypes, typeId]);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contentRef.current || !student) return;

    try {
      setPdfLoading(true);
      const originalElement = contentRef.current;
      const styleMap = new Map<Element, CSSStyleDeclaration>();

      const collectStyles = (el: Element) => {
        styleMap.set(el, window.getComputedStyle(el));
        Array.from(el.children).forEach(collectStyles);
      };
      collectStyles(originalElement);

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        onclone: (clonedDoc, clonedElement) => {
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
          clonedDoc.head.innerHTML = '<meta charset="utf-8">';

          const applyStyles = (original: Element, cloned: Element) => {
            if (cloned instanceof HTMLElement) {
              const computed = styleMap.get(original);
              if (computed) {
                const props = [
                  'background-color', 'color', 'border-color', 'border-width', 'border-style', 'border-radius',
                  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
                  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                  'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing', 'text-align',
                  'display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'gap',
                  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
                  'position', 'top', 'right', 'bottom', 'left', 'z-index',
                  'overflow', 'opacity', 'visibility', 'box-shadow', 'text-decoration',
                  'grid-template-columns', 'grid-template-rows', 'grid-gap'
                ];

                props.forEach(prop => {
                  const value = computed.getPropertyValue(prop);
                  if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
                    cloned.style.setProperty(prop, value, 'important');
                  }
                });

                if (cloned.tagName === 'svg' || cloned.closest('svg')) {
                  ['fill', 'stroke'].forEach(prop => {
                    const value = computed.getPropertyValue(prop);
                    if (value) cloned.style.setProperty(prop, value);
                  });
                }
              }
              cloned.removeAttribute('class');
            }

            const origChildren = Array.from(original.children);
            const clonedChildren = Array.from(cloned.children);
            origChildren.forEach((origChild, i) => {
              if (clonedChildren[i]) {
                applyStyles(origChild, clonedChildren[i]);
              }
            });
          };

          applyStyles(originalElement, clonedElement);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const x = (pdfWidth - scaledWidth) / 2;
      const y = (pdfHeight - scaledHeight) / 2;
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
      pdf.save(`${student.name}_실기기록_${new Date().toISOString().split('T')[0]}.pdf`);
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
      const gender = statsRes.data.student?.gender;
      if (gender === 'M') {
        setAcademyAverages(academyRes.data.maleAverages || {});
        setAcademyScoreAverages(academyRes.data.maleScoreAverages || {});
      } else {
        setAcademyAverages(academyRes.data.femaleAverages || {});
        setAcademyScoreAverages(academyRes.data.femaleScoreAverages || {});
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

      setSelectedGaugeTypes(typesWithRecords.slice(0, 6).map((t: RecordType) => t.id));
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
      const studentScore = stats.scores[typeId] || 0;
      const academyScore = academyScoreAverages[typeId] || 0;
      return {
        subject: type?.short_name || type?.name || `종목${typeId}`,
        student: studentScore,
        academy: academyScore
      };
    });
  }, [stats, selectedRadarTypes, recordTypes, academyScoreAverages]);

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
    if (recordedCount === 0) {
      grade = '-';
    } else if (percentage >= 90) grade = 'A';
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
    if (percentage >= 90) return '#FF8200';
    if (percentage >= 70) return '#4666FF';
    if (percentage >= 50) return '#468FEA';
    return '#64748b';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'from-orange-500 to-orange-600';
      case 'B': return 'from-blue-500 to-blue-600';
      case 'C': return 'from-cyan-500 to-cyan-600';
      case 'D': return 'from-slate-500 to-slate-600';
      default: return 'from-slate-600 to-slate-700';
    }
  };

  const TrendIcon = ({ trend, className = "" }: { trend: string; className?: string }) => {
    if (trend === 'up') return <TrendingUp className={`text-orange-400 ${className}`} size={18} />;
    if (trend === 'down') return <TrendingDown className={`text-slate-400 ${className}`} size={18} />;
    return <Activity className={`text-slate-400 ${className}`} size={18} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-lg">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!student || !stats) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-4">학생 정보를 찾을 수 없습니다.</p>
          <button 
            onClick={() => router.back()} 
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const visibleRecords = showAllRecords ? recordHistory : recordHistory.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div ref={contentRef} className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-3 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-800/50 rounded-xl transition border border-slate-800"
            >
              <ArrowLeft className="text-slate-300" size={24} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-4xl font-bold text-white tracking-tight">{student.name}</h1>
                <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-sm font-medium rounded-lg border border-orange-500/30">
                  {student.gender === 'M' ? '남' : '여'}
                </span>
              </div>
              <p className="text-slate-400 text-base">
                {student.school} • {student.grade} • {student.phone}
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-orange-500/20"
          >
            <FileDown size={20} />
            {pdfLoading ? 'PDF 생성중...' : 'PDF 다운로드'}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-orange-500/30 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs uppercase tracking-wider font-medium">총점</span>
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Target className="text-orange-400" size={18} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white">{selectedStats.totalScore}</span>
              <span className="text-slate-500 text-lg mb-1">/ {selectedStats.maxScore}점</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                  style={{ width: `${selectedStats.percentage}%` }}
                />
              </div>
              <span className="text-orange-400 text-sm font-medium">{selectedStats.percentage}%</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-blue-500/30 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs uppercase tracking-wider font-medium">등급</span>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Award className="text-blue-400" size={18} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getGradeColor(selectedStats.grade)} flex items-center justify-center shadow-lg`}>
                <span className="text-4xl font-bold text-white">{selectedStats.grade}</span>
              </div>
              <div>
                <p className="text-slate-300 text-sm mb-1">평가 완료</p>
                <p className="text-white text-2xl font-bold">{selectedStats.recordedCount}개</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs uppercase tracking-wider font-medium">추세</span>
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Activity className="text-cyan-400" size={18} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendIcon trend={stats.overallTrend} className="w-12 h-12" />
              <div>
                <p className="text-white text-2xl font-bold">
                  {stats.overallTrend === 'up' ? '상승세' : stats.overallTrend === 'down' ? '하락세' : '안정'}
                </p>
                <p className="text-slate-400 text-sm">전체 추세</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-purple-500/30 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs uppercase tracking-wider font-medium">기록 수</span>
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Trophy className="text-purple-400" size={18} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white">{stats.typesWithRecords}</span>
              <span className="text-slate-500 text-lg mb-1">종목</span>
            </div>
            <p className="text-slate-400 text-sm mt-2">총 {recordHistory.length}회 측정</p>
          </div>
        </div>

        {/* Main Bento Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Gauges - 3 columns */}
          <div className="col-span-3 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <PieChartIcon className="text-orange-400" size={20} />
              <h3 className="text-lg font-semibold text-white">종목별 기록</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {selectedGaugeTypes.slice(0, 6).map((typeId) => {
                const type = recordTypes.find(t => t.id === typeId);
                const latestRecord = stats.latests[typeId];
                const hasRecord = latestRecord !== undefined && latestRecord !== null;
                const value = latestRecord?.value || 0;
                const percentage = getRecordPercentage(typeId, value, hasRecord);
                const trend = stats.trends[typeId];

                const gaugeData = [
                  { value: percentage, color: getScoreColor(percentage) },
                  { value: 100 - percentage, color: '#1e293b' }
                ];

                return (
                  <div key={typeId} className="relative h-[120px] bg-slate-900/70 rounded-xl p-3 border border-slate-800/50">
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
                      <span className="text-2xl font-bold text-white">
                        {hasRecord ? value : '-'}
                      </span>
                      <span className="text-xs text-slate-400">{type?.unit}</span>
                      <span className="text-[10px] text-slate-500 uppercase mt-1">{type?.short_name || type?.name}</span>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <TrendIcon trend={trend || 'stable'} className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">종목 선택 (최대 6개)</p>
              <div className="flex flex-wrap gap-1.5">
                {recordTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleGaugeType(type.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                      selectedGaugeTypes.includes(type.id)
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                    } ${selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id) ? 'opacity-30 cursor-not-allowed' : ''}`}
                    disabled={selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id)}
                  >
                    {type.short_name || type.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trend Chart - 5 columns */}
          <div className="col-span-5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <LineChartIcon className="text-blue-400" size={20} />
                <h3 className="text-lg font-semibold text-white">기록 추이</h3>
              </div>
              <select
                className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedTrendType || ''}
                onChange={(e) => setSelectedTrendType(parseInt(e.target.value))}
              >
                {recordTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4666FF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4666FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#94a3b8', fontSize: 13 }} 
                  stroke="#334155"
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 13 }}
                  stroke="#334155"
                  axisLine={{ stroke: '#334155' }}
                  domain={trendYDomain as [number, number]}
                  reversed={isTrendTypeLower}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '14px'
                  }}
                  labelStyle={{ color: '#cbd5e1', marginBottom: '4px' }}
                  itemStyle={{ color: '#4666FF', fontWeight: 600 }}
                  formatter={(value) => {
                    const type = recordTypes.find(t => t.id === selectedTrendType);
                    return [`${value}${type?.unit || ''}`, '기록'];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4666FF"
                  strokeWidth={3}
                  dot={{ fill: '#4666FF', r: 5, strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 7, fill: '#4666FF', stroke: '#fff', strokeWidth: 2 }}
                  fill="url(#lineGradient)"
                />
              </LineChart>
            </ResponsiveContainer>
            {isTrendTypeLower && (
              <p className="text-xs text-slate-500 text-center mt-2">* 낮을수록 좋은 종목 (Y축 반전)</p>
            )}
          </div>

          {/* Comparison Chart - 4 columns */}
          <div className="col-span-4 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="text-cyan-400" size={20} />
              <h3 className="text-lg font-semibold text-white">학원 평균 비교</h3>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">만점 대비 달성률 (%)</p>
            
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={compareBarData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  tick={{ fill: '#94a3b8', fontSize: 13 }} 
                  stroke="#334155"
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  tick={{ fill: '#cbd5e1', fontSize: 13 }}
                  stroke="#334155"
                  axisLine={{ stroke: '#334155' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '14px'
                  }}
                  labelStyle={{ color: '#cbd5e1', marginBottom: '4px' }}
                  formatter={(value, name, props) => {
                    const data = props.payload;
                    if (name === '학원평균') return [`${data.academyRaw}${data.unit} (${value}%)`, name];
                    return [`${data.studentRaw}${data.unit} (${value}%)`, name];
                  }}
                />
                <Bar dataKey="academy" fill="#64748b" radius={[0, 8, 8, 0]} name="학원평균" />
                <Bar dataKey="student" fill="#FF8200" radius={[0, 8, 8, 0]} name={student.name} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart - 5 columns */}
          <div className="col-span-5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RadarIcon className="text-purple-400" size={20} />
                <h3 className="text-lg font-semibold text-white">능력치 분석</h3>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-slate-500 rounded-sm"></span>
                  <span className="text-slate-400">학원평균</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-500 rounded-sm"></span>
                  <span className="text-slate-400">{student.name}</span>
                </span>
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#334155" strokeWidth={1} />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#cbd5e1', fontSize: 13, fontWeight: 500 }} 
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 100]} 
                  tick={{ fill: '#64748b', fontSize: 11 }} 
                  stroke="#334155"
                />
                <Radar
                  name="학원평균"
                  dataKey="academy"
                  stroke="#64748b"
                  fill="#64748b"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Radar
                  name={student.name}
                  dataKey="student"
                  stroke="#FF8200"
                  fill="#FF8200"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-1.5 mt-4">
              {recordTypes.slice(0, 8).map(type => (
                <button
                  key={type.id}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    selectedRadarTypes.includes(type.id)
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
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

          {/* Recent Records Table - 7 columns */}
          <div className="col-span-7 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">최근 기록</h3>
              {recordHistory.length > 5 && (
                <button
                  onClick={() => setShowAllRecords(!showAllRecords)}
                  className="text-sm text-orange-400 hover:text-orange-300 font-medium transition"
                >
                  {showAllRecords ? '접기' : `전체보기 (${recordHistory.length})`}
                </button>
              )}
            </div>
            
            <div className={`overflow-x-auto ${showAllRecords ? 'max-h-64 overflow-y-auto' : ''}`}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-sm">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-slate-400 uppercase tracking-wider text-xs font-medium">날짜</th>
                    {recordTypes.slice(0, 6).map(type => (
                      <th key={type.id} className="text-center py-3 px-4 text-slate-400 uppercase tracking-wider text-xs font-medium">
                        {type.short_name || type.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((history, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-medium text-white">
                        {new Date(history.measured_at).toLocaleDateString('ko-KR', { 
                          year: '2-digit', 
                          month: '2-digit', 
                          day: '2-digit' 
                        })}
                      </td>
                      {recordTypes.slice(0, 6).map(type => {
                        const record = history.records.find(r => r.record_type_id === type.id);
                        return (
                          <td key={type.id} className="text-center py-3 px-4">
                            {record ? (
                              <span className="font-semibold text-white">
                                {record.value}
                                <span className="text-slate-500 text-xs ml-1">{type.unit}</span>
                              </span>
                            ) : (
                              <span className="text-slate-700">-</span>
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
      </div>
    </div>
  );
}