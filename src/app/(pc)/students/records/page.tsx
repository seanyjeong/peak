'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { PageHeader, chipClass, decorTone, toolbarButtonClass } from '@/components/ui/page';
import apiClient from '@/lib/api/client';
import { Student, RecordType, STATUS_MAP } from '@/components/students/types';
import { formatRecordValue, getProfileErrorMessage } from '../[id]/student-profile-model';

interface LatestRecord {
  student_id: number;
  record_type_id: number;
  value: number;
  measured_at: string;
  student_name: string;
  gender: string;
  record_type_name: string;
  unit: string;
  direction: 'higher' | 'lower';
}

interface SortConfig {
  recordTypeId: number | null;
  order: 'asc' | 'desc';
}

const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '재원' },
  { key: 'pending', label: '미등록' },
  { key: 'trial', label: '체험' },
  { key: 'injury', label: '부상' },
  { key: 'paused', label: '휴원' },
  { key: 'inactive', label: '퇴원' },
];

export default function AllStudentRecordsPage() {
  const toast = useToast();
  const [genderFilter, setGenderFilter] = useState<'' | 'M' | 'F'>('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [latestRecords, setLatestRecords] = useState<LatestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<SortConfig>({ recordTypeId: null, order: 'asc' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [studentsRes, typesRes, recordsRes] = await Promise.all([
        apiClient.get('/students'),
        apiClient.get('/record-types?active=true'),
        apiClient.get('/records/latest'),
      ]);
      setStudents(studentsRes.data.students || []);
      setRecordTypes(typesRes.data.recordTypes || []);
      setLatestRecords(recordsRes.data.records || []);
    } catch (error) {
      toast.error(getProfileErrorMessage(error, '전체 기록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  const recordMap = useMemo(() => {
    const map = new Map<string, number>();
    latestRecords.forEach((record) => map.set(`${record.student_id}-${record.record_type_id}`, record.value));
    return map;
  }, [latestRecords]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((student) => {
      if (student.grade) set.add(student.grade);
    });
    return Array.from(set).sort();
  }, [students]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length };
    STATUS_FILTERS.forEach((filter) => {
      if (filter.key !== 'all') counts[filter.key] = students.filter((student) => student.status === filter.key).length;
    });
    return counts;
  }, [students]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const rows = students.filter((student) => {
      const matchesSearch = !keyword
        || student.name.toLowerCase().includes(keyword)
        || Boolean(student.school?.toLowerCase().includes(keyword));
      const matchesGrade = !gradeFilter || student.grade === gradeFilter;
      const matchesGender = !genderFilter || student.gender === genderFilter;
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
      return matchesSearch && matchesGrade && matchesGender && matchesStatus;
    });

    rows.sort((a, b) => {
      if (!sort.recordTypeId) return a.name.localeCompare(b.name, 'ko');
      const va = recordMap.get(`${a.id}-${sort.recordTypeId}`);
      const vb = recordMap.get(`${b.id}-${sort.recordTypeId}`);
      if (va === undefined && vb === undefined) return 0;
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      return sort.order === 'asc' ? va - vb : vb - va;
    });

    return rows;
  }, [genderFilter, gradeFilter, recordMap, searchTerm, sort, statusFilter, students]);

  function handleSort(recordTypeId: number, direction: 'higher' | 'lower') {
    if (sort.recordTypeId === recordTypeId) {
      setSort({ recordTypeId, order: sort.order === 'asc' ? 'desc' : 'asc' });
      return;
    }
    setSort({ recordTypeId, order: direction === 'higher' ? 'desc' : 'asc' });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex items-start gap-2">
        <Link href="/students" className={`${toolbarButtonClass()} mt-2.5 w-10 px-0`} aria-label="학생 관리로">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader className="min-w-0 flex-1" title="전체 기록 관리" description="학생별 최신 실기 기록을 한 표에서 비교합니다." />
      </div>

      <section className="rounded-2xl bg-card p-4 sm:p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_220px]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="학생 이름 또는 학교 검색"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-xl border border-transparent bg-muted pl-9 pr-3 text-[15px] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <select
            value={gradeFilter}
            onChange={(event) => setGradeFilter(event.target.value)}
            className="h-11 rounded-xl border border-transparent bg-muted px-3 text-sm font-semibold text-secondary-foreground outline-none focus:border-primary"
          >
            <option value="">학년 전체</option>
            {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {([['', '전체'], ['M', '남'], ['F', '여']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGenderFilter(value)}
                aria-pressed={genderFilter === value}
                className={`h-9 rounded-lg text-sm font-semibold transition ${
                  genderFilter === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              aria-pressed={statusFilter === filter.key}
              className={chipClass(statusFilter === filter.key, 'card')}
            >
              {filter.label} <span className="tabular-nums opacity-70">{statusCounts[filter.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-card">
        <div className="px-5 pb-1 pt-4 text-sm font-semibold text-muted-foreground sm:px-6">
          <span className="tabular-nums text-foreground">{filteredRows.length}명</span> 표시 · 기록 종목 {recordTypes.length}개
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border/60 text-[13px] text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-20 w-12 bg-card px-3 py-3 text-left font-semibold">#</th>
                <th className="sticky left-12 z-20 min-w-36 bg-card px-3 py-3 text-left font-semibold">학생</th>
                <th className="sticky left-48 z-20 min-w-32 bg-card px-3 py-3 text-left font-semibold">학교</th>
                <th className="min-w-20 px-3 py-3 text-left font-semibold">학년</th>
                {recordTypes.map((type) => (
                  <th
                    key={type.id}
                    onClick={() => handleSort(type.id, type.direction)}
                    className="min-w-32 cursor-pointer px-3 py-3 text-center font-semibold hover:text-foreground"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {type.short_name || type.name}
                      {sort.recordTypeId === type.id
                        ? sort.order === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                    </span>
                    <span className="block text-[11px] font-semibold text-muted-foreground">{type.unit}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRows.map((student, index) => {
                const status = STATUS_MAP[student.status] || STATUS_MAP.active;
                const stickyBg = 'bg-card';
                return (
                  <tr key={student.id} className="hover:bg-muted/60">
                    <td className={`sticky left-0 z-10 px-3 py-3.5 tabular-nums text-muted-foreground ${stickyBg}`}>{index + 1}</td>
                    <td className={`sticky left-12 z-10 px-3 py-3.5 ${stickyBg}`}>
                      <div className="flex items-center gap-2">
                        {student.gender === 'M' || student.gender === 'F' ? (
                          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${student.gender === 'M' ? 'bg-primary-soft text-primary' : decorTone.pink}`}>
                            {student.gender === 'M' ? '남' : '여'}
                          </span>
                        ) : (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">성별?</span>
                        )}
                        <Link href={`/students/${student.id}`} className="truncate font-bold text-foreground hover:text-primary">
                          {student.name}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.color}`}>{status.label}</span>
                      </div>
                    </td>
                    <td className={`sticky left-48 z-10 px-3 py-3.5 text-secondary-foreground ${stickyBg}`}>{student.school || '-'}</td>
                    <td className="px-3 py-3.5 text-secondary-foreground">{student.grade || '-'}</td>
                    {recordTypes.map((type) => {
                      const value = recordMap.get(`${student.id}-${type.id}`);
                      return (
                        <td key={type.id} className="px-3 py-3.5 text-center font-semibold tabular-nums text-foreground">
                          {value !== undefined ? formatRecordValue(value, type.unit) : <span className="text-muted-foreground/60">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={4 + recordTypes.length} className="px-4 py-12 text-center text-sm font-semibold text-muted-foreground">
                    조건에 맞는 학생이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
