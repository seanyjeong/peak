'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Users, Medal, ClipboardCheck, CalendarDays, CalendarRange } from 'lucide-react';
import apiClient from '@/lib/api/client';

type Period = 'week' | 'month';

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

interface DailyRate {
  date: string;
  rate: number;
  total: number;
  present: number;
}

interface RecordActivity {
  measured_at: string;
  student_count: number;
  record_count: number;
}

interface StatsData {
  period: string;
  startDate: string;
  endDate: string;
  attendance: AttendanceStats;
  dailyRates: DailyRate[];
  recentRecords: RecordActivity[];
  plans: { total: number; checked: number };
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/mobile/stats?period=${period}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const maxRate = data ? Math.max(...data.dailyRates.map(d => d.rate), 1) : 100;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">통계</h1>
        <button onClick={fetchStats} disabled={loading} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <RefreshCw size={16} className={loading ? 'animate-spin text-slate-400' : 'text-slate-500'} />
        </button>
      </div>

      {/* Period Toggle */}
      <div className="flex gap-1.5 mb-4 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {([
          { key: 'week' as Period, label: '이번 주', icon: CalendarDays },
          { key: 'month' as Period, label: '이번 달', icon: CalendarRange },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition ${
              period === key
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw size={28} className="animate-spin mx-auto mb-2" />
          <p>로딩 중...</p>
        </div>
      ) : !data ? (
        <div className="py-20 text-center text-slate-400">
          <p>데이터를 불러올 수 없습니다</p>
        </div>
      ) : (
        <>
          {/* Attendance Rate - Big Number */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-orange-500" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">출석률</h2>
            </div>
            <div className="flex items-end gap-4">
              <div className="text-5xl font-bold text-orange-500">
                {data.attendance.rate}<span className="text-2xl text-orange-400">%</span>
              </div>
              <div className="flex-1 grid grid-cols-4 gap-1 pb-1">
                {[
                  { label: '출석', count: data.attendance.present, color: 'text-green-600' },
                  { label: '결석', count: data.attendance.absent, color: 'text-red-500' },
                  { label: '지각', count: data.attendance.late, color: 'text-yellow-600' },
                  { label: '사유', count: data.attendance.excused, color: 'text-blue-500' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <p className={`text-lg font-bold ${item.color}`}>{item.count}</p>
                    <p className="text-[10px] text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Attendance Chart */}
          {data.dailyRates.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-slate-500" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">일별 출석률</h2>
              </div>
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {data.dailyRates.map((d, i) => {
                  const barHeight = maxRate > 0 ? (d.rate / 100) * 100 : 0;
                  const isToday = d.date === data.endDate;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-medium">{d.rate}%</span>
                      <div className="w-full flex items-end" style={{ height: 80 }}>
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            isToday ? 'bg-orange-500' : d.rate >= 80 ? 'bg-green-400' : d.rate >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ height: `${Math.max(barHeight * 0.8, 4)}px` }}
                        />
                      </div>
                      <span className={`text-[10px] ${isToday ? 'text-orange-600 font-bold' : 'text-slate-400'}`}>
                        {formatShortDate(d.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Record Activity */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <Medal size={16} className="text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">기록 측정 활동</h2>
            </div>
            {data.recentRecords.length === 0 ? (
              <p className="p-6 text-center text-slate-400 text-sm">기간 내 기록 측정이 없습니다</p>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {data.recentRecords.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDate(r.measured_at)}</p>
                      <p className="text-[11px] text-slate-400">{r.student_count}명 · {r.record_count}건</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-indigo-500">{r.record_count}</p>
                      <p className="text-[10px] text-slate-400">기록</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plan Completion */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck size={16} className="text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">수업 계획 진행률</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${data.plans.total > 0 ? (data.plans.checked / data.plans.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{data.plans.checked}</span>
                <span className="text-sm text-slate-400">/{data.plans.total}</span>
              </div>
            </div>
            {data.plans.total > 0 && (
              <p className="text-[11px] text-slate-400 mt-2">
                전체 {data.plans.total}개 계획 중 {data.plans.checked}개 환경체크 완료 ({Math.round((data.plans.checked / data.plans.total) * 100)}%)
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
