import { useState, useEffect } from 'react';
import apiClient from '@/lib/api/client';

// Types
export interface Instructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain?: boolean;
}

export interface CurrentInstructor {
  id: number;
  name: string;
  checkedIn: boolean;
  checkInTime: string | null;
}

export interface CurrentAttendance {
  currentSlot: string;
  currentSlotLabel: string;
  instructors: CurrentInstructor[];
  stats: {
    scheduled: number;
    checkedIn: number;
    notCheckedIn: number;
  };
}

export interface ClassData {
  class_num: number;
  instructors: Instructor[];
  students: unknown[];
}

export interface SlotData {
  waitingInstructors: Instructor[];
  waitingStudents: unknown[];
  classes: ClassData[];
}

export interface SlotsData {
  morning: SlotData;
  afternoon: SlotData;
  evening: SlotData;
}

export interface TimeSlots {
  morning: string;
  afternoon: string;
  evening: string;
}

export interface Stats {
  trainersPresent: number;
  totalTrainers: number;
  studentsToday: number;
}

export interface ScheduleItem {
  slot: 'morning' | 'afternoon' | 'evening';
  label: string;
  time: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trainer: string;
  students: number;
}

// Constants
export const SLOT_LABELS = {
  morning: '오전반',
  afternoon: '오후반',
  evening: '저녁반',
} as const;

// Helper functions
const getLocalDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const getTodayFormatted = () => {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
};

export function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [slotsData, setSlotsData] = useState<SlotsData | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<CurrentAttendance | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlots>({
    morning: '09:00-12:00',
    afternoon: '13:00-17:00',
    evening: '18:00-21:00'
  });

  // Fetch data
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

  useEffect(() => {
    fetchData();
  }, []);

  // 통계 계산
  const getStats = (): Stats => {
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

  // 시간대별 스케줄 (icon은 컴포넌트에서 주입)
  const getScheduleData = (slotIcons: Record<'morning' | 'afternoon' | 'evening', React.ComponentType<{ size?: number; className?: string }>>) => {
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
        icon: slotIcons[slotKey],
        trainer: instructorNames,
        students: studentCount,
      };
    }).filter(s => s.students > 0 || (slotsData[s.slot as keyof SlotsData].classes?.length || 0) > 0);
  };

  return {
    loading,
    slotsData,
    currentAttendance,
    timeSlots,
    fetchData,
    getStats,
    getScheduleData,
  };
}
