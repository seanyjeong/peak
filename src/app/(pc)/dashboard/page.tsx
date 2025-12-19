'use client';

import { useState } from 'react';
import {
  Users,
  UserCheck,
  ClipboardCheck,
  Activity,
  Calendar,
  Bell,
  ChevronRight,
  TrendingUp,
  Clock
} from 'lucide-react';

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
          <span className="text-lg font-bold text-slate-700">{value}</span>
        </div>
      </div>
      <span className="text-xs text-slate-500 mt-2">{label}</span>
    </div>
  );
}

// Bar Chart Component
function WeeklyBarChart({ data }: { data: number[] }) {
  const maxValue = Math.max(...data);
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((value, index) => (
        <div key={index} className="flex flex-col items-center flex-1">
          <div
            className={`w-full rounded-t transition-all duration-300 ${
              index === todayIndex ? 'bg-orange-500' : 'bg-teal-400'
            }`}
            style={{ height: `${(value / maxValue) * 100}%`, minHeight: value > 0 ? '8px' : '0' }}
          />
          <span className={`text-xs mt-2 ${index === todayIndex ? 'text-orange-500 font-semibold' : 'text-slate-400'}`}>
            {days[index]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [today] = useState(new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }));

  // Mock data
  const stats = {
    trainersPresent: 3,
    totalTrainers: 4,
    studentsToday: 24,
    totalStudents: 32,
    recordsToday: 12,
  };

  const weeklyAttendance = [18, 22, 20, 24, 28, 15, 8];

  const scheduleToday = [
    { time: '14:00', title: '오후반 훈련', trainer: '김코치', students: 8, status: 'upcoming' },
    { time: '16:00', title: '고등부 집중반', trainer: '이트레이너', students: 12, status: 'upcoming' },
    { time: '18:00', title: '저녁 기초반', trainer: '박코치', students: 6, status: 'upcoming' },
  ];

  const notifications = [
    { id: 1, message: '박지민 학생 제멀 기록 갱신 (285cm)', time: '10분 전', type: 'record' },
    { id: 2, message: '김코치 출근 완료', time: '1시간 전', type: 'attendance' },
    { id: 3, message: '내일 기록측정 예정 (8명)', time: '2시간 전', type: 'schedule' },
  ];

  const trainers = [
    { name: '김코치', status: 'present', time: '09:00', students: 8 },
    { name: '이트레이너', status: 'present', time: '09:15', students: 10 },
    { name: '박코치', status: 'present', time: '09:30', students: 6 },
    { name: '최트레이너', status: 'absent', time: '-', students: 0 },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
          <p className="text-slate-500 mt-1">{today}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
          <Calendar size={18} />
          <span>오늘 배치 관리</span>
        </button>
      </div>

      {/* Stats Cards with Circular Progress */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-sm font-medium text-slate-500 mb-6">오늘 현황</h2>
        <div className="grid grid-cols-3 gap-8">
          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.trainersPresent}
              max={stats.totalTrainers}
              color="#f97316"
              label="출근 트레이너"
            />
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {stats.trainersPresent}<span className="text-slate-400 text-lg">/{stats.totalTrainers}</span>
              </p>
              <p className="text-sm text-slate-500">트레이너</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.studentsToday}
              max={stats.totalStudents}
              color="#14b8a6"
              label="훈련 학생"
            />
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {stats.studentsToday}<span className="text-slate-400 text-lg">/{stats.totalStudents}</span>
              </p>
              <p className="text-sm text-slate-500">오늘 훈련</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <CircularProgress
              value={stats.recordsToday}
              max={20}
              color="#8b5cf6"
              label="기록 측정"
            />
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.recordsToday}건</p>
              <p className="text-sm text-slate-500">오늘 측정</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Weekly Attendance Chart */}
        <div className="col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">주간 출석 현황</h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-teal-400"></div>
                <span className="text-slate-500">출석</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <span className="text-slate-500">오늘</span>
              </div>
            </div>
          </div>
          <WeeklyBarChart data={weeklyAttendance} />
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">알림</h2>
            <Bell size={18} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  notif.type === 'record' ? 'bg-purple-500' :
                  notif.type === 'attendance' ? 'bg-green-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">오늘 스케줄</h2>
            <button className="text-orange-500 text-sm font-medium flex items-center gap-1 hover:text-orange-600">
              전체 보기 <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {scheduleToday.map((schedule, index) => (
              <div key={index} className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl hover:border-orange-200 transition">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">{schedule.time}</p>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{schedule.title}</p>
                  <p className="text-sm text-slate-500">{schedule.trainer} · {schedule.students}명</p>
                </div>
                <div className="px-3 py-1 bg-teal-50 text-teal-600 text-xs font-medium rounded-full">
                  예정
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trainer Status */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">트레이너 현황</h2>
            <button className="text-orange-500 text-sm font-medium flex items-center gap-1 hover:text-orange-600">
              출근 관리 <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {trainers.map((trainer, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  trainer.status === 'present' ? 'bg-green-50' : 'bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                    trainer.status === 'present' ? 'bg-green-500' : 'bg-slate-300'
                  }`}>
                    {trainer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{trainer.name}</p>
                    <p className="text-xs text-slate-500">
                      {trainer.status === 'present' ? `${trainer.time} 출근` : '미출근'}
                    </p>
                  </div>
                </div>
                {trainer.status === 'present' && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{trainer.students}</p>
                    <p className="text-xs text-slate-500">배정 학생</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="mt-6 bg-gradient-to-r from-[#1a2b4a] to-[#243a5e] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">이번 주 하이라이트</h3>
            <p className="text-slate-300 text-sm">총 출석 135명 · 기록 갱신 8건 · 신규 학생 2명</p>
          </div>
          <div className="flex items-center gap-2 text-teal-400">
            <TrendingUp size={20} />
            <span className="font-medium">+12% vs 지난주</span>
          </div>
        </div>
      </div>
    </div>
  );
}
