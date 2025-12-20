'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Save, Check, User, Smile, Meh, Frown, AlertCircle, ThumbsUp, Thermometer, Droplets } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI, User as AuthUser } from '@/lib/api/auth';

interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
  status: string;
}

interface SlotTrainer {
  trainer_id: number | null;
  trainer_name: string;
  students: Student[];
}

interface SlotData {
  instructors: { id: number; name: string }[];
  trainers: SlotTrainer[];
}

interface TrainingLog {
  student_id: number;
  condition_score: number | null;
  notes: string;
  saved?: boolean;
}

interface ExistingLog {
  id: number;
  student_id: number;
  condition_score: number | null;
  notes: string;
  temperature: number | null;
  humidity: number | null;
}

// 컨디션 점수 아이콘 및 색상
const CONDITION_OPTIONS = [
  { score: 1, icon: Frown, label: '매우 나쁨', color: 'text-red-500 bg-red-50 border-red-200 hover:bg-red-100' },
  { score: 2, icon: Frown, label: '나쁨', color: 'text-orange-500 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { score: 3, icon: Meh, label: '보통', color: 'text-yellow-500 bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
  { score: 4, icon: Smile, label: '좋음', color: 'text-green-500 bg-green-50 border-green-200 hover:bg-green-100' },
  { score: 5, icon: ThumbsUp, label: '최상', color: 'text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100' },
];

const SLOT_LABELS: Record<string, string> = {
  morning: '오전반',
  afternoon: '오후반',
  evening: '저녁반'
};

export default function TrainingPage() {
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<number, TrainingLog>>({});
  const [existingLogs, setExistingLogs] = useState<ExistingLog[]>([]);
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');
  const [conditionsSaved, setConditionsSaved] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateStr = getLocalDateString();

      const user = authAPI.getCurrentUser();
      setCurrentUser(user);

      const [assignmentsRes, trainingRes] = await Promise.all([
        apiClient.get(`/assignments?date=${dateStr}`),
        apiClient.get(`/training?date=${dateStr}`)
      ]);

      const slotsData = assignmentsRes.data.slots || {};
      const existingLogList = trainingRes.data.logs || [];

      setSlots(slotsData);
      setExistingLogs(existingLogList);

      // 현재 사용자의 instructor_id 찾기 (P-ACA instructorId)
      const myInstructorId = user?.instructorId;

      // 스케줄이 있는 시간대 찾기
      const availableSlots: string[] = [];
      let mySlot: string | null = null;
      let myTrainerIdInSlot: number | null = null;

      ['morning', 'afternoon', 'evening'].forEach(slot => {
        const slotData = slotsData[slot] as SlotData;
        if (!slotData) return;

        // 해당 시간대에 출근 스케줄이 있는 강사가 있는지
        const hasInstructors = slotData.instructors && slotData.instructors.length > 0;
        // 배정된 학생이 있는 trainer가 있는지
        const hasAssignments = slotData.trainers?.some(t => t.trainer_id && t.students.length > 0);

        if (hasInstructors || hasAssignments) {
          availableSlots.push(slot);

          // 현재 사용자가 이 시간대에 스케줄이 있는지 확인
          if (myInstructorId) {
            const mySchedule = slotData.instructors?.find(i => i.id === myInstructorId);
            if (mySchedule) {
              mySlot = slot;
              // trainers에서 내 trainer_id 찾기
              const myTrainer = slotData.trainers?.find(t => t.trainer_id === myInstructorId);
              if (myTrainer) {
                myTrainerIdInSlot = myTrainer.trainer_id;
              }
            }
          }
        }
      });

      // 시간대 자동 선택
      if (!isAdmin && mySlot) {
        // 강사: 자기 스케줄 시간대
        setSelectedSlot(mySlot);
        setSelectedTrainerId(myTrainerIdInSlot);
      } else if (availableSlots.length > 0) {
        // 관리자 또는 스케줄 없는 경우: 첫 번째 시간대
        setSelectedSlot(availableSlots[0]);
        setSelectedTrainerId(null);
      }

      // 기존 기록을 logs 상태로 변환
      const initialLogs: Record<number, TrainingLog> = {};
      existingLogList.forEach((log: ExistingLog) => {
        initialLogs[log.student_id] = {
          student_id: log.student_id,
          condition_score: log.condition_score,
          notes: log.notes || '',
          saved: true
        };
      });
      setLogs(initialLogs);

      // 기존 온습도 로드 (첫 번째 기록에서 가져옴)
      if (existingLogList.length > 0) {
        const firstLog = existingLogList[0];
        if (firstLog.temperature !== null) setTemperature(String(firstLog.temperature));
        if (firstLog.humidity !== null) setHumidity(String(firstLog.humidity));
        if (firstLog.temperature !== null || firstLog.humidity !== null) {
          setConditionsSaved(true);
        }
      }

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 스케줄이 있는 시간대 목록
  const availableSlots = ['morning', 'afternoon', 'evening'].filter(slot => {
    const slotData = slots[slot] as SlotData;
    if (!slotData) return false;
    const hasInstructors = slotData.instructors && slotData.instructors.length > 0;
    const hasAssignments = slotData.trainers?.some(t => t.trainer_id && t.students.length > 0);
    return hasInstructors || hasAssignments;
  });

  // 선택된 시간대의 강사 목록 (출근 스케줄 있는 강사만)
  const currentSlotData = slots[selectedSlot] as SlotData | undefined;
  const currentInstructors = currentSlotData?.instructors || [];
  const currentTrainers = currentSlotData?.trainers?.filter(t => t.trainer_id) || [];

  // 선택된 강사의 학생 목록
  const getMyStudents = () => {
    if (!selectedTrainerId) return [];
    const trainer = currentTrainers.find(t => t.trainer_id === selectedTrainerId);
    return trainer?.students || [];
  };

  const myStudents = getMyStudents();

  const updateLog = (studentId: number, field: 'condition_score' | 'notes', value: number | string | null) => {
    setLogs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        [field]: value,
        saved: false
      }
    }));
  };

  const saveLog = async (studentId: number) => {
    const log = logs[studentId];
    if (!log || !selectedTrainerId) return;

    try {
      setSaving(true);
      const dateStr = getLocalDateString();

      // 기존 기록 확인
      const existing = existingLogs.find(l => l.student_id === studentId);

      const temp = temperature ? parseFloat(temperature) : null;
      const hum = humidity ? parseInt(humidity) : null;

      if (existing) {
        // 수정
        await apiClient.put(`/training/${existing.id}`, {
          condition_score: log.condition_score,
          notes: log.notes,
          temperature: temp,
          humidity: hum
        });
      } else {
        // 새로 생성
        await apiClient.post('/training', {
          date: dateStr,
          student_id: studentId,
          trainer_id: selectedTrainerId,
          plan_id: null,
          condition_score: log.condition_score,
          notes: log.notes,
          temperature: temp,
          humidity: hum
        });
      }

      setLogs(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], saved: true }
      }));

      // 기존 기록 목록 업데이트
      await fetchData();
    } catch (error) {
      console.error('Failed to save log:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveAllLogs = async () => {
    const unsavedStudents = myStudents.filter(s => logs[s.student_id] && !logs[s.student_id].saved);

    for (const student of unsavedStudents) {
      await saveLog(student.student_id);
    }
  };

  // 온습도 일괄 저장
  const saveConditions = async () => {
    const dateStr = getLocalDateString();
    const temp = temperature ? parseFloat(temperature) : null;
    const hum = humidity ? parseInt(humidity) : null;

    try {
      setSaving(true);
      // 기존 기록들에 온습도 일괄 업데이트
      await apiClient.put(`/training/conditions/${dateStr}`, {
        temperature: temp,
        humidity: hum,
        trainer_id: selectedTrainerId
      });
      setConditionsSaved(true);
      await fetchData();
    } catch (error) {
      console.error('Failed to save conditions:', error);
      alert('온습도 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = myStudents.some(s => logs[s.student_id] && !logs[s.student_id].saved);
  const hasConditionsChanged = !conditionsSaved && (temperature || humidity);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">수업 기록</h1>
          <p className="text-slate-500 mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <button
              onClick={saveAllLogs}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
            >
              <Save size={18} />
              <span>모두 저장</span>
            </button>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">오늘 수업 스케줄이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">출근 체크 페이지에서 스케줄을 확인하세요.</p>
        </div>
      ) : (
        <>
          {/* 시간대 탭 */}
          <div className="flex gap-2 mb-4">
            {availableSlots.map(slot => (
              <button
                key={slot}
                onClick={() => {
                  setSelectedSlot(slot);
                  // 시간대 변경 시 강사 선택 초기화 (관리자만)
                  if (isAdmin) {
                    setSelectedTrainerId(null);
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedSlot === slot
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {SLOT_LABELS[slot]}
                {currentSlotData && slot === selectedSlot && (
                  <span className="ml-2 text-sm opacity-80">
                    ({currentInstructors.length}명)
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 강사 선택 (관리자용) */}
          {isAdmin && selectedSlot && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">강사 선택</label>
              <select
                value={selectedTrainerId || ''}
                onChange={e => setSelectedTrainerId(Number(e.target.value) || null)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">선택하세요</option>
                {currentTrainers.map(t => (
                  <option key={t.trainer_id} value={t.trainer_id!}>
                    {t.trainer_name} ({t.students.length}명)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Content */}
          {!selectedTrainerId ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">강사를 선택하세요.</p>
            </div>
          ) : myStudents.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Activity size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">배정된 학생이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 학생을 배정하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-orange-100 text-sm">내 반 학생</p>
                    <p className="text-3xl font-bold">{myStudents.length}명</p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-100 text-sm">기록 완료</p>
                    <p className="text-3xl font-bold">
                      {myStudents.filter(s => logs[s.student_id]?.saved).length}명
                    </p>
                  </div>
                </div>
                {/* 온습도 입력 */}
                <div className="bg-white/20 rounded-xl p-4">
                  <p className="text-orange-100 text-sm mb-2">체육관 환경 (전체 학생에 적용)</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Thermometer size={18} className="text-orange-200" />
                      <input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={e => { setTemperature(e.target.value); setConditionsSaved(false); }}
                        placeholder="온도"
                        className="flex-1 px-3 py-2 bg-white/90 text-slate-800 rounded-lg text-sm placeholder-slate-400 focus:ring-2 focus:ring-orange-300"
                      />
                      <span className="text-orange-100">°C</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Droplets size={18} className="text-orange-200" />
                      <input
                        type="number"
                        value={humidity}
                        onChange={e => { setHumidity(e.target.value); setConditionsSaved(false); }}
                        placeholder="습도"
                        className="flex-1 px-3 py-2 bg-white/90 text-slate-800 rounded-lg text-sm placeholder-slate-400 focus:ring-2 focus:ring-orange-300"
                      />
                      <span className="text-orange-100">%</span>
                    </div>
                    {hasConditionsChanged && (
                      <button
                        onClick={saveConditions}
                        disabled={saving}
                        className="px-4 py-2 bg-white text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50 transition disabled:opacity-50"
                      >
                        저장
                      </button>
                    )}
                    {conditionsSaved && (
                      <span className="flex items-center gap-1 text-orange-100 text-sm">
                        <Check size={14} />
                        저장됨
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Student List */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {myStudents.map(student => {
                    const log = logs[student.student_id] || { condition_score: null, notes: '', saved: false };
                    const isSaved = log.saved;

                    return (
                      <div key={student.id} className="p-4">
                        {/* Student Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                            }`}>
                              <User size={20} />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{student.student_name}</p>
                              <p className="text-xs text-slate-400">{student.gender === 'M' ? '남' : '여'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSaved && (
                              <span className="flex items-center gap-1 text-green-600 text-sm">
                                <Check size={14} />
                                저장됨
                              </span>
                            )}
                            {!isSaved && log.condition_score && (
                              <button
                                onClick={() => saveLog(student.student_id)}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                              >
                                <Save size={14} />
                                저장
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Condition Score */}
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-slate-500 mb-2">컨디션</label>
                          <div className="flex gap-2">
                            {CONDITION_OPTIONS.map(option => {
                              const Icon = option.icon;
                              const isSelected = log.condition_score === option.score;
                              return (
                                <button
                                  key={option.score}
                                  onClick={() => updateLog(student.student_id, 'condition_score', isSelected ? null : option.score)}
                                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition ${
                                    isSelected
                                      ? option.color.replace('hover:', '')
                                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                  }`}
                                >
                                  <Icon size={20} />
                                  <span className="text-xs">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-2">메모</label>
                          <input
                            type="text"
                            value={log.notes}
                            onChange={e => updateLog(student.student_id, 'notes', e.target.value)}
                            placeholder="오늘의 수업 특이사항..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
