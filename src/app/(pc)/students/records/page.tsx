'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Search, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { Student, RecordType, STATUS_MAP } from '@/components/students/types';

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
  const [students, setStudents] = useState<Student[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [latestRecords, setLatestRecords] = useState<LatestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState<'' | 'M' | 'F'>('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<SortConfig>({ recordTypeId: null, order: 'asc' });

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
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  // 기록 Map: `studentId-typeId` → value
  const recordMap = useMemo(() => {
    const map = new Map<string, number>();
    latestRecords.forEach(r => {
      map.set(`${r.student_id}-${r.record_type_id}`, r.value);
    });
    return map;
  }, [latestRecords]);

  // 학년 목록 (동적 추출)
  const grades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.grade) set.add(s.grade); });
    return Array.from(set).sort();
  }, [students]);

  // 필터링 + 정렬
  const filteredRows = useMemo(() => {
    let rows = students.filter(s => {
      // 검색
      const matchesSearch = !searchTerm ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.school && s.school.toLowerCase().includes(searchTerm.toLowerCase()));

      // 학년
      const matchesGrade = !gradeFilter || s.grade === gradeFilter;

      // 성별
      const matchesGender = !genderFilter || s.gender === genderFilter;

      // 상태
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        matchesStatus = s.status === statusFilter;
      }

      return matchesSearch && matchesGrade && matchesGender && matchesStatus;
    });

    // 정렬
    rows.sort((a, b) => {
      if (!sort.recordTypeId) return a.name.localeCompare(b.name, 'ko');
      const va = recordMap.get(`${a.id}-${sort.recordTypeId}`) ?? null;
      const vb = recordMap.get(`${b.id}-${sort.recordTypeId}`) ?? null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sort.order === 'asc' ? va - vb : vb - va;
    });

    return rows;
  }, [students, searchTerm, gradeFilter, genderFilter, statusFilter, sort, recordMap]);

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length };
    STATUS_FILTERS.forEach(f => {
      if (f.key === 'all') return;
      counts[f.key] = students.filter(s => s.status === f.key).length;
    });
    return counts;
  }, [students]);

  function handleSort(recordTypeId: number, direction: 'higher' | 'lower') {
    if (sort.recordTypeId === recordTypeId) {
      setSort({ recordTypeId, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({
        recordTypeId,
        order: direction === 'higher' ? 'desc' : 'asc',
      });
    }
  }

  function getStatusDisplay(student: Student) {
    return STATUS_MAP[student.status] || STATUS_MAP.active;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/students" className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">전체 기록 관리</h1>
        <span className="text-sm text-gray-500">{filteredRows.length}명</span>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-col gap-3 mb-4">
        {/* 검색 + 학년 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름 또는 학교 검색"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-700"
            />
          </div>
          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-700"
          >
            <option value="">학년 전체</option>
            {grades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <div className="flex rounded-lg border dark:border-slate-700 overflow-hidden">
            {([['', '전체'], ['M', '남'], ['F', '여']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setGenderFilter(val as '' | 'M' | 'F')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  genderFilter === val
                    ? val === 'M' ? 'bg-blue-500 text-white'
                    : val === 'F' ? 'bg-pink-500 text-white'
                    : 'bg-orange-500 text-white'
                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'
              }`}
            >
              {f.label} {statusCounts[f.key] ?? 0}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-hidden dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b dark:border-slate-700">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-slate-900 px-3 py-3 text-left font-medium text-gray-500 w-10">#</th>
                <th
                  className="sticky left-10 z-20 bg-gray-50 dark:bg-slate-900 px-3 py-3 text-left font-medium text-gray-500 min-w-[120px] cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => setSort({ recordTypeId: null, order: 'asc' })}
                >
                  이름
                </th>
                <th className="sticky left-[168px] z-20 bg-gray-50 dark:bg-slate-900 px-3 py-3 text-left font-medium text-gray-500 min-w-[80px]">학교</th>
                <th className="sticky left-[248px] z-20 bg-gray-50 dark:bg-slate-900 px-3 py-3 text-left font-medium text-gray-500 min-w-[52px]">학년</th>
                {recordTypes.map(rt => (
                  <th
                    key={rt.id}
                    className="px-3 py-3 text-center font-medium text-gray-500 min-w-[100px] cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none"
                    onClick={() => handleSort(rt.id, rt.direction)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{rt.name}</span>
                      {sort.recordTypeId === rt.id ? (
                        sort.order === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-normal">({rt.unit})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {filteredRows.map((student, idx) => {
                const status = getStatusDisplay(student);
                const genderBg = student.gender === 'M'
                  ? 'bg-blue-50/60 dark:bg-blue-950/20'
                  : student.gender === 'F'
                  ? 'bg-pink-50/60 dark:bg-pink-950/20'
                  : 'bg-white dark:bg-slate-950';
                const stickyBg = student.gender === 'M'
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : student.gender === 'F'
                  ? 'bg-pink-50 dark:bg-pink-950/30'
                  : 'bg-white dark:bg-slate-950';
                return (
                  <tr key={student.id} className={`${genderBg} hover:brightness-95 dark:hover:brightness-110`}>
                    <td className={`sticky left-0 z-10 ${stickyBg} px-3 py-2.5 text-gray-400`}>{idx + 1}</td>
                    <td className={`sticky left-10 z-10 ${stickyBg} px-3 py-2.5`}>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/students?id=${student.id}`} className="font-medium hover:text-orange-500 truncate">
                          {student.name}
                        </Link>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </td>
                    <td className={`sticky left-[168px] z-10 ${stickyBg} px-3 py-2.5 text-gray-600 dark:text-gray-400 truncate`}>{student.school || '-'}</td>
                    <td className={`sticky left-[248px] z-10 ${stickyBg} px-3 py-2.5 text-gray-600 dark:text-gray-400`}>{student.grade || '-'}</td>
                    {recordTypes.map(rt => {
                      const val = recordMap.get(`${student.id}-${rt.id}`);
                      return (
                        <td key={rt.id} className="px-3 py-2.5 text-center">
                          {val !== undefined ? (
                            <span className="font-mono">{val}{rt.unit}</span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={4 + recordTypes.length} className="px-4 py-12 text-center text-gray-400">
                    조건에 맞는 학생이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 요약 */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        총 {filteredRows.length}명
        {statusFilter === 'all' && (
          <span>
            {' '}(재원 {statusCounts.active || 0} / 체험 {statusCounts.trial || 0} / 미등록 {statusCounts.pending || 0})
          </span>
        )}
      </div>
    </div>
  );
}
