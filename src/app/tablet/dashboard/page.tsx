'use client';

import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  Sunrise,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-react';
import { useOrientation } from '../layout';
import { useDashboard, getTodayFormatted } from '@/features/dashboard';

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
            className="dark:stroke-slate-700"
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
          <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">{value}</span>
        </div>
      </div>
      <span className="text-sm text-slate-500 dark:text-slate-400 mt-2">{label}</span>
    </div>
  );
}

const SLOT_ICONS = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
};

export default function TabletDashboardPage() {
  const router = useRouter();
  const orientation = useOrientation();
  const { loading, currentAttendance, getStats, getScheduleData } = useDashboard();

  const today = getTodayFormatted();
  const stats = getStats();
  const scheduleData = getScheduleData(SLOT_ICONS);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={40} className="animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">대시보드</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{today}</p>
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.trainersPresent}
              max={Math.max(stats.totalTrainers, 1)}
              color="#f97316"
              label="출근 강사"
              size={orientation === 'landscape' ? 100 : 120}
            />
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.trainersPresent}명</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">오늘 출근 강사</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.studentsToday}
              max={Math.max(stats.studentsToday, 1)}
              color="#14b8a6"
              label="수업 학생"
              size={orientation === 'landscape' ? 100 : 120}
            />
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.studentsToday}명</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">오늘 수업 학생</p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule & Trainers */}
      <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Today's Schedule */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">오늘 스케줄</h2>
            <button
              onClick={() => router.push('/tablet/assignments')}
              className="text-orange-500 text-sm font-medium flex items-center gap-1"
            >
              전체 <ChevronRight size={18} />
            </button>
          </div>
          {scheduleData.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
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
                    className="w-full flex items-center gap-4 p-4 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-orange-200 dark:hover:border-orange-500 transition text-left"
                  >
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <Icon size={28} className="text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-lg">{schedule.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{schedule.trainer} · {schedule.students}명</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400 dark:text-slate-500">{schedule.time}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Trainer Status - 현재 시간대 기준 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">강사 현황</h2>
              {currentAttendance && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentAttendance.currentSlotLabel} 기준
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/tablet/attendance')}
              className="text-orange-500 text-sm font-medium flex items-center gap-1"
            >
              출근 관리 <ChevronRight size={18} />
            </button>
          </div>
          {!currentAttendance || currentAttendance.instructors.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <p>현재 시간대에 배정된 강사가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 통계 배지 */}
              <div className="flex gap-2 mb-4">
                <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                  출근 {currentAttendance.stats.checkedIn}명
                </span>
                {currentAttendance.stats.notCheckedIn > 0 && (
                  <span className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-medium">
                    미출근 {currentAttendance.stats.notCheckedIn}명
                  </span>
                )}
              </div>
              {currentAttendance.instructors.map((instructor) => (
                <div
                  key={instructor.id}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    instructor.checkedIn
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      instructor.checkedIn ? 'bg-green-500' : 'bg-red-400'
                    }`}>
                      {instructor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-lg">{instructor.name}</p>
                      <p className={`text-sm ${instructor.checkedIn ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {instructor.checkedIn ? '출근 완료' : '미출근'}
                      </p>
                    </div>
                  </div>
                  {instructor.checkedIn && instructor.checkInTime && (
                    <div className="text-right">
                      <p className="text-lg font-medium text-slate-600 dark:text-slate-300">
                        {instructor.checkInTime.slice(0, 5)}
                      </p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">출근 시간</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Summary Banner */}
      <div className="mt-6 bg-gradient-to-r from-[#1a2b4a] to-[#243a5e] dark:from-slate-700 dark:to-slate-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">오늘 요약</h3>
            <p className="text-slate-300 dark:text-slate-200 text-sm">
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
