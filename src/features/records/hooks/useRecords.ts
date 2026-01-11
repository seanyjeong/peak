'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import type {
  RecordType,
  Student,
  SlotData,
  ScoreTableData,
} from '@/components/records';

export interface CurrentUser {
  id: number;
  name: string;
  role?: string;
  position?: string | null;
  instructorId?: number;
}

export interface UseRecordsOptions {
  initialDate?: string;
  /**
   * 강사 본인의 반 학생만 표시할지 여부
   * PC: false (관리자는 전체 학생)
   * Tablet: true (본인 반 학생만)
   */
  ownClassOnly?: boolean;
}

export interface UseRecordsReturn {
  // 데이터
  recordTypes: RecordType[];
  slots: Record<string, SlotData>;
  availableSlots: string[];
  currentSlotData: SlotData | undefined;
  myStudents: Student[];
  scoreTablesCache: Record<number, ScoreTableData>;
  currentUser: CurrentUser | null;

  // 상태
  selectedSlot: string;
  selectedTrainerId: number | null;
  measuredAt: string;
  loading: boolean;
  isAdmin: boolean;

  // 액션
  setSelectedSlot: (slot: string) => void;
  setSelectedTrainerId: (id: number | null) => void;
  setMeasuredAt: (date: string) => void;
  fetchData: () => Promise<void>;

  // 점수 계산
  calculateScore: (value: number, gender: 'M' | 'F', recordTypeId: number) => number | null;
  getDecimalPlaces: (recordTypeId: number) => number;
}

export function useRecords(options: UseRecordsOptions = {}): UseRecordsReturn {
  const { initialDate, ownClassOnly = false } = options;

  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [measuredAt, setMeasuredAt] = useState(() => initialDate || new Date().toISOString().split('T')[0]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [scoreTablesCache, setScoreTablesCache] = useState<Record<number, ScoreTableData>>({});

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);
      const admin = user?.role === 'admin' || user?.role === 'owner';

      // 기록 종목 조회
      const typesRes = await apiClient.get('/record-types');
      const activeTypes = (typesRes.data.recordTypes || []).filter((t: RecordType) => t.is_active);
      setRecordTypes(activeTypes);

      // 반배치 조회
      const assignRes = await apiClient.get(`/assignments?date=${measuredAt}`);
      const slotsData = assignRes.data.slots || {};
      setSlots(slotsData);

      // 나의 반 찾기
      const myInstructorId = user?.instructorId;
      const myNegativeId = user?.role === 'owner' ? -(user?.id || 0) : null;
      const availableSlots: string[] = [];
      let mySlot: string | null = null;
      let myClassNumInSlot: number | null = null;

      ['morning', 'afternoon', 'evening'].forEach(slot => {
        const slotData = slotsData[slot] as SlotData;
        if (!slotData) return;
        const hasStudents = slotData.classes?.some(c => c.students?.length > 0) ||
          (slotData.waitingStudents?.length > 0);
        if (hasStudents) {
          availableSlots.push(slot);
          if (myInstructorId || myNegativeId) {
            const myClass = slotData.classes?.find(c =>
              c.instructors?.some(i => i.id === myInstructorId || i.id === myNegativeId)
            );
            if (myClass) {
              mySlot = slot;
              myClassNumInSlot = myClass.class_num;
            }
          }
        }
      });

      // 기존 선택이 유효하면 유지
      setSelectedSlot(prev => {
        if (prev && availableSlots.includes(prev)) return prev;
        if (!admin && mySlot) return mySlot;
        return availableSlots[0] || '';
      });
      setSelectedTrainerId(prev => {
        if (!admin && myClassNumInSlot) return myClassNumInSlot;
        return prev;
      });

      // 배점표 로드
      const scoreTablesData: Record<number, ScoreTableData> = {};
      for (const type of activeTypes) {
        try {
          const res = await apiClient.get(`/score-tables/by-type/${type.id}`);
          scoreTablesData[type.id] = res.data;
        } catch {
          scoreTablesData[type.id] = { scoreTable: null, ranges: [] };
        }
      }
      setScoreTablesCache(scoreTablesData);
    } catch (error) {
      console.error('Failed to fetch records data:', error);
    } finally {
      setLoading(false);
    }
  }, [measuredAt]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 사용 가능한 시간대
  const availableSlots = ['morning', 'afternoon', 'evening'].filter(slot => {
    const slotData = slots[slot] as SlotData;
    if (!slotData) return false;
    return slotData.classes?.some(c => c.students?.length > 0) ||
      slotData.waitingStudents?.length > 0;
  });

  const currentSlotData = slots[selectedSlot] as SlotData | undefined;

  // 나의 학생 목록 가져오기
  const getMyStudents = (): Student[] => {
    if (!currentSlotData) return [];

    const userInstructorId = currentUser?.instructorId;
    const userNegativeId = currentUser?.role === 'owner' ? -(currentUser?.id || 0) : null;

    // ownClassOnly가 false이고 관리자면 전체 학생 반환
    if (!ownClassOnly && isAdmin) {
      const allStudents: Student[] = [];
      currentSlotData.classes?.forEach(c => c.students && allStudents.push(...c.students));
      if (currentSlotData.waitingStudents) allStudents.push(...currentSlotData.waitingStudents);
      return allStudents;
    }

    // 강사 권한 또는 ownClassOnly: 본인 반 학생만
    if (!selectedTrainerId && !userInstructorId && !userNegativeId) return [];

    // 내 반 학생
    const myStudents: Student[] = [];
    currentSlotData.classes?.forEach(cls => {
      const isMyClass = cls.instructors?.some(inst =>
        inst.id === userInstructorId || inst.id === userNegativeId
      ) || cls.class_num === selectedTrainerId;
      if (isMyClass && cls.students) {
        myStudents.push(...cls.students);
      }
    });

    // 결석 학생 추가
    const absentStudents = currentSlotData.waitingStudents?.filter(
      s => s.attendance_status === 'absent'
    ) || [];
    absentStudents.forEach(s => {
      if (!myStudents.some(ms => ms.student_id === s.student_id)) {
        myStudents.push(s);
      }
    });

    return myStudents;
  };

  const myStudents = getMyStudents();

  // 점수 계산
  const calculateScore = useCallback((value: number, gender: 'M' | 'F', recordTypeId: number): number | null => {
    const tableData = scoreTablesCache[recordTypeId];
    if (!tableData?.scoreTable || tableData.ranges.length === 0) return null;
    for (const range of tableData.ranges) {
      const min = gender === 'M' ? range.male_min : range.female_min;
      const max = gender === 'M' ? range.male_max : range.female_max;
      if (value >= min && value <= max) return range.score;
    }
    return null;
  }, [scoreTablesCache]);

  const getDecimalPlaces = useCallback((recordTypeId: number): number => {
    return scoreTablesCache[recordTypeId]?.scoreTable?.decimal_places || 0;
  }, [scoreTablesCache]);

  return {
    // 데이터
    recordTypes,
    slots,
    availableSlots,
    currentSlotData,
    myStudents,
    scoreTablesCache,
    currentUser,

    // 상태
    selectedSlot,
    selectedTrainerId,
    measuredAt,
    loading,
    isAdmin,

    // 액션
    setSelectedSlot,
    setSelectedTrainerId,
    setMeasuredAt,
    fetchData,

    // 점수 계산
    calculateScore,
    getDecimalPlaces,
  };
}
