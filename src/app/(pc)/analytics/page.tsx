'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Download, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface EventAverage {
  recordTypeId: number;
  recordTypeName: string;
  shortName: string;
  unit: string;
  direction: string;
  maleAvg: number | null;
  femaleAvg: number | null;
  totalAvg: number | null;
  maleCount: number;
  femaleCount: number;
}

interface RankStudent {
  rank: number;
  studentId: number;
  studentName: string;
  value: number;
  measuredAt: string;
}

interface Ranking {
  recordTypeId: number;
  recordTypeName: string;
  unit: string;
  direction: string;
  male: RankStudent[];
  female: RankStudent[];
}

interface TrendStudent {
  studentId: number;
  studentName: string;
  gender: string;
  slope: number;
  latestValue: number;
  recentValues: number[];
}

interface EventTrend {
  recordTypeId: number;
  recordTypeName: string;
  unit: string;
  direction: string;
  avgSlope: number;
  avgTrend: string;
  improving: TrendStudent[];
  maintaining: TrendStudent[];
  declining: TrendStudent[];
  analyzedCount: number;
}

interface AnalyticsData {
  summary: {
    totalRecords: number;
    totalStudents: number;
    academyName: string;
    reportDate: string;
    totalEvents: number;
    overallTrend: { improving: number; maintaining: number; declining: number };
  };
  eventAverages: EventAverage[];
  rankings: Ranking[];
  eventTrends: EventTrend[];
  insufficientData: { studentId: number; studentName: string; gender: string; events: { recordTypeName: string; recordCount: number }[] }[];
}

