'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  Sunrise,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-react';
import apiClient from '@/lib/api/client';

// Circular Progress Component (Donut Chart Style)
function CircularProgress({
  value,
  max,
  color,
  label,
  size = 80
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  size?: number;
}) {
  const percentage = (value / max) * 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-700">{value}</span>
        </div>
      </div>
      <span className="text-xs text-slate-500 mt-2">{label}</span>
    </div>
  );
}


interface SlotData {
  instructors: { id: number; name: string }[];
  trainers: { trainer_id: number | null; trainer_name: string; students: unknown[] }[];
}

interface SlotsData {
  morning: SlotData;
  afternoon: SlotData;
  evening: SlotData;
}

const TIME_SLOTS = [
  { key: 'morning', label: '오전반', icon: Sunrise, time: '09:00~12:00' },
  { key: 'afternoon', label: '오후반', icon: Sun, time: '13:00~17:00' },
  { key: 'evening', label: '저녁반', icon: Moon, time: '18:00~21:00' },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slotsData, setSlotsData] = useState<SlotsData | null>(null);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const getLocalDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const dateStr = getLocalDateString();
        const res = await apiClient.get(`/assignments?date=${dateStr}`);
        setSlotsData(res.data.slots);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 통계 계산
  const getStats = () => {
    if (!slotsData) return { trainersPresent: 0, totalTrainers: 0, studentsToday: 0 };

    const allInstructors = new Set<number>();
    let totalStudents = 0;

    (['morning', 'afternoon', 'evening'] as const).forEach(slot => {
      slotsData[slot].instructors.forEach(i => allInstructors.add(i.id));
      slotsData[slot].trainers.forEach(t => {
        totalStudents += t.students.length;
      });
    });

    return {
      trainersPresent: allInstructors.size,
      totalTrainers: allInstructors.size,
      studentsToday: totalStudents,
    };
  };

  const stats = getStats();

  // 시간대별 스케줄
  const getScheduleData = () => {
    if (!slotsData) return [];

    return TIME_SLOTS.map(slot => {
      const data = slotsData[slot.key];
      const studentCount = data.trainers.reduce((sum, t) => sum + t.students.length, 0);
      const instructorNames = data.instructors.map(i => i.name).join(', ') || '미정';

      return {
        slot: slot.key,
        label: slot.label,
        time: slot.time,
        icon: slot.icon,
        trainer: instructorNames,
        students: studentCount,
      };
    }).filter(s => s.students > 0 || slotsData[s.slot as keyof SlotsData].instructors.length > 0);
  };

  // 트레이너별 현황
  const getTrainerData = () => {
    if (!slotsData) return [];

    const trainerMap = new Map<number, { name: string; students: number }>();

    (['morning', 'afternoon', 'evening'] as const).forEach(slot => {
      slotsData[slot].instructors.forEach(inst => {
        if (!trainerMap.has(inst.id)) {
          trainerMap.set(inst.id, { name: inst.name, students: 0 });
        }
      });
      slotsData[slot].trainers.forEach(t => {
        if (t.trainer_id) {
          const existing = trainerMap.get(t.trainer_id);
          if (existing) {
            existing.students += t.students.length;
          }
        }
      });
    });

    return Array.from(trainerMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      status: 'present' as const,
      students: data.students,
    }));
  };

  const scheduleData = getScheduleData();
  const trainerData = getTrainerData();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
        <RefreshCw size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
          <p className="text-slate-500 mt-1">{today}</p>
        </div>
        <button
          onClick={() => router.push('/assignments')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          <Calendar size={18} />
          <span>반 배치 관리</span>
        </button>
      </div>

      {/* Stats Cards with Circular Progress */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-sm font-medium text-slate-500 mb-6">오늘 현황</h2>
        <div className="grid grid-cols-2 gap-8">
          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.trainersPresent}
              max={Math.max(stats.totalTrainers, 1)}
              color="#f97316"
              label="출근 코치"
            />
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {stats.trainersPresent}명
              </p>
              <p className="text-sm text-slate-500">오늘 출근 코치</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.studentsToday}
              max={Math.max(stats.studentsToday, 1)}
              color="#14b8a6"
              label="수업 학생"
            />
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {stats.studentsToday}명
              </p>
              <p className="text-sm text-slate-500">오늘 수업 학생</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Today's Schedule by Time Slot */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">오늘 스케줄</h2>
            <button
              onClick={() => router.push('/assignments')}
              className="text-orange-500 text-sm font-medium flex items-center gap-1 hover:text-orange-600"
            >
              전체 보기 <ChevronRight size={16} />
            </button>
          </div>
          {scheduleData.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>오늘 스케줄이 없습니다</p>
              <button
                onClick={() => router.push('/assignments')}
                className="mt-2 text-sm text-orange-500 hover:text-orange-600"
              >
                P-ACA 동기화하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduleData.map((schedule) => {
                const Icon = schedule.icon;
                return (
                  <div
                    key={schedule.slot}
                    onClick={() => router.push('/assignments')}
                    className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl hover:border-orange-200 transition cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Icon size={24} className="text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{schedule.label}</p>
                      <p className="text-sm text-slate-500">{schedule.trainer} · {schedule.students}명</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{schedule.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trainer Status */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">코치 현황</h2>
            <button
              onClick={() => router.push('/attendance')}
              className="text-orange-500 text-sm font-medium flex items-center gap-1 hover:text-orange-600"
            >
              출근 관리 <ChevronRight size={16} />
            </button>
          </div>
          {trainerData.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>오늘 출근한 코치가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trainerData.map((trainer) => (
                <div
                  key={trainer.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-green-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium bg-green-500">
                      {trainer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{trainer.name}</p>
                      <p className="text-xs text-slate-500">출근</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{trainer.students}</p>
                    <p className="text-xs text-slate-500">배정 학생</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Summary Banner */}
      <div className="mt-6 bg-gradient-to-r from-[#1a2b4a] to-[#243a5e] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">오늘 요약</h3>
            <p className="text-slate-300 text-sm">
              코치 {stats.trainersPresent}명 출근 · 학생 {stats.studentsToday}명 수업 예정
            </p>
          </div>
          <button
            onClick={() => router.push('/assignments')}
            className="px-4 py-2 bg-orange-500 rounded-lg hover:bg-orange-600 transition text-sm font-medium"
          >
            반 배치 보기
          </button>
        </div>
      </div>
    </div>
  );
}
