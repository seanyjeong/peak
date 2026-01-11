'use client';

import { useState, useEffect, useMemo } from 'react';
import { authAPI } from '@/lib/api/auth';
import apiClient from '@/lib/api/client';

export interface Student {
  id: number;
  paca_student_id: number;
  name: string;
  gender: 'M' | 'F';
  phone: string | null;
  school: string | null;
  grade: string | null;
  class_days: number[] | null;
  is_trial: boolean;
  trial_total: number;
  trial_remaining: number;
  join_date: string | null;
  status: 'active' | 'inactive' | 'injury' | 'paused' | 'pending';
}

export const STATUS_MAP: Record<string, { label: string; color: string; darkColor: string }> = {
  active: {
    label: '재원',
    color: 'bg-green-100 text-green-700',
    darkColor: 'dark:bg-green-900/20 dark:text-green-400'
  },
  inactive: {
    label: '퇴원',
    color: 'bg-slate-100 text-slate-600',
    darkColor: 'dark:bg-slate-800 dark:text-slate-400'
  },
  injury: {
    label: '부상',
    color: 'bg-red-100 text-red-700',
    darkColor: 'dark:bg-red-900/20 dark:text-red-400'
  },
  paused: {
    label: '휴원',
    color: 'bg-yellow-100 text-yellow-700',
    darkColor: 'dark:bg-yellow-900/20 dark:text-yellow-400'
  },
  pending: {
    label: '미등록',
    color: 'bg-amber-100 text-amber-700',
    darkColor: 'dark:bg-amber-900/20 dark:text-amber-400'
  },
};

interface UseStudentListReturn {
  students: Student[];
  loading: boolean;
  syncing: boolean;
  searchTerm: string;
  statusFilter: string;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  filteredStudents: Student[];
  statusCounts: {
    all: number;
    active: number;
    inactive: number;
    injury: number;
    paused: number;
    pending: number;
    trial: number;
  };
  fetchStudents: () => Promise<void>;
  syncStudents: () => Promise<void>;
}

export function useStudentList(): UseStudentListReturn {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 상태별 인원수 계산
  const statusCounts = useMemo(() => ({
    all: students.length,
    active: students.filter(s => s.status === 'active' && !s.is_trial).length,
    inactive: students.filter(s => s.status === 'inactive').length,
    injury: students.filter(s => s.status === 'injury').length,
    paused: students.filter(s => s.status === 'paused').length,
    pending: students.filter(s => s.status === 'pending').length,
    trial: students.filter(s => s.is_trial).length,
  }), [students]);

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesFilter = false;
      switch (statusFilter) {
        case 'all':
          matchesFilter = true;
          break;
        case 'trial':
          matchesFilter = student.is_trial;
          break;
        case 'active':
          matchesFilter = student.status === 'active' && !student.is_trial;
          break;
        default:
          matchesFilter = student.status === statusFilter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [students, searchTerm, statusFilter]);

  // 학생 목록 조회
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const studentsRes = await apiClient.get('/students');
      setStudents(studentsRes.data.students || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  // P-ACA 학생 동기화
  const syncStudents = async () => {
    const user = authAPI.getCurrentUser();
    if (!user?.academyId) {
      alert('학원 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      setSyncing(true);
      const response = await apiClient.post('/students/sync', { academyId: user.academyId });
      alert(response.data.message);
      await fetchStudents();
    } catch (error) {
      console.error('Sync error:', error);
      alert('동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  return {
    students,
    loading,
    syncing,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    filteredStudents,
    statusCounts,
    fetchStudents,
    syncStudents,
  };
}
