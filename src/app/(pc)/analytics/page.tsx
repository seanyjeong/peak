'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Download, Trophy, Users } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import { getMyFeaturePermissions } from '@/lib/api/permissions';
import type { AnalyticsData } from './analytics-model';
import {
  AnalyticsErrorState,
  AnalyticsSkeleton,
  EventAverageTable,
  EventSummaryBar,
  EventTabs,
  InsufficientDataPanel,
  KPICard,
  RankingTable,
  TrendGroup,
} from './analytics-ui';

const TREND_KEYS = ['declining', 'improving', 'maintaining'] as const;
const ACCORDION_DEFAULTS = { declining: true, improving: false, maintaining: false };

export default function AnalyticsReportPage() {
  const toast = useToast();
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(ACCORDION_DEFAULTS);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  useEffect(() => {
    async function loadReport() {
      const user = authAPI.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const permissions = await getMyFeaturePermissions(user);
      if (!permissions.analyticsReport) {
        setError('분석 리포트 권한이 없습니다. 원장에게 권한을 요청해주세요.');
        setLoading(false);
        return;
      }

      try {
        const res = await apiClient.get<AnalyticsData>('/analytics/report');
        setData(res.data);
        setSelectedEvent(res.data.eventAverages[0]?.recordTypeId ?? null);
      } catch (err: unknown) {
        const apiError = (err as { response?: { data?: { error?: string; currentCount?: number } } }).response?.data;
        if (apiError?.error === 'INSUFFICIENT_DATA') {
          setError(`기록이 더 쌓이면 리포트를 만들 수 있습니다. 현재 ${apiError.currentCount ?? 0}개 / 필요 200개`);
          return;
        }
        setError('분석 리포트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [router]);

  const selectedRanking = useMemo(
    () => data?.rankings.find((ranking) => ranking.recordTypeId === selectedEvent),
    [data?.rankings, selectedEvent],
  );

  const selectedTrend = useMemo(
    () => data?.eventTrends.find((trend) => trend.recordTypeId === selectedEvent),
    [data?.eventTrends, selectedEvent],
  );

  const handleEventSelect = (eventId: number) => {
    setSelectedEvent(eventId);
    setOpenAccordions(ACCORDION_DEFAULTS);
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        logging: false,
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
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
    } catch {
      toast.error('PDF 파일을 만들지 못했습니다. 다시 시도해주세요.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <AnalyticsSkeleton />;
  if (error) return <AnalyticsErrorState message={error} onBack={() => router.push('/dashboard')} />;
  if (!data) return null;

  const { eventAverages, insufficientData, summary } = data;
  const trendTotal = summary.overallTrend.improving + summary.overallTrend.maintaining + summary.overallTrend.declining;

  return (
    <div ref={reportRef} className="max-w-[1440px] space-y-6 px-6 py-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
            <BarChart3 className="h-4 w-4" />
            PERFORMANCE REPORT
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {summary.academyName} 분석 리포트
          </h1>
          <p className="mt-1 text-sm text-slate-500">생성일 {summary.reportDate} · 최근 기록 기준</p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={pdfLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
        >
          <Download className="h-4 w-4" />
          {pdfLoading ? '생성 중' : 'PDF 저장'}
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <KPICard icon={<BarChart3 className="h-4 w-4" />} label="총 기록" value={summary.totalRecords.toLocaleString()} unit="건" tone="blue" />
        <KPICard icon={<Users className="h-4 w-4" />} label="분석 학생" value={String(summary.totalStudents)} unit="명" />
        <KPICard icon={<Trophy className="h-4 w-4" />} label="활성 종목" value={String(summary.totalEvents)} unit="개" tone="orange" />
        <KPICard icon={<BarChart3 className="h-4 w-4" />} label="상승 추세" value={String(summary.overallTrend.improving)} unit={`/ ${trendTotal}명`} tone="green" />
      </section>

      <EventAverageTable events={eventAverages} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">종목별 상세</h2>
          <p className="mt-1 text-sm text-slate-500">순위는 최신 기록, 트렌드는 최근 5회 변화 기준입니다.</p>
        </div>
        <EventTabs events={eventAverages} selectedEvent={selectedEvent} onSelect={handleEventSelect} />

        {selectedTrend && (
          <div className="space-y-4">
            <EventSummaryBar trend={selectedTrend} />

            {selectedRanking && (
              <div className="grid gap-4 lg:grid-cols-2">
                <RankingTable data={selectedRanking.male} title="남자 Top 10" tone="blue" unit={selectedRanking.unit} />
                <RankingTable data={selectedRanking.female} title="여자 Top 10" tone="orange" unit={selectedRanking.unit} />
              </div>
            )}

            <div className="space-y-3">
              {TREND_KEYS.map((key) => (
                selectedTrend[key].length > 0 && (
                  <TrendGroup
                    key={key}
                    direction={selectedTrend.direction}
                    open={openAccordions[key]}
                    students={selectedTrend[key]}
                    type={key}
                    unit={selectedTrend.unit}
                    onToggle={() => setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                )
              ))}
            </div>
          </div>
        )}
      </section>

      <InsufficientDataPanel students={insufficientData} />
    </div>
  );
}
