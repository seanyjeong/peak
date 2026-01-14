'use client';

import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  Sunrise,
  Sun,
  Moon,
  RefreshCw,
  TrendingUp,
  Users,
  Activity
} from 'lucide-react';
import { useDashboard, getTodayFormatted } from '@/features/dashboard';
import { motion } from 'framer-motion';

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
    <motion.div 
      className="flex flex-col items-center"
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
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
          <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{value}</span>
        </div>
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 mt-2">{label}</span>
    </motion.div>
  );
}

const SLOT_ICONS = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
};

export default function DashboardPage() {
  const router = useRouter();
  const { loading, currentAttendance, getStats, getScheduleData } = useDashboard();

  const today = getTodayFormatted();
  const stats = getStats();
  const scheduleData = getScheduleData(SLOT_ICONS);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
        <RefreshCw size={32} className="animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  return (
    <motion.div 
      className="max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight bg-gradient-to-r from-brand-orange to-brand-blue bg-clip-text text-transparent">
            대시보드
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm uppercase tracking-wide">{today}</p>
        </motion.div>
        <motion.button
          onClick={() => router.push('/assignments')}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-orange to-orange-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Calendar size={18} />
          <span>반 배치 관리</span>
        </motion.button>
      </div>

      {/* Stats Cards - Bento Grid Style */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, staggerChildren: 0.1 }}
      >
        {/* Card 1: 출근 강사 */}
        <motion.div 
          className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-800 shadow-sm hover:shadow-lg transition-all"
          whileHover={{ y: -4, scale: 1.02 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                <Users size={24} className="text-brand-orange" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">출근 강사</span>
            </div>
            <div className="flex items-center gap-4">
              <CircularProgress
                value={stats.trainersPresent}
                max={Math.max(stats.totalTrainers, 1)}
                color="#FE5A1D"
                label=""
                size={70}
              />
              <div>
                <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {stats.trainersPresent}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">/ {stats.totalTrainers}명</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 2: 수업 학생 */}
        <motion.div 
          className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-lg transition-all"
          whileHover={{ y: -4, scale: 1.02 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                <Activity size={24} className="text-brand-blue" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">수업 학생</span>
            </div>
            <div className="flex items-center gap-4">
              <CircularProgress
                value={stats.studentsToday}
                max={Math.max(stats.studentsToday, 1)}
                color="#4666FF"
                label=""
                size={70}
              />
              <div>
                <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {stats.studentsToday}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">명 예정</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 3: 전체 학생 */}
        <motion.div 
          className="relative overflow-hidden bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-2xl p-6 border border-teal-200 dark:border-teal-800 shadow-sm hover:shadow-lg transition-all"
          whileHover={{ y: -4, scale: 1.02 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                <TrendingUp size={24} className="text-teal-600" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">전체 학생</span>
            </div>
            <div>
              <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-1">
                {stats.studentsToday}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">오늘 수업</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule by Time Slot */}
        <motion.div 
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition-all"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">오늘 스케줄</h2>
            <button
              onClick={() => router.push('/assignments')}
              className="text-slate-600 dark:text-slate-400 text-sm font-medium flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition"
            >
              전체 보기 <ChevronRight size={16} />
            </button>
          </div>
          {scheduleData.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
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
                    className="flex items-center gap-5 p-5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <Icon size={22} className="text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 mb-0.5">{schedule.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{schedule.trainer} · {schedule.students}명</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{schedule.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Trainer Status - 현재 시간대 기준 */}
        <motion.div 
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition-all"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">강사 현황</h2>
              {currentAttendance && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {currentAttendance.currentSlotLabel} 기준
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/attendance')}
              className="text-slate-600 dark:text-slate-400 text-sm font-medium flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition"
            >
              출근 관리 <ChevronRight size={16} />
            </button>
          </div>
          {!currentAttendance || currentAttendance.instructors.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <p>현재 시간대에 배정된 강사가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 통계 배지 */}
              <div className="flex gap-2 mb-6">
                <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium">
                  출근 {currentAttendance.stats.checkedIn}명
                </span>
                {currentAttendance.stats.notCheckedIn > 0 && (
                  <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium">
                    미출근 {currentAttendance.stats.notCheckedIn}명
                  </span>
                )}
              </div>
              {currentAttendance.instructors.map((instructor) => (
                <div
                  key={instructor.id}
                  className={`flex items-center justify-between p-5 rounded-lg border ${
                    instructor.checkedIn
                      ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      instructor.checkedIn
                        ? 'bg-slate-900 dark:bg-slate-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      {instructor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100 mb-0.5">{instructor.name}</p>
                      <p className={`text-xs ${instructor.checkedIn ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {instructor.checkedIn ? '출근 완료' : '미출근'}
                      </p>
                    </div>
                  </div>
                  {instructor.checkedIn && instructor.checkInTime && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {instructor.checkInTime.slice(0, 5)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">출근 시간</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Summary Banner */}
      <motion.div 
        className="mt-8 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-8 text-white shadow-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold mb-2">오늘 요약</h3>
            <p className="text-slate-400 dark:text-slate-300 text-sm">
              강사 {stats.trainersPresent}명 출근 · 학생 {stats.studentsToday}명 수업 예정
            </p>
          </div>
          <motion.button
            onClick={() => router.push('/assignments')}
            className="px-6 py-3 bg-white text-slate-900 rounded-xl hover:bg-slate-100 transition-all text-sm font-semibold shadow-lg"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            반 배치 보기
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
