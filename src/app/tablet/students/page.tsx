'use client';

import { useRef, useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, RefreshCw, Search, User, ChevronRight, Download } from 'lucide-react';
import { useOrientation } from '../layout';
import { useStudentList, STATUS_MAP } from '@/features/students';
import { groupByChosung, getSortedGroups, DISPLAY_CHOSUNG } from '@/lib/utils/korean';

export default function TabletStudentsPage() {
  const orientation = useOrientation();
  const {
    filteredStudents,
    loading,
    syncing,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    statusCounts,
    fetchStudents,
    syncStudents,
  } = useStudentList();

  // 초성 그룹핑
  const groupRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [activeChosung, setActiveChosung] = useState<string | undefined>(undefined);

  const sortedGroups = useMemo(() => {
    const groups = groupByChosung(filteredStudents, (s) => s.name);
    return getSortedGroups(groups);
  }, [filteredStudents]);

  const availableChosung = useMemo(() => {
    return new Set(sortedGroups.map(([chosung]) => chosung));
  }, [sortedGroups]);

  const handleChosungJump = (chosung: string) => {
    const element = groupRefs.current[chosung];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveChosung(chosung);
    }
  };

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">학생 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">총 {statusCounts.all}명</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncStudents}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition disabled:opacity-50"
          >
            <Download size={18} className={syncing ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">{syncing ? '동기화 중...' : '동기화'}</span>
          </button>
          <button
            onClick={fetchStudents}
            disabled={loading}
            className="p-3 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 mb-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="이름 검색..."
            className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              statusFilter === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            전체 {statusCounts.all}
          </button>
          {Object.entries(STATUS_MAP).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                statusFilter === key
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {value.label} {statusCounts[key as keyof typeof statusCounts] ?? 0}
            </button>
          ))}
          <button
            onClick={() => setStatusFilter('trial')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              statusFilter === 'trial'
                ? 'bg-purple-500 text-white'
                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30'
            }`}
          >
            체험생 {statusCounts.trial}
          </button>
        </div>
      </div>

      {/* Student List with Chosung Jump */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
          <RefreshCw size={40} className="animate-spin text-slate-400" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-12 text-center">
          <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-lg">학생이 없습니다.</p>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Student List with Groups */}
          <div className={`flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden ${
            orientation === 'landscape' ? 'max-h-[calc(100vh-320px)]' : 'max-h-[calc(100vh-380px)]'
          } overflow-y-auto`}>
            {sortedGroups.map(([chosung, students]) => (
              <div
                key={chosung}
                ref={(el) => { groupRefs.current[chosung] = el; }}
              >
                {/* Chosung Header */}
                <div className="sticky top-0 z-10 px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {chosung}
                  </span>
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    {students.length}명
                  </span>
                </div>
                {/* Students in Group */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {students.map(student => (
                    <Link
                      key={student.id}
                      href={`/tablet/students/${student.id}`}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          student.gender === 'M'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
                        }`}>
                          <User size={24} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100 text-lg">{student.name}</p>
                          <p className="text-sm text-slate-400">
                            {student.gender === 'M' ? '남' : '여'}
                            {student.school && ` · ${student.school}`}
                            {student.grade && ` ${student.grade}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!!student.is_trial && (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                            체험 {student.trial_total - student.trial_remaining}/{student.trial_total}
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${STATUS_MAP[student.status].color} ${STATUS_MAP[student.status].darkColor}`}>
                          {STATUS_MAP[student.status].label}
                        </span>
                        <ChevronRight size={20} className="text-slate-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Chosung Jump Navigation (Tablet - larger buttons) */}
          <div className="flex flex-col gap-1 sticky top-0 self-start">
            {DISPLAY_CHOSUNG.map((chosung) => {
              const isAvailable = availableChosung.has(chosung);
              const isActive = activeChosung === chosung;

              return (
                <button
                  key={chosung}
                  onClick={() => isAvailable && handleChosungJump(chosung)}
                  disabled={!isAvailable}
                  className={`
                    w-9 h-9 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-orange-500 text-white scale-110'
                      : isAvailable
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400 active:scale-95'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                    }
                  `}
                >
                  {chosung}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
