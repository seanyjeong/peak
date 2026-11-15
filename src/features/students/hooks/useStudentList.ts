'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { authAPI } from '@/lib/api/auth';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import type { Branch } from '@/components/BranchTabs';

export interface Student {
  id: number;
  paca_student_id: number;
  name: string;
  gender: 'M' | 'F' | null;
  phone: string | null;
  school: string | null;
  grade: string | null;
  class_days: number[] | null;
  is_trial: boolean;
  trial_total: number;
  trial_remaining: number;
  join_date: string | null;
  // P-ACA 지점·반 (지점을 쓰는 학원만 온다)
  branch_id?: number | null;
  branch_name?: string | null;
  class_name?: string | null;
  status: 'active' | 'inactive' | 'injury' | 'paused' | 'pending' | 'trial';
}

export const STATUS_MAP: Record<string, { label: string; color: string; darkColor: string }> = {
  active: {
    label: '재원',
    color: 'bg-success-soft text-success',
    darkColor: ''
  },
  inactive: {
    label: '퇴원',
    color: 'bg-muted text-secondary-foreground',
    darkColor: ''
  },
  injury: {
    label: '부상',
    color: 'bg-destructive-soft text-destructive',
    darkColor: ''
  },
  paused: {
    label: '휴원',
    color: 'bg-warning-soft text-warning',
    darkColor: ''
  },
  pending: {
    label: '미등록',
    color: 'bg-warning-soft text-warning',
    darkColor: ''
  },
  trial: {
    label: '체험',
    color: 'bg-purple-500/15 text-purple-600',
    darkColor: ''
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
  branches: Branch[];
  branchId: number | null;
  setBranchId: (branchId: number | null) => void;
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
  const toast = useToast();
  const toastRef = useRef(toast);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  // P-ACA 지점으로 거르기. null = 전체(지점이 없는 학원은 늘 null)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const students = useMemo(
    () => (branchId ? allStudents.filter(student => student.branch_id === branchId) : allStudents),
    [allStudents, branchId]
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // 상태별 인원수 계산
  const statusCounts = useMemo(() => ({
    all: students.length,
    active: students.filter(s => s.status === 'active').length,
    inactive: students.filter(s => s.status === 'inactive').length,
    injury: students.filter(s => s.status === 'injury').length,
    paused: students.filter(s => s.status === 'paused').length,
    pending: students.filter(s => s.status === 'pending').length,
    trial: students.filter(s => s.status === 'trial').length,
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
      setAllStudents(studentsRes.data.students || []);
      setBranches(studentsRes.data.branches || []);
    } catch {
      toastRef.current.error('학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // P-ACA 학생 동기화
  const syncStudents = async () => {
    const user = authAPI.getCurrentUser();
    if (!user?.academyId) {
      toastRef.current.error('학원 정보를 찾지 못했습니다. 다시 로그인해주세요.');
      return;
    }

    try {
      setSyncing(true);
      const response = await apiClient.post('/students/sync', { academyId: user.academyId });
      toastRef.current.success(response.data.message || '학생 정보를 동기화했습니다.');
      await fetchStudents();
    } catch {
      toastRef.current.error('학생 동기화에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
    branches,
    branchId,
    setBranchId,
    statusCounts,
    fetchStudents,
    syncStudents,
  };
}
