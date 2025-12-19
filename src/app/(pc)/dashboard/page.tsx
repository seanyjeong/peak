'use client';

import { useState, useEffect } from 'react';
import { Users, UserCheck, ClipboardCheck, Activity } from 'lucide-react';

export default function DashboardPage() {
  const [today] = useState(new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }));

  // TODO: 실제 API 연동
  const stats = [
    { label: '출근 트레이너', value: '3명', icon: UserCheck, color: 'bg-emerald-500' },
    { label: '오늘 훈련 학생', value: '24명', icon: Users, color: 'bg-blue-500' },
    { label: '훈련 계획', value: '6개', icon: ClipboardCheck, color: 'bg-purple-500' },
    { label: '기록 측정', value: '12건', icon: Activity, color: 'bg-orange-500' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">오늘의 훈련</h1>
        <p className="text-gray-600 mt-1">{today}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="text-white" size={24} />
              </div>
              <div>
                <p className="text-gray-600 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 출근 현황 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">출근 현황</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <span className="font-medium">김코치</span>
              <span className="text-emerald-600 text-sm">09:00 출근</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <span className="font-medium">이트레이너</span>
              <span className="text-emerald-600 text-sm">09:15 출근</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-400">박코치</span>
              <span className="text-gray-400 text-sm">미출근</span>
            </div>
          </div>
        </div>

        {/* 오늘의 훈련 계획 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">오늘의 훈련</h2>
          <div className="space-y-3">
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">하체파워</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">민첩성</span>
              </div>
              <p className="text-sm text-gray-600">김코치 - 제멀 집중 훈련</p>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">상체파워</span>
              </div>
              <p className="text-sm text-gray-600">이트레이너 - 메디신볼 훈련</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">P-EAK 시스템 안내</h3>
        <p className="text-emerald-100">
          반 배치 메뉴에서 학생들을 트레이너별로 드래그하여 배치하세요.
          훈련 기록은 각 학생의 컨디션과 메모를 남길 수 있습니다.
        </p>
      </div>
    </div>
  );
}
