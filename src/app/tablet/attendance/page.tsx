'use client';

import { useState, useEffect } from 'react';
import { UserCheck, Clock, RefreshCw, Sunrise, Sun, Moon } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useOrientation } from '../layout';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface Instructor {
  id: number;
  name: string;
  time_slot: TimeSlot;
  attendance_status: 'scheduled' | 'present' | 'absent' | 'late';
  check_in_time: string | null;
  check_out_time: string | null;
}

interface SlotsData {
  morning: Instructor[];
  afternoon: Instructor[];
  evening: Instructor[];
}

interface Stats {
  total: number;
  checkedIn: number;
  uniqueInstructors: number;
}

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: typeof Sun; color: string; bgColor: string }> = {
  morning: { label: '오전', icon: Sunrise, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  afternoon: { label: '오후', icon: Sun, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  evening: { label: '저녁', icon: Moon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

const STATUS_INFO: Record<string, { label: string; color: string; bgColor: string }> = {
  present: { label: '출근', color: 'text-green-700', bgColor: 'bg-green-100' },
  scheduled: { label: '예정', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  absent: { label: '결근', color: 'text-red-700', bgColor: 'bg-red-100' },
  late: { label: '지각', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
};

export default function TabletAttendancePage() {
  const orientation = useOrientation();
  const [slotsData, setSlotsData] = useState<SlotsData>({ morning: [], afternoon: [], evening: [] });
  const [stats, setStats] = useState<Stats>({ total: 0, checkedIn: 0, uniqueInstructors: 0 });
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const getLocalDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateStr = getLocalDateString();
      const res = await apiClient.get(`/attendance?date=${dateStr}`);

      setSlotsData(res.data.slots || { morning: [], afternoon: [], evening: [] });
      setStats(res.data.stats || { total: 0, checkedIn: 0, uniqueInstructors: 0 });

      const slots = res.data.slots;
      if (slots.evening?.length > 0) setActiveSlot('evening');
      else if (slots.afternoon?.length > 0) setActiveSlot('afternoon');
      else if (slots.morning?.length > 0) setActiveSlot('morning');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getSlotCount = (slot: TimeSlot) => slotsData[slot].length;
  const getSlotCheckedIn = (slot: TimeSlot) => slotsData[slot].filter(i => i.attendance_status === 'present').length;

  const currentInstructors = slotsData[activeSlot];

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">출근 체크</h1>
          <p className="text-slate-500 text-sm mt-1">{today}</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
            <UserCheck size={40} className="text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-slate-800">
              {stats.checkedIn}
              <span className="text-slate-400 text-2xl">/{stats.uniqueInstructors}</span>
            </p>
            <p className="text-slate-500 mt-1 text-lg">강사 출근</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">출근률</p>
            <p className="text-3xl font-bold text-orange-500">
              {stats.uniqueInstructors > 0 ? Math.round((stats.checkedIn / stats.uniqueInstructors) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Time Slot Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(Object.keys(TIME_SLOT_INFO) as TimeSlot[]).map((slot) => {
          const info = TIME_SLOT_INFO[slot];
          const Icon = info.icon;
          const count = getSlotCount(slot);
          const checkedIn = getSlotCheckedIn(slot);
          const isActive = activeSlot === slot;

          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition flex-shrink-0 ${
                isActive
                  ? `${info.bgColor} ${info.color} ring-2 ring-offset-2`
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{info.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-sm ${
                isActive ? 'bg-white/50' : 'bg-slate-100'
              }`}>
                {checkedIn}/{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Instructor List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-lg">
            {TIME_SLOT_INFO[activeSlot].label} 강사 ({currentInstructors.length}명)
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={40} className="animate-spin mx-auto mb-2" />
            <p className="text-lg">로딩 중...</p>
          </div>
        ) : currentInstructors.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-lg">{TIME_SLOT_INFO[activeSlot].label}에 스케줄된 강사가 없습니다.</p>
            <p className="text-sm mt-2">P-ACA에서 강사 스케줄을 등록하세요.</p>
          </div>
        ) : (
          <div className={`divide-y divide-slate-100 ${orientation === 'landscape' ? 'max-h-[400px] overflow-y-auto' : ''}`}>
            {currentInstructors.map((instructor) => {
              const status = STATUS_INFO[instructor.attendance_status] || STATUS_INFO.scheduled;
              const isPresent = instructor.attendance_status === 'present';

              return (
                <div
                  key={`${instructor.id}-${instructor.time_slot}`}
                  className={`flex items-center justify-between p-5 transition ${
                    isPresent ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-medium ${
                        isPresent ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    >
                      {instructor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-lg">{instructor.name}</p>
                      <p className="text-sm text-slate-500">
                        {TIME_SLOT_INFO[instructor.time_slot].label} 근무
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {instructor.check_in_time && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock size={18} />
                        <span className="text-base">{instructor.check_in_time.slice(0, 5)}</span>
                      </div>
                    )}
                    <span className={`px-4 py-2 text-base rounded-xl ${status.bgColor} ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="mt-4 bg-slate-100 rounded-xl p-4 text-sm text-slate-600">
        <p>출근 체크는 P-ACA에서 관리됩니다. 출근 상태 변경은 P-ACA에서 진행해주세요.</p>
      </div>
    </div>
  );
}