export default function AnalyticsReportPage() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({});
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const user = authAPI.getCurrentUser();
    if (!user || !['admin', 'owner'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    apiClient.get('/analytics/report')
      .then(res => {
        setData(res.data);
        if (res.data.eventAverages.length > 0) {
          setSelectedEvent(res.data.eventAverages[0].recordTypeId);
        }
      })
      .catch(err => {
        if (err.response?.data?.error === 'INSUFFICIENT_DATA') {
          setError(`기록이 부족합니다 (${err.response.data.currentCount}/200개)`);
        } else {
          setError('리포트를 불러올 수 없습니다.');
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const toggleAccordion = (id: number) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setPdfLoading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      let position = 0;
      while (position < pdfHeight) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -position, pdfWidth, pdfHeight);
        position += pageHeight;
      }
      pdf.save(`분석리포트_${data?.summary.reportDate || 'report'}.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-5">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-brand-orange text-white rounded-lg text-sm">
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, eventAverages, rankings, eventTrends, insufficientData } = data;
  const selectedRanking = rankings.find(r => r.recordTypeId === selectedEvent);
  const selectedTrend = eventTrends.find(t => t.recordTypeId === selectedEvent);

  const chartData = eventAverages.map(e => ({
    name: e.shortName || e.recordTypeName,
    '남자 평균': e.maleAvg,
    '여자 평균': e.femaleAvg,
  }));

  const trendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const trendLabel = (trend: string) => {
    if (trend === 'improving') return '↑ 향상';
    if (trend === 'declining') return '↓ 하락';
    return '→ 유지';
  };

  const trendColor = (trend: string) => {
    if (trend === 'improving') return 'text-green-500';
    if (trend === 'declining') return 'text-red-500';
    return 'text-slate-400';
  };

  const trendBg = (trend: string) => {
    if (trend === 'improving') return 'bg-green-50 dark:bg-green-900/20';
    if (trend === 'declining') return 'bg-red-50 dark:bg-red-900/20';
    return 'bg-slate-50 dark:bg-slate-800';
  };

  return (
    <div ref={reportRef} className="p-8 space-y-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            📊 {summary.academyName} 분석 리포트
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">
            생성일: {summary.reportDate}
          </p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={pdfLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {pdfLoading ? '생성 중...' : 'PDF 다운로드'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        <KPICard label="총 기록" value={summary.totalRecords.toLocaleString()} unit="건" />
        <KPICard label="분석 학생" value={String(summary.totalStudents)} unit="명" />
        <KPICard label="활성 종목" value={String(summary.totalEvents)} unit="개" />
        <KPICard
          label="상승 추세"
          value={String(summary.overallTrend.improving)}
          unit={`/ ${summary.overallTrend.improving + summary.overallTrend.maintaining + summary.overallTrend.declining}명`}
          valueColor="text-green-500"
        />
      </div>

      {/* Section 1: Event Averages */}
      <section className="space-y-4">
        <SectionTitle icon="📊" text="종목별 남/여 평균" />
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex justify-end gap-5 mb-4">
            <LegendDot color="bg-[#4666FF]" label="남자 평균" />
            <LegendDot color="bg-brand-orange" label="여자 평균" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="남자 평균" fill="#4666FF" radius={[4,4,0,0]} />
              <Bar dataKey="여자 평균" fill="#FE5A1D" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">종목</th>
                  <th className="text-center px-3 py-2 font-semibold text-slate-500">단위</th>
                  <th className="text-right px-3 py-2 font-semibold text-[#4666FF]">남자 평균</th>
                  <th className="text-right px-3 py-2 font-semibold text-brand-orange">여자 평균</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500">전체 평균</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-400">남(명)</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-400">여(명)</th>
                </tr>
              </thead>
              <tbody>
                {eventAverages.map(e => (
                  <tr key={e.recordTypeId} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{e.recordTypeName}</td>
                    <td className="text-center px-3 py-2 text-slate-400">{e.unit}</td>
                    <td className="text-right px-3 py-2 font-medium text-[#4666FF]">{e.maleAvg ?? '-'}</td>
                    <td className="text-right px-3 py-2 font-medium text-brand-orange">{e.femaleAvg ?? '-'}</td>
                    <td className="text-right px-3 py-2 text-slate-500">{e.totalAvg ?? '-'}</td>
                    <td className="text-right px-3 py-2 text-slate-400">{e.maleCount}</td>
                    <td className="text-right px-3 py-2 text-slate-400">{e.femaleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 2: Event Detail (Rankings + Trends) */}
      <section className="space-y-4">
        <SectionTitle icon="🏆" text="종목별 상세 (순위 + 트렌드)" />

        {/* Event Tabs */}
        <div className="flex flex-wrap gap-2">
          {eventAverages.map(e => (
            <button
              key={e.recordTypeId}
              onClick={() => { setSelectedEvent(e.recordTypeId); setOpenAccordions({}); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedEvent === e.recordTypeId
                  ? 'bg-brand-orange text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {e.shortName || e.recordTypeName}
            </button>
          ))}
        </div>

        {selectedEvent && selectedTrend && (
          <div className="space-y-4">
            {/* Event Summary Bar */}
            <div className="flex items-center gap-4 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              <span className="font-bold text-slate-800 dark:text-white">{selectedTrend.recordTypeName}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${trendBg(selectedTrend.avgTrend)} ${trendColor(selectedTrend.avgTrend)}`}>
                평균추세 {trendLabel(selectedTrend.avgTrend)}
              </span>
              <div className="flex items-center gap-3 ml-auto text-sm font-mono">
                <span className="text-green-500 font-semibold">↑{selectedTrend.improving.length}</span>
                <span className="text-slate-400">→{selectedTrend.maintaining.length}</span>
                <span className="text-red-500 font-semibold">↓{selectedTrend.declining.length}</span>
              </div>
            </div>

            {/* Rankings */}
            {selectedRanking && (
              <div className="grid grid-cols-2 gap-4">
                <RankingTable title="🏅 남자 Top 10" color="blue" data={selectedRanking.male} unit={selectedRanking.unit} />
                <RankingTable title="🏅 여자 Top 10" color="orange" data={selectedRanking.female} unit={selectedRanking.unit} />
              </div>
            )}

            {/* Trend Groups */}
            <div className="space-y-3">
              {/* Declining - always shown first */}
              {selectedTrend.declining.length > 0 && (
                <TrendGroup
                  type="declining"
                  students={selectedTrend.declining}
                  unit={selectedTrend.unit}
                  open={openAccordions[-1] !== false}
                  onToggle={() => setOpenAccordions(p => ({ ...p, [-1]: p[-1] === false ? true : false }))}
                />
              )}
              {selectedTrend.improving.length > 0 && (
                <TrendGroup
                  type="improving"
                  students={selectedTrend.improving}
                  unit={selectedTrend.unit}
                  open={!!openAccordions[-2]}
                  onToggle={() => setOpenAccordions(p => ({ ...p, [-2]: !p[-2] }))}
                />
              )}
              {selectedTrend.maintaining.length > 0 && (
                <TrendGroup
                  type="maintaining"
                  students={selectedTrend.maintaining}
                  unit={selectedTrend.unit}
                  open={!!openAccordions[-3]}
                  onToggle={() => setOpenAccordions(p => ({ ...p, [-3]: !p[-3] }))}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Insufficient Data */}
      {insufficientData.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon="ℹ️" text="데이터 부족 안내" muted />
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-5">
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
              ⚠️ 다음 학생은 종목별 기록 5개 미만으로 트렌드 분석에서 제외되었습니다.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {insufficientData.slice(0, 20).map(s => (
                <div key={s.studentId} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{s.studentName}</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-xs">{s.events.map(e => `${e.recordTypeName}(${e.recordCount}개)`).join(', ')}</span>
                </div>
              ))}
            </div>
            {insufficientData.length > 20 && (
              <p className="text-xs text-amber-600 mt-2">외 {insufficientData.length - 20}명 ...</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Sub Components ---

function KPICard({ label, value, unit, valueColor }: { label: string; value: string; unit: string; valueColor?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide font-mono">{label}</p>
      <div className="flex items-end gap-1 mt-2">
        <span className={`text-2xl font-bold ${valueColor || 'text-slate-900 dark:text-white'}`}>{value}</span>
        <span className="text-sm text-slate-400 mb-0.5">{unit}</span>
      </div>
    </div>
  );
}

function SectionTitle({ icon, text, muted }: { icon: string; text: string; muted?: boolean }) {
  return (
    <h2 className={`text-lg font-bold tracking-tight ${muted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
      {icon} {text}
    </h2>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{label}</span>
    </div>
  );
}

function RankingTable({ title, color, data, unit }: { title: string; color: string; data: RankStudent[]; unit: string }) {
  const headerBg = color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20';
  const titleColor = color === 'blue' ? 'text-[#4666FF]' : 'text-brand-orange';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className={`px-4 py-3 ${headerBg}`}>
        <span className={`font-semibold text-sm ${titleColor}`}>{title}</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {data.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-400">데이터 없음</p>
        ) : data.map(s => (
          <div key={s.studentId} className="flex items-center px-4 py-2 text-sm">
            <span className={`w-8 font-bold font-mono ${s.rank === 1 ? 'text-brand-orange' : 'text-slate-400'}`}>{s.rank}</span>
            <span className="flex-1 text-slate-800 dark:text-slate-200">{s.studentName}</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{s.value} {unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendGroup({ type, students, unit, open, onToggle }: {
  type: 'improving' | 'maintaining' | 'declining';
  students: TrendStudent[];
  unit: string;
  open: boolean;
  onToggle: () => void;
}) {
  const config = {
    declining: { emoji: '📉', label: '하락', borderColor: 'border-l-red-500', bg: 'bg-red-50/50 dark:bg-red-900/10', textColor: 'text-red-500', slopeColor: 'text-red-400' },
    improving: { emoji: '📈', label: '상승', borderColor: 'border-l-green-500', bg: 'bg-green-50/50 dark:bg-green-900/10', textColor: 'text-green-500', slopeColor: 'text-green-400' },
    maintaining: { emoji: '➡️', label: '유지', borderColor: 'border-l-slate-400', bg: 'bg-slate-50/50 dark:bg-slate-800', textColor: 'text-slate-500', slopeColor: 'text-slate-400' },
  }[type];

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden border-l-4 ${config.borderColor}`}>
      <button onClick={onToggle} className={`w-full flex items-center gap-3 px-5 py-3 ${config.bg}`}>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="text-sm">{config.emoji}</span>
        <span className={`font-semibold text-sm ${config.textColor}`}>{config.label}</span>
        <span className={`font-mono text-xs font-bold ${config.textColor}`}>{students.length}명</span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {type === 'declining' || type === 'improving' ? (
            students.map(s => (
              <div key={s.studentId} className="flex items-center px-5 py-2 text-sm">
                <span className="flex-1 text-slate-800 dark:text-slate-200">
                  {s.studentName} <span className="text-slate-400 text-xs">({s.gender === 'M' ? '남' : '여'})</span>
                </span>
                <span className={`font-mono text-xs ${config.slopeColor} w-24`}>기울기 {s.slope > 0 ? '+' : ''}{s.slope}</span>
                <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300 w-20 text-right">{s.latestValue}{unit}</span>
              </div>
            ))
          ) : (
            <div className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
              {students.map(s => s.studentName).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
