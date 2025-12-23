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
import { useOrientation } from '../layout';

// Circular Progress Component
function CircularProgress({
  value,
  max,
  color,
  label,
  size = 100
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  size?: number;
}) {
  const percentage = (value / max) * 100;
  const strokeWidth = 10;
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
          <span className="text-2xl font-bold text-slate-700">{value}</span>
        </div>
      </div>
      <span className="text-sm text-slate-500 mt-2">{label}</span>
    </div>
  );
}

interface Instructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain?: boolean;
}

interface ClassData {
  class_num: number;
  instructors: Instructor[];
  students: unknown[];
}

interface SlotData {
  waitingInstructors: Instructor[];
  waitingStudents: unknown[];
  classes: ClassData[];
}

interface SlotsData {
  morning: SlotData;
  afternoon: SlotData;
  evening: SlotData;
}

interface TimeSlots {
  morning: string;
  afternoon: string;
  evening: string;
}

const SLOT_ICONS = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
};

const SLOT_LABELS = {
  morning: '오전반',
  afternoon: '오후반',
  evening: '저녁반',
};

export default function TabletDashboardPage() {
  const router = useRouter();
  const orientation = useOrientation();
  const [loading, setLoading] = useState(true);
  const [slotsData, setSlotsData] = useState<SlotsData | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlots>({
    morning: '09:00-12:00',
    afternoon: '13:00-17:00',
    evening: '18:00-21:00'
  });

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateStr = getLocalDateString();
      const res = await apiClient.get(`/assignments?date=${dateStr}`);
      setSlotsData(res.data.slots);
      if (res.data.timeSlots) {
        setTimeSlots(res.data.timeSlots);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 통계 계산
  const getStats = () => {
    if (!slotsData) return { trainersPresent: 0, totalTrainers: 0, studentsToday: 0 };

    const allInstructors = new Set<number>();
    let totalStudents = 0;

    (['morning', 'afternoon', 'evening'] as const).forEach(slot => {
      const slotData = slotsData[slot];
      slotData.waitingInstructors?.forEach(i => allInstructors.add(i.id));
      slotData.classes?.forEach(cls => {
        cls.instructors?.forEach(i => allInstructors.add(i.id));
        totalStudents += cls.students?.length || 0;
      });
      totalStudents += slotData.waitingStudents?.length || 0;
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

    const slots: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];

    return slots.map(slotKey => {
      const data = slotsData[slotKey];
      const studentCount = (data.classes?.reduce((sum, cls) => sum + (cls.students?.length || 0), 0) || 0)
        + (data.waitingStudents?.length || 0);
      const allInstructors: string[] = [];
      data.classes?.forEach(cls => {
        cls.instructors?.forEach(i => {
          if (!allInstructors.includes(i.name)) {
            allInstructors.push(i.name);
          }
        });
      });
      const instructorNames = allInstructors.join(', ') || '미정';
      const timeStr = timeSlots[slotKey].replace('-', '~');

      return {
        slot: slotKey,
        label: SLOT_LABELS[slotKey],
        time: timeStr,
        icon: SLOT_ICONS[slotKey],
        trainer: instructorNames,
        students: studentCount,
      };
    }).filter(s => s.students > 0 || (slotsData[s.slot as keyof SlotsData].classes?.length || 0) > 0);
  };

  // 트레이너별 현황
  const getTrainerData = () => {
    if (!slotsData) return [];

    const trainerMap = new Map<number, { name: string; students: number }>();

    (['morning', 'afternoon', 'evening'] as const).forEach(slot => {
      const slotData = slotsData[slot];
      slotData.classes?.forEach(cls => {
        const studentCount = cls.students?.length || 0;
        cls.instructors?.forEach(inst => {
          if (!trainerMap.has(inst.id)) {
            trainerMap.set(inst.id, { name: inst.name, students: 0 });
          }
          if (inst.isMain) {
            const existing = trainerMap.get(inst.id);
            if (existing) {
              existing.students += studentCount;
            }
          }
        });
      });
    });

    return Array.from(trainerMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      students: data.students,
    }));
  };

  const scheduleData = getScheduleData();
  const trainerData = getTrainerData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={40} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">대시보드</h1>
          <p className="text-slate-500 text-sm mt-1">{today}</p>
        </div>
        <button
          onClick={() => router.push('/tablet/assignments')}
          className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition text-sm font-medium"
        >
          <Calendar size={20} />
          <span>반 배치</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className={`grid gap-4 mb-6 ${orientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.trainersPresent}
              max={Math.max(stats.totalTrainers, 1)}
              color="#f97316"
              label="출근 강사"
              size={orientation === 'landscape' ? 100 : 120}
            />
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.trainersPresent}명</p>
              <p className="text-sm text-slate-500 mt-1">오늘 출근 강사</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.studentsToday}
              max={Math.max(stats.studentsToday, 1)}
              color="#14b8a6"
              label="수업 학생"
              size={orientation === 'landscape' ? 100 : 120}
            />
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.studentsToday}명</p>
              <p className="text-sm text-slate-500 mt-1">오늘 수업 학생</p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule & Trainers */}
      <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Today's Schedule */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">오늘 스케줄</h2>
            <button
              onClick={() => router.push('/tablet/assignments')}
              className="text-orange-500 text-sm font-medium flex items-center gap-1"
            >
              전체 <ChevronRight size={18} />
            </button>
          </div>
          {scheduleData.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>오늘 스케줄이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduleData.map((schedule) => {
                const Icon = schedule.icon;
                return (
                  <button
                    key={schedule.slot}
                    onClick={() => router.push('/tablet/assignments')}
                    className="w-full flex items-center gap-4 p-4 border border-slate-100 rounded-xl hover:border-orange-200 transition text-left"
                  >
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Icon size={28} className="text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-lg">{schedule.label}</p>
                      <p className="text-sm text-slate-500">{schedule.trainer} · {schedule.students}명</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">{schedule.time}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Trainer Status */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">강사 현황</h2>
            <button
              onClick={() => router.push('/tablet/attendance')}
              className="text-orange-500 text-sm font-medium flex items-center gap-1"
            >
              출근 관리 <ChevronRight size={18} />
            </button>
          </div>
          {trainerData.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>오늘 출근한 강사가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trainerData.map((trainer) => (
                <div
                  key={trainer.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-green-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-green-500">
                      {trainer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-lg">{trainer.name}</p>
                      <p className="text-sm text-slate-500">출근</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">{trainer.students}</p>
                    <p className="text-sm text-slate-500">배정 학생</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Summary Banner */}
      <div className="mt-6 bg-gradient-to-r from-[#1a2b4a] to-[#243a5e] rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">오늘 요약</h3>
            <p className="text-slate-300 text-sm">
              강사 {stats.trainersPresent}명 출근 · 학생 {stats.studentsToday}명 수업 예정
            </p>
          </div>
          <button
            onClick={() => router.push('/tablet/records')}
            className="px-5 py-3 bg-orange-500 rounded-xl hover:bg-orange-600 transition font-medium"
          >
            기록 측정
          </button>
        </div>
      </div>
    </div>
  );
}
