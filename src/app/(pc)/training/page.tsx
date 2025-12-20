'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Save, Check, User, Smile, Meh, Frown, AlertCircle, ThumbsUp } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI, User as AuthUser } from '@/lib/api/auth';

interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
  status: string;
}

interface Assignment {
  trainer_id: number | null;
  trainer_name: string;
  students: Student[];
}

interface Trainer {
  id: number;
  name: string;
  paca_user_id?: number;
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
}

// 컨디션 점수 아이콘 및 색상
const CONDITION_OPTIONS = [
  { score: 1, icon: Frown, label: '매우 나쁨', color: 'text-red-500 bg-red-50 border-red-200 hover:bg-red-100' },
  { score: 2, icon: Frown, label: '나쁨', color: 'text-orange-500 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { score: 3, icon: Meh, label: '보통', color: 'text-yellow-500 bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
  { score: 4, icon: Smile, label: '좋음', color: 'text-green-500 bg-green-50 border-green-200 hover:bg-green-100' },
  { score: 5, icon: ThumbsUp, label: '최상', color: 'text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100' },
];

export default function TrainingPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [myTrainerId, setMyTrainerId] = useState<number | null>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<number, TrainingLog>>({});
  const [existingLogs, setExistingLogs] = useState<ExistingLog[]>([]);

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

      const [assignmentsRes, trainersRes, trainingRes] = await Promise.all([
        apiClient.get(`/assignments?date=${dateStr}`),
        apiClient.get('/trainers'),
        apiClient.get(`/training?date=${dateStr}`)
      ]);

      const assignmentList = assignmentsRes.data.assignments || [];
      const trainerList = trainersRes.data.trainers || [];
      const existingLogList = trainingRes.data.logs || [];

      setAssignments(assignmentList);
      setTrainers(trainerList);
      setExistingLogs(existingLogList);

      // 현재 사용자의 trainer_id 찾기
      if (user) {
        const myTrainer = trainerList.find((t: Trainer) => t.paca_user_id === user.id);
        if (myTrainer) {
          setMyTrainerId(myTrainer.id);
          if (!isAdmin) {
            setSelectedTrainerId(myTrainer.id);
          }
        }
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

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 선택된 트레이너의 학생 목록
  const currentAssignment = assignments.find(a => a.trainer_id === selectedTrainerId);
  const myStudents = currentAssignment?.students || [];

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

      if (existing) {
        // 수정
        await apiClient.put(`/training/${existing.id}`, {
          condition_score: log.condition_score,
          notes: log.notes
        });
      } else {
        // 새로 생성
        await apiClient.post('/training', {
          date: dateStr,
          student_id: studentId,
          trainer_id: selectedTrainerId,
          plan_id: null,
          condition_score: log.condition_score,
          notes: log.notes
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

  const getConditionBadge = (score: number | null | undefined) => {
    if (!score) return null;
    const option = CONDITION_OPTIONS.find(o => o.score === score);
    if (!option) return null;
    const Icon = option.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${option.color.split(' ').slice(0, 3).join(' ')}`}>
        <Icon size={12} />
        {option.label}
      </span>
    );
  };

  const hasUnsavedChanges = myStudents.some(s => logs[s.student_id] && !logs[s.student_id].saved);

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

      {/* Trainer Select (관리자용) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">강사 선택</label>
          <select
            value={selectedTrainerId || ''}
            onChange={e => setSelectedTrainerId(Number(e.target.value) || null)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">선택하세요</option>
            {assignments.filter(a => a.trainer_id).map(a => (
              <option key={a.trainer_id} value={a.trainer_id!}>
                {a.trainer_name} ({a.students.length}명)
              </option>
            ))}
            {/* 배정이 없어도 trainers 목록에서 선택 가능 */}
            {trainers.filter(t => !assignments.some(a => a.trainer_id === t.id)).map(t => (
              <option key={t.id} value={t.id}>
                {t.name} (배정 없음)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : !selectedTrainerId ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">트레이너를 선택하세요.</p>
        </div>
      ) : myStudents.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <Activity size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">오늘 배정된 학생이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 학생을 배정하세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
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
    </div>
  );
}
