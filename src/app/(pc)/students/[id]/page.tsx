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

      // 1. 모든 요소의 computed style을 미리 수집
      const styleMap = new Map<Element, Record<string, string>>();
      const cssProps = [
        'background-color', 'color', 'border-color', 'border-width', 'border-style', 'border-radius',
        'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
        'padding', 'margin', 'font-size', 'font-weight', 'font-family', 'line-height', 'text-align',
        'display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'gap',
        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
        'position', 'top', 'right', 'bottom', 'left', 'overflow', 'opacity', 'box-shadow',
        'grid-template-columns', 'grid-template-rows', 'fill', 'stroke'
      ];

      const collectStyles = (el: Element) => {
        const computed = window.getComputedStyle(el);
        const styles: Record<string, string> = {};
        cssProps.forEach(prop => {
          const value = computed.getPropertyValue(prop);
          if (value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px') {
            styles[prop] = value;
          }
        });
        styleMap.set(el, styles);
        Array.from(el.children).forEach(collectStyles);
      };
      collectStyles(contentRef.current);

      // 2. iframe 생성 (격리된 환경)
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;width:1800px;height:900px;border:none;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument!;
      const isDark = document.documentElement.classList.contains('dark');
      const bgColor = isDark ? '#0f172a' : '#f1f5f9';

      // 3. iframe에 HTML 복사 (스타일 없이)
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:${bgColor};"></body></html>`);
      iframeDoc.close();

      // 4. 요소 클론 및 인라인 스타일 적용
      const cloneWithStyles = (original: Element, parent: Element) => {
        const clone = iframeDoc.createElement(original.tagName.toLowerCase());

        // 속성 복사 (class 제외)
        Array.from(original.attributes).forEach(attr => {
          if (attr.name !== 'class') {
            clone.setAttribute(attr.name, attr.value);
          }
        });

        // 저장된 스타일 적용
        const styles = styleMap.get(original);
        if (styles && clone instanceof HTMLElement) {
          Object.entries(styles).forEach(([prop, value]) => {
            clone.style.setProperty(prop, value);
          });
        }

        // 텍스트 노드 복사
        Array.from(original.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            clone.appendChild(iframeDoc.createTextNode(child.textContent || ''));
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            cloneWithStyles(child as Element, clone);
          }
        });

        parent.appendChild(clone);
      };

      cloneWithStyles(contentRef.current, iframeDoc.body);

      // 5. html2canvas로 캡처 (CSS 파싱 없음)
      const canvas = await html2canvas(iframeDoc.body.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: bgColor,
      });

      // 6. iframe 제거
      document.body.removeChild(iframe);

      // 7. PDF 생성
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      const scaledWidth = canvas.width * ratio;
      const scaledHeight = canvas.height * ratio;
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
      <div className="h-[calc(100vh-56px)] bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!student || !stats) {
    return (
      <div className="h-[calc(100vh-56px)] bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-3">학생 정보를 찾을 수 없습니다.</p>
          <button onClick={() => router.back()} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-sm transition">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const visibleRecords = showAllRecords ? recordHistory : recordHistory.slice(0, 3);

  return (
    <div className="h-[calc(100vh-56px)] bg-slate-100 dark:bg-slate-900 p-3 overflow-hidden">
      <div ref={contentRef} className="h-full flex flex-col gap-2">
        {/* Header - Compact */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition border border-slate-200 dark:border-slate-700"
            >
              <ArrowLeft className="text-slate-600 dark:text-slate-300" size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{student.name}</h1>
                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-medium rounded border border-orange-200 dark:border-orange-500/30">
                  {student.gender === 'M' ? '남' : '여'}
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                {student.school} • {student.grade}
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <FileDown size={14} />
            {pdfLoading ? '생성중...' : 'PDF'}
          </button>
        </div>

        {/* KPI Cards - Compact */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-medium">총점</span>
              <Target className="text-orange-500" size={14} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{selectedStats.totalScore}</span>
              <span className="text-slate-400 text-xs">/ {selectedStats.maxScore}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${selectedStats.percentage}%` }} />
              </div>
              <span className="text-orange-500 text-xs font-medium">{selectedStats.percentage}%</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-medium">등급</span>
              <Award className="text-blue-500" size={14} />
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getGradeColor(selectedStats.grade)} flex items-center justify-center`}>
                <span className="text-xl font-bold text-white">{selectedStats.grade}</span>
              </div>
              <div>
                <p className="text-slate-900 dark:text-white text-lg font-bold">{selectedStats.recordedCount}개</p>
                <p className="text-slate-500 dark:text-slate-400 text-[10px]">평가 완료</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-medium">추세</span>
              <Activity className="text-cyan-500" size={14} />
            </div>
            <div className="flex items-center gap-2">
              <TrendIcon trend={stats.overallTrend} className="w-8 h-8" />
              <div>
                <p className="text-slate-900 dark:text-white text-lg font-bold">
                  {stats.overallTrend === 'up' ? '상승' : stats.overallTrend === 'down' ? '하락' : '안정'}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[10px]">전체 추세</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-medium">기록</span>
              <Trophy className="text-purple-500" size={14} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.typesWithRecords}</span>
              <span className="text-slate-400 text-xs">종목</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">총 {recordHistory.length}회 측정</p>
          </div>
        </div>

        {/* Row 1 - Fixed height charts */}
        <div className="grid grid-cols-12 gap-1.5 h-[355px]">
          {/* Gauges - 3 columns */}
          <div className="col-span-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 mb-1">
              <PieChartIcon className="text-orange-500" size={12} />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">종목별 기록</h3>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {selectedGaugeTypes.slice(0, 6).map((typeId) => {
                const type = recordTypes.find(t => t.id === typeId);
                const latestRecord = stats.latests[typeId];
                const hasRecord = latestRecord !== undefined && latestRecord !== null;
                const value = latestRecord?.value || 0;
                const percentage = getRecordPercentage(typeId, value, hasRecord);
                const trend = stats.trends[typeId];

                const gaugeData = [
                  { value: percentage, color: getScoreColor(percentage) },
                  { value: 100 - percentage, color: '#e2e8f0' }
                ];

                return (
                  <div key={typeId} className="flex flex-col items-center">
                    <div className="relative bg-slate-50 dark:bg-slate-900 rounded w-full aspect-square">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={gaugeData} cx="50%" cy="50%" innerRadius="45%" outerRadius="80%" startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                            {gaugeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 1 ? (document.documentElement.classList.contains('dark') ? '#1e293b' : '#e2e8f0') : entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-slate-900 dark:text-white leading-none">{hasRecord ? value : '-'}</span>
                      </div>
                      <div className="absolute bottom-0.5 right-0.5">
                        <TrendIcon trend={trend || 'stable'} className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 truncate w-full text-center">{type?.short_name || type?.name}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-0.5 mt-1 max-h-[48px] overflow-y-auto">
              {recordTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => toggleGaugeType(type.id)}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-all duration-200 ${
                    selectedGaugeTypes.includes(type.id)
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                  } ${selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id) ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}`}
                  disabled={selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id)}
                >
                  {type.short_name || type.name}
                </button>
              ))}
            </div>
          </div>

          {/* Trend Chart - 5 columns */}
          <div className="col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <LineChartIcon className="text-blue-500" size={12} />
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">기록 추이</h3>
              </div>
              <select
                className="text-[11px] bg-slate-100 dark:bg-slate-700 border-0 rounded px-2 py-0.5 text-slate-700 dark:text-white"
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
                <LineChart data={trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" domain={trendYDomain as [number, number]} reversed={isTrendTypeLower} tickFormatter={(v) => Number(v).toFixed(1)} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', fontSize: '11px' }} formatter={(value) => { const type = recordTypes.find(t => t.id === selectedTrendType); return [`${value}${type?.unit || ''}`, '기록']; }} />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Chart - 4 columns */}
          <div className="col-span-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 mb-1">
              <BarChart3 className="text-cyan-500" size={12} />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">학원 비교</h3>
              <span className="text-[10px] text-slate-400 ml-auto">%</span>
            </div>

            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareBarData} layout="vertical" margin={{ top: 2, right: 5, left: -5, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <YAxis dataKey="name" type="category" width={45} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', fontSize: '10px' }} formatter={(value, name, props) => { const data = props.payload; if (name === '학원') return [`${data.academyRaw}${data.unit} (${value}%)`, name]; return [`${data.studentRaw}${data.unit} (${value}%)`, name]; }} />
                  <Bar dataKey="academy" fill="#94a3b8" radius={[0, 3, 3, 0]} name="학원" />
                  <Bar dataKey="student" fill="#f97316" radius={[0, 3, 3, 0]} name={student.name} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Row 2 - Fixed height */}
        <div className="grid grid-cols-12 gap-1.5 h-[315px]">
          {/* Radar Chart - 5 columns */}
          <div className="col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <RadarIcon className="text-purple-500" size={12} />
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">능력치</h3>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-slate-400 rounded-sm"></span><span className="text-slate-500">학원</span></span>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-orange-500 rounded-sm"></span><span className="text-slate-500">{student.name}</span></span>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} stroke="#e2e8f0" />
                  <Radar name="학원" dataKey="academy" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} strokeWidth={1.5} />
                  <Radar name={student.name} dataKey="student" stroke="#f97316" fill="#f97316" fillOpacity={0.3} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-0.5 max-h-[44px] overflow-y-auto">
              {recordTypes.slice(0, 8).map(type => (
                <button
                  key={type.id}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-all duration-200 ${
                    selectedRadarTypes.includes(type.id)
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-sm shadow-purple-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95'
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
          <div className="col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">최근 기록</h3>
              {recordHistory.length > 3 && (
                <button onClick={() => setShowAllRecords(!showAllRecords)} className="text-[10px] text-orange-500 font-medium">
                  {showAllRecords ? '접기' : `더보기 (${recordHistory.length})`}
                </button>
              )}
            </div>

            <div className={`overflow-auto flex-1`}>
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-white dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-1 px-1.5 text-slate-500 dark:text-slate-400 font-medium">날짜</th>
                    {recordTypes.slice(0, 6).map(type => (
                      <th key={type.id} className="text-center py-1 px-1.5 text-slate-500 dark:text-slate-400 font-medium">
                        {type.short_name || type.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((history, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-1 px-1.5 text-slate-700 dark:text-slate-300">
                        {new Date(history.measured_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                      </td>
                      {recordTypes.slice(0, 6).map(type => {
                        const record = history.records.find(r => r.record_type_id === type.id);
                        return (
                          <td key={type.id} className="text-center py-1 px-1.5">
                            {record ? (
                              <span className="font-medium text-slate-900 dark:text-white">{record.value}<span className="text-slate-400 text-[10px] ml-0.5">{type.unit}</span></span>
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
      </div>
    </div>
  );
}