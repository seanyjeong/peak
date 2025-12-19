'use client';

import { useState, useEffect } from 'react';
import { UserCheck, Clock, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api/client';

interface Trainer {
  id: number;
  name: string;
  phone: string;
}

interface AttendanceRecord {
  id: number;
  trainer_id: number;
  trainer_name: string;
  check_in_time: string;
}

export default function AttendancePage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trainersRes, attendanceRes] = await Promise.all([
        apiClient.get('/trainers'),
        apiClient.get('/attendance')
      ]);
      setTrainers(trainersRes.data.trainers || []);
      setAttendance(attendanceRes.data.attendance || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckIn = async (trainerId: number) => {
    try {
      setCheckingIn(trainerId);
      await apiClient.post('/attendance/checkin', { trainer_id: trainerId });
      await fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '출근 체크에 실패했습니다.');
    } finally {
      setCheckingIn(null);
    }
  };

  const isCheckedIn = (trainerId: number) => {
    return attendance.some(a => a.trainer_id === trainerId);
  };

  const getCheckInTime = (trainerId: number) => {
    const record = attendance.find(a => a.trainer_id === trainerId);
    return record?.check_in_time?.slice(0, 5) || null;
  };

  const checkedInCount = attendance.length;
  const totalCount = trainers.length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">출근 체크</h1>
          <p className="text-slate-500 mt-1">{today}</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
            <UserCheck size={36} className="text-orange-500" />
          </div>
          <div>
            <p className="text-4xl font-bold text-slate-800">
              {checkedInCount}
              <span className="text-slate-400 text-2xl">/{totalCount}</span>
            </p>
            <p className="text-slate-500 mt-1">트레이너 출근</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-slate-500">출근률</p>
            <p className="text-2xl font-bold text-orange-500">
              {totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Trainer List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">트레이너 목록</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={32} className="animate-spin mx-auto mb-2" />
            <p>로딩 중...</p>
          </div>
        ) : trainers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p>등록된 트레이너가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {trainers.map((trainer) => {
              const checked = isCheckedIn(trainer.id);
              const checkInTime = getCheckInTime(trainer.id);

              return (
                <div
                  key={trainer.id}
                  className={`flex items-center justify-between p-5 transition ${
                    checked ? 'bg-green-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium ${
                        checked ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    >
                      {trainer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{trainer.name}</p>
                      <p className="text-sm text-slate-500">{trainer.phone}</p>
                    </div>
                  </div>

                  {checked ? (
                    <div className="flex items-center gap-3 text-green-600">
                      <Clock size={18} />
                      <span className="font-medium">{checkInTime} 출근</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                        출근완료
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(trainer.id)}
                      disabled={checkingIn === trainer.id}
                      className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkingIn === trainer.id ? '처리중...' : '출근 체크'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
