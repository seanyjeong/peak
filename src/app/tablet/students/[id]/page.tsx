'use client';

import { useState, useEffect, useMemo, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronDown,
  FileDown
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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

export default function TabletStudentProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const orientation = useOrientation();
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

  // 더보기 상태
  const [showAllRecords, setShowAllRecords] = useState(false);
  // PDF 다운로드 로딩 상태
  const [pdfLoading, setPdfLoading] = useState(false);

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

      // Tailwind CSS v4 lab() 색상 호환성을 위해 원본 요소의 스타일을 미리 수집
      const originalElement = contentRef.current;
      const styleMap = new Map<Element, CSSStyleDeclaration>();

      // 원본 요소와 모든 자식 요소의 computed style 수집
      const collectStyles = (el: Element) => {
        styleMap.set(el, window.getComputedStyle(el));
        Array.from(el.children).forEach(collectStyles);
      };
      collectStyles(originalElement);

      // 현재 화면을 캔버스로 캡처
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f1f5f9',
        onclone: (clonedDoc, clonedElement) => {
          // 1. 모든 스타일시트 및 style 태그 제거
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());

          // 2. head의 모든 CSS 관련 요소 제거
          clonedDoc.head.innerHTML = '<meta charset="utf-8">';

          // 3. 원본과 클론 요소를 매핑하여 스타일 적용
          const applyStyles = (original: Element, cloned: Element) => {
            if (cloned instanceof HTMLElement) {
              const computed = styleMap.get(original);
              if (computed) {
                // 모든 CSS 속성을 인라인으로 적용
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

                // fill, stroke for SVG elements
                if (cloned.tagName === 'svg' || cloned.closest('svg')) {
                  ['fill', 'stroke'].forEach(prop => {
                    const value = computed.getPropertyValue(prop);
                    if (value) cloned.style.setProperty(prop, value);
                  });
                }
              }

              // 클래스 속성 제거 (CSS 규칙 참조 방지)
              cloned.removeAttribute('class');
            }

            // 자식 요소들 재귀 처리
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

      // 성별에 맞는 학원 평균 선택 (원시값 + 점수)
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
        ? <span className="text-[9px] text-gray-400 dark:text-slate-500">기록 부족</span>
        : <span className="text-[10px] text-gray-400 dark:text-slate-500">···</span>;
    }
    return <Minus className="text-gray-400 dark:text-slate-500" size={16} />;
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

  // 가로 모드 (태블릿 최적화 - 스크롤 없이 한 화면)
  if (orientation === 'landscape') {
    return (
      <div ref={contentRef} className="flex flex-col h-[calc(100vh-80px)] gap-2">
        {/* Header - 컴팩트 */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition">
              <ArrowLeft size={20} />
            </button>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              student.gender === 'M' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
            }`}>
              <User size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold dark:text-slate-100">{student.name}</h1>
              <p className="text-gray-500 dark:text-slate-400 text-xs">
                {student.gender === 'M' ? '남' : '여'} · {student.school} · {student.grade}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 종합평가 - 헤더에 통합 */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-200 dark:border-slate-700">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getGradeColor(selectedStats.grade)}`}>
                <span className="text-xl font-bold">{selectedStats.grade}</span>
              </div>
              <div className="text-sm">
                <div><span className="font-bold">{selectedStats.totalScore}</span><span className="text-slate-400">/{selectedStats.maxScore}점</span></div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <TrendIcon trend={stats.overallTrend} />
                  <span>{selectedStats.percentage}%</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1 text-sm"
            >
              <FileDown size={16} />
              {pdfLoading ? '...' : 'PDF'}
            </button>
            <button
              onClick={loadData}
              className="p-2 text-slate-600 dark:text-slate-300 bg-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Row 1 - 종목별기록, 기록추이, 학원비교 */}
        <div className="grid grid-cols-12 gap-2 h-[280px]">
          {/* 종목별 기록 - 6개 도넛 */}
          <div className="col-span-3 bg-white dark:bg-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-1 flex-shrink-0">종목별 기록</h3>
            <div className="grid grid-cols-3 gap-1 flex-1">
              {selectedGaugeTypes.slice(0, 6).map((typeId) => {
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
                  <div key={typeId} className="flex flex-col items-center">
                    <div className="relative w-full aspect-square">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={gaugeData} cx="50%" cy="50%" innerRadius="45%" outerRadius="80%" startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                            {gaugeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 1 ? (document.documentElement.classList.contains('dark') ? '#1e293b' : '#e5e7eb') : entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold dark:text-white">{hasRecord ? value : '-'}</span>
                      </div>
                      <div className="absolute bottom-0 right-0">
                        <TrendIcon trend={trend || 'need_more'} />
                      </div>
                    </div>
                    <span className="text-[9px] text-gray-500 dark:text-slate-400 truncate w-full text-center">{type?.short_name || type?.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1 mt-1 flex-shrink-0">
              {recordTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => toggleGaugeType(type.id)}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all duration-200 ${
                    selectedGaugeTypes.includes(type.id) 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 scale-105' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                  } ${selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id) ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}`}
                  disabled={selectedGaugeTypes.length >= 6 && !selectedGaugeTypes.includes(type.id)}
                >
                  {type.short_name || type.name}
                </button>
              ))}
            </div>
          </div>

          {/* 기록 추이 */}
          <div className="col-span-5 bg-white dark:bg-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-1 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">기록 추이</h3>
              <select
                className="text-xs bg-slate-100 dark:bg-slate-700 border-0 rounded px-2 py-1 dark:text-white"
                value={selectedTrendType || ''}
                onChange={(e) => setSelectedTrendType(parseInt(e.target.value))}
              >
                {recordTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" domain={trendYDomain as [number, number]} reversed={isTrendTypeLower} tickFormatter={(v) => Number(v).toFixed(1)} />
                  <Tooltip formatter={(value) => { const type = recordTypes.find(t => t.id === selectedTrendType); return [`${value}${type?.unit || ''}`, '기록']; }} />
                  <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 학원 비교 */}
          <div className="col-span-4 bg-white dark:bg-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 mb-1 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">학원 비교</h3>
              <span className="text-[10px] text-slate-400 ml-auto">%</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareBarData} layout="vertical" margin={{ top: 2, right: 5, left: -5, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <YAxis dataKey="name" type="category" width={45} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#cbd5e1" />
                  <Tooltip contentStyle={{ fontSize: '11px' }} formatter={(value, name, props) => { const data = props.payload; if (name === '학원') return [`${data.academyRaw}${data.unit} (${value}%)`, name]; return [`${data.studentRaw}${data.unit} (${value}%)`, name]; }} />
                  <Bar dataKey="academy" fill="#94a3b8" radius={[0, 3, 3, 0]} name="학원" />
                  <Bar dataKey="student" fill="#f97316" radius={[0, 3, 3, 0]} name={student.name} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Row 2 - 능력치, 최근 기록 */}
        <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
          {/* 능력치 레이더 */}
          <div className="col-span-5 bg-white dark:bg-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 mb-1">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">능력치</h3>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-slate-400 rounded-sm"></span><span className="text-slate-500">학원</span></span>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-orange-500 rounded-sm"></span><span className="text-slate-500">{student.name}</span></span>
              </div>
            </div>
            <div className="flex-1 min-h-[120px]">
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
            <div className="flex flex-wrap gap-1 flex-shrink-0 mt-1">
              {recordTypes.slice(0, 8).map(type => (
                <button
                  key={type.id}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all duration-200 ${
                    selectedRadarTypes.includes(type.id) 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/30 scale-105' 
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

          {/* 최근 기록 테이블 */}
          <div className="col-span-7 bg-white dark:bg-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-1 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">최근 기록</h3>
              {recordHistory.length > 4 && (
                <button onClick={() => setShowAllRecords(!showAllRecords)} className="text-[10px] text-orange-500 font-medium">
                  {showAllRecords ? '접기' : `더보기 (${recordHistory.length})`}
                </button>
              )}
            </div>
            <div className="overflow-auto flex-1">
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
                  {(showAllRecords ? recordHistory : recordHistory.slice(0, 4)).map((history, idx) => (
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
    );
  }

  // 세로 모드: 스크롤 가능
  return (
    <div ref={contentRef} className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-3 hover:bg-gray-100 rounded-xl transition">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              student.gender === 'M' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
            }`}>
              <User size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold dark:text-slate-100">{student.name}</h1>
              <p className="text-gray-500 dark:text-slate-400 text-sm">
                {student.gender === 'M' ? '남' : '여'} · {student.school} · {student.grade}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="px-3 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
          >
            <FileDown size={16} />
            {pdfLoading ? '...' : 'PDF'}
          </button>
          <button
            onClick={loadData}
            className="p-3 text-slate-600 dark:text-slate-300 bg-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* 2 Column: 게이지 + 종합평가 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Record Gauges */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">종목별 기록</h3>
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
                      {hasRecord ? value : '-'}<span className="text-[10px] font-normal text-gray-400 dark:text-slate-500">{type?.unit}</span>
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
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                }`}
                disabled={selectedGaugeTypes.length >= 4 && !selectedGaugeTypes.includes(type.id)}
              >
                {type.short_name || type.name}
              </button>
            ))}
          </div>
        </div>

        {/* Overall Grade */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 flex flex-col justify-center">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">종합평가</h3>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getGradeColor(selectedStats.grade)}`}>
              <span className="text-3xl font-bold">{selectedStats.grade}</span>
            </div>
            <div>
              <span className="text-2xl font-bold">{selectedStats.totalScore}<span className="text-sm font-normal">점</span></span>
              <span className="text-gray-400 dark:text-slate-500 text-sm"> / {selectedStats.maxScore}점</span>
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">기록 추이</h3>
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">학원평균 vs {student.name}</h3>
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">능력치 비교</h3>
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
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">최근 기록</h3>
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
                            <span className="text-gray-400 dark:text-slate-500 text-xs ml-0.5">{type.unit}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-slate-600">-</span>
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
