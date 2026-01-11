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


interface Instructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain?: boolean;
}

interface CurrentInstructor {
  id: number;
  name: string;
  checkedIn: boolean;
  checkInTime: string | null;
}

interface CurrentAttendance {
  currentSlot: string;
  currentSlotLabel: string;
  instructors: CurrentInstructor[];
  stats: {
    scheduled: number;
    checkedIn: number;
    notCheckedIn: number;
  };
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

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slotsData, setSlotsData] = useState<SlotsData | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<CurrentAttendance | null>(null);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const dateStr = getLocalDateString();

        // 반 배치 데이터와 현재 강사 출근 현황 동시 조회
        const [assignmentsRes, attendanceRes] = await Promise.all([
          apiClient.get(`/assignments?date=${dateStr}`),
          apiClient.get('/attendance/current')
        ]);

        setSlotsData(assignmentsRes.data.slots);
        if (assignmentsRes.data.timeSlots) {
          setTimeSlots(assignmentsRes.data.timeSlots);
        }

        if (attendanceRes.data.success) {
          setCurrentAttendance(attendanceRes.data);
        }
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
      const slotData = slotsData[slot];
      // 대기 중인 강사
      slotData.waitingInstructors?.forEach(i => allInstructors.add(i.id));
      // 반에 배치된 강사 + 학생 수
      slotData.classes?.forEach(cls => {
        cls.instructors?.forEach(i => allInstructors.add(i.id));
        totalStudents += cls.students?.length || 0;
      });
      // 대기 중인 학생도 카운트
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
      // 모든 반의 학생 수 합계
      const studentCount = (data.classes?.reduce((sum, cls) => sum + (cls.students?.length || 0), 0) || 0)
        + (data.waitingStudents?.length || 0);
      // 모든 반의 강사 이름 수집
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

  const scheduleData = getScheduleData();

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
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">대시보드</h1>
          <p className="text-slate-500 mt-2 text-sm">{today}</p>
        </div>
        <button
          onClick={() => router.push('/assignments')}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium"
        >
          <Calendar size={18} />
          <span>반 배치 관리</span>
        </button>
      </div>

      {/* Stats Cards with Circular Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 mb-8">
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-8">오늘 현황</h2>
        <div className="grid grid-cols-2 gap-12">
          <div className="flex items-center gap-8">
            <CircularProgress
              value={stats.trainersPresent}
              max={Math.max(stats.totalTrainers, 1)}
              color="#0a0a0a"
              label="출근 강사"
            />
            <div>
              <p className="text-3xl font-semibold text-slate-900 tracking-tight">
                {stats.trainersPresent}명
              </p>
              <p className="text-sm text-slate-500 mt-1">오늘 출근 강사</p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <CircularProgress
              value={stats.studentsToday}
              max={Math.max(stats.studentsToday, 1)}
              color="#525252"
              label="수업 학생"
            />
            <div>
              <p className="text-3xl font-semibold text-slate-900 tracking-tight">
                {stats.studentsToday}명
              </p>
              <p className="text-sm text-slate-500 mt-1">오늘 수업 학생</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Today's Schedule by Time Slot */}
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-slate-900">오늘 스케줄</h2>
            <button
              onClick={() => router.push('/assignments')}
              className="text-slate-600 text-sm font-medium flex items-center gap-1 hover:text-slate-900 transition"
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
            <div className="space-y-4">
              {scheduleData.map((schedule) => {
                const Icon = schedule.icon;
                return (
                  <div
                    key={schedule.slot}
                    onClick={() => router.push('/assignments')}
                    className="flex items-center gap-5 p-5 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Icon size={22} className="text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 mb-0.5">{schedule.label}</p>
                      <p className="text-sm text-slate-500">{schedule.trainer} · {schedule.students}명</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-medium">{schedule.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trainer Status - 현재 시간대 기준 */}
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">강사 현황</h2>
              {currentAttendance && (
                <p className="text-xs text-slate-500 mt-1">
                  {currentAttendance.currentSlotLabel} 기준
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/attendance')}
              className="text-slate-600 text-sm font-medium flex items-center gap-1 hover:text-slate-900 transition"
            >
              출근 관리 <ChevronRight size={16} />
            </button>
          </div>
          {!currentAttendance || currentAttendance.instructors.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>현재 시간대에 배정된 강사가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 통계 배지 */}
              <div className="flex gap-2 mb-6">
                <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                  출근 {currentAttendance.stats.checkedIn}명
                </span>
                {currentAttendance.stats.notCheckedIn > 0 && (
                  <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                    미출근 {currentAttendance.stats.notCheckedIn}명
                  </span>
                )}
              </div>
              {currentAttendance.instructors.map((instructor) => (
                <div
                  key={instructor.id}
                  className={`flex items-center justify-between p-5 rounded-lg border ${
                    instructor.checkedIn ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      instructor.checkedIn ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {instructor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 mb-0.5">{instructor.name}</p>
                      <p className={`text-xs ${instructor.checkedIn ? 'text-slate-500' : 'text-slate-400'}`}>
                        {instructor.checkedIn ? '출근 완료' : '미출근'}
                      </p>
                    </div>
                  </div>
                  {instructor.checkedIn && instructor.checkInTime && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {instructor.checkInTime.slice(0, 5)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">출근 시간</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Summary Banner */}
      <div className="mt-8 bg-slate-900 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold mb-2">오늘 요약</h3>
            <p className="text-slate-400 text-sm">
              강사 {stats.trainersPresent}명 출근 · 학생 {stats.studentsToday}명 수업 예정
            </p>
          </div>
          <button
            onClick={() => router.push('/assignments')}
            className="px-5 py-2.5 bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition text-sm font-medium"
          >
            반 배치 보기
          </button>
        </div>
      </div>
    </div>
  );
}
