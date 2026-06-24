'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Loader2, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <main className="max-w-[1440px] space-y-5 px-6 py-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/students" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-sm font-bold text-blue-700">STUDENT RECORDS</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">전체 기록 관리</h1>
            <p className="mt-1 text-sm text-slate-500">학생별 최신 실기 기록을 한 표에서 비교합니다.</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-bold text-slate-500">현재 표시</p>
          <p className="text-2xl font-black text-slate-950">{filteredRows.length}명</p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="전체" value={students.length} />
        <Metric label="재원" value={statusCounts.active || 0} />
        <Metric label="체험" value={statusCounts.trial || 0} />
        <Metric label="기록 종목" value={recordTypes.length} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_220px]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="학생 이름 또는 학교 검색"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-950 dark:border-slate-800 dark:bg-slate-900"
            />
          </label>
          <select
            value={gradeFilter}
            onChange={(event) => setGradeFilter(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-950 dark:border-slate-800 dark:bg-slate-900"
          >
            <option value="">학년 전체</option>
            {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            {([['', '전체'], ['M', '남'], ['F', '여']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGenderFilter(value)}
                className={`h-11 text-sm font-bold transition ${
                  genderFilter === value ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900'
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
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === filter.key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter.label} {statusCounts[filter.key] ?? 0}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="sticky left-0 z-20 w-12 bg-slate-50 px-3 py-3 text-left font-bold dark:bg-slate-900">#</th>
                <th className="sticky left-12 z-20 min-w-36 bg-slate-50 px-3 py-3 text-left font-bold dark:bg-slate-900">학생</th>
                <th className="sticky left-48 z-20 min-w-32 bg-slate-50 px-3 py-3 text-left font-bold dark:bg-slate-900">학교</th>
                <th className="min-w-20 px-3 py-3 text-left font-bold">학년</th>
                {recordTypes.map((type) => (
                  <th
                    key={type.id}
                    onClick={() => handleSort(type.id, type.direction)}
                    className="min-w-32 cursor-pointer px-3 py-3 text-center font-bold hover:text-slate-800"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {type.short_name || type.name}
                      {sort.recordTypeId === type.id
                        ? sort.order === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-blue-700" /> : <ArrowDown className="h-3.5 w-3.5 text-blue-700" />
                        : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-400">{type.unit}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map((student, index) => {
                const status = STATUS_MAP[student.status] || STATUS_MAP.active;
                const stickyBg = student.gender === 'M' ? 'bg-blue-50 dark:bg-blue-950/30' : student.gender === 'F' ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-white dark:bg-slate-950';
                return (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className={`sticky left-0 z-10 px-3 py-3 text-slate-400 ${stickyBg}`}>{index + 1}</td>
                    <td className={`sticky left-12 z-10 px-3 py-3 ${stickyBg}`}>
                      <div className="flex items-center gap-2">
                        <Link href={`/students/${student.id}`} className="truncate font-bold text-slate-950 hover:text-blue-700 dark:text-white">
                          {student.name}
                        </Link>
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${status.color}`}>{status.label}</span>
                      </div>
                    </td>
                    <td className={`sticky left-48 z-10 px-3 py-3 text-slate-600 dark:text-slate-300 ${stickyBg}`}>{student.school || '-'}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{student.grade || '-'}</td>
                    {recordTypes.map((type) => {
                      const value = recordMap.get(`${student.id}-${type.id}`);
                      return (
                        <td key={type.id} className="px-3 py-3 text-center font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {value !== undefined ? formatRecordValue(value, type.unit) : <span className="text-slate-300">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={4 + recordTypes.length} className="px-4 py-12 text-center text-sm font-semibold text-slate-400">
                    조건에 맞는 학생이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-bold">{label}</span>
        <Users className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
