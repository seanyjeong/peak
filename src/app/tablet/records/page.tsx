'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calendar, Users, Trophy, ChevronDown, ChevronUp, Check, List, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import { useOrientation } from '../layout';

interface RecordType {
  id: number;
  name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
}

interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
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

interface ScoreRange {
  score: number;
  male_min: number;
  male_max: number;
  female_min: number;
  female_max: number;
}

interface ScoreTableData {
  scoreTable: { id: number; decimal_places: number } | null;
  ranges: ScoreRange[];
}

interface RecordInput {
  value: string;
  score: number | null;
}

type InputMode = 'student' | 'event';

const SLOT_LABELS: Record<string, string> = {
  morning: '오전반',
  afternoon: '오후반',
  evening: '저녁반'
};

export default function TabletRecordsPage() {
  const orientation = useOrientation();
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [measuredAt, setMeasuredAt] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; role?: string; instructorId?: number } | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('student');
  const [selectedRecordType, setSelectedRecordType] = useState<number | null>(null);
  const [scoreTablesCache, setScoreTablesCache] = useState<{ [key: number]: ScoreTableData }>({});
  const [inputs, setInputs] = useState<{ [key: number]: { [key: number]: RecordInput } }>({});
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  const [savedStudents, setSavedStudents] = useState<Set<number>>(new Set());

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const loadExistingRecords = useCallback(async (studentIds: number[], date: string) => {
    if (studentIds.length === 0) return;
    try {
      const res = await apiClient.get(`/records/by-date?date=${date}&student_ids=${studentIds.join(',')}`);
      const records = res.data.records || [];
      const newInputs: { [key: number]: { [key: number]: RecordInput } } = {};
      records.forEach((r: { student_id: number; record_type_id: number; value: number }) => {
        if (!newInputs[r.student_id]) newInputs[r.student_id] = {};
        newInputs[r.student_id][r.record_type_id] = { value: r.value.toString(), score: null };
      });
      setInputs(newInputs);
      setSavedStudents(new Set(Object.keys(newInputs).map(Number)));
    } catch (error) {
      console.error('Failed to load existing records:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);
      const admin = user?.role === 'admin' || user?.role === 'owner';

      const typesRes = await apiClient.get('/record-types');
      const activeTypes = (typesRes.data.recordTypes || []).filter((t: RecordType) => t.is_active);
      setRecordTypes(activeTypes);
      setSelectedRecordType(prev => {
        if (prev && activeTypes.some((t: RecordType) => t.id === prev)) return prev;
        return activeTypes.length > 0 ? activeTypes[0].id : null;
      });

      const assignRes = await apiClient.get(`/assignments?date=${measuredAt}`);
      const slotsData = assignRes.data.slots || {};
      setSlots(slotsData);

      const myInstructorId = user?.instructorId;
      const availableSlots: string[] = [];
      let mySlot: string | null = null;
      let myTrainerIdInSlot: number | null = null;

      ['morning', 'afternoon', 'evening'].forEach(slot => {
        const slotData = slotsData[slot] as SlotData;
        if (!slotData) return;
        const hasInstructors = slotData.instructors?.length > 0;
        const hasAssignments = slotData.trainers?.some(t => t.trainer_id && t.students.length > 0);
        if (hasInstructors || hasAssignments) {
          availableSlots.push(slot);
          if (myInstructorId) {
            const mySchedule = slotData.instructors?.find(i => i.id === myInstructorId);
            if (mySchedule) {
              mySlot = slot;
              const myTrainer = slotData.trainers?.find(t => t.trainer_id === myInstructorId);
              if (myTrainer) myTrainerIdInSlot = myTrainer.trainer_id;
            }
          }
        }
      });

      // 기존 선택이 유효하면 유지, 없으면 새로 설정
      setSelectedSlot(prev => {
        if (prev && availableSlots.includes(prev)) return prev;
        if (!admin && mySlot) return mySlot;
        return availableSlots[0] || '';
      });
      setSelectedTrainerId(prev => {
        if (!admin && myTrainerIdInSlot) return myTrainerIdInSlot;
        return prev;
      });

      const scoreTablesData: { [key: number]: ScoreTableData } = {};
      for (const type of activeTypes) {
        try {
          const res = await apiClient.get(`/score-tables/by-type/${type.id}`);
          scoreTablesData[type.id] = res.data;
        } catch { scoreTablesData[type.id] = { scoreTable: null, ranges: [] }; }
      }
      setScoreTablesCache(scoreTablesData);

      const allStudentIds: number[] = [];
      Object.values(slotsData).forEach((slotData) => {
        const sd = slotData as SlotData;
        sd.trainers?.forEach(t => t.students?.forEach(s => {
          if (!allStudentIds.includes(s.student_id)) allStudentIds.push(s.student_id);
        }));
      });
      if (allStudentIds.length > 0) await loadExistingRecords(allStudentIds, measuredAt);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [measuredAt, loadExistingRecords]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const availableSlots = ['morning', 'afternoon', 'evening'].filter(slot => {
    const slotData = slots[slot] as SlotData;
    if (!slotData) return false;
    return slotData.instructors?.length > 0 || slotData.trainers?.some(t => t.trainer_id && t.students.length > 0);
  });

  const currentSlotData = slots[selectedSlot] as SlotData | undefined;
  const currentTrainers = currentSlotData?.trainers?.filter(t => t.trainer_id) || [];

  const getMyStudents = (): Student[] => {
    if (!currentSlotData) return [];
    if (isAdmin) {
      const allStudents: Student[] = [];
      currentSlotData.trainers?.forEach(t => { if (t.students) allStudents.push(...t.students); });
      return allStudents;
    } else {
      if (!selectedTrainerId) return [];
      const trainer = currentTrainers.find(t => t.trainer_id === selectedTrainerId);
      return trainer?.students || [];
    }
  };

  const myStudents = getMyStudents();

  const calculateScore = (value: number, gender: 'M' | 'F', recordTypeId: number): number | null => {
    const tableData = scoreTablesCache[recordTypeId];
    if (!tableData?.scoreTable || tableData.ranges.length === 0) return null;
    for (const range of tableData.ranges) {
      const min = gender === 'M' ? range.male_min : range.female_min;
      const max = gender === 'M' ? range.male_max : range.female_max;
      if (value >= min && value <= max) return range.score;
    }
    return null;
  };

  const handleInputChange = (studentId: number, recordTypeId: number, value: string, gender: 'M' | 'F') => {
    const numValue = parseFloat(value);
    const score = !isNaN(numValue) ? calculateScore(numValue, gender, recordTypeId) : null;
    setInputs(prev => ({ ...prev, [studentId]: { ...prev[studentId], [recordTypeId]: { value, score } } }));
    setSavedStudents(prev => { const newSet = new Set(prev); newSet.delete(studentId); return newSet; });
  };

  const handleInputBlur = async (studentId: number, recordTypeId: number) => {
    const inputData = inputs[studentId]?.[recordTypeId];
    if (!inputData?.value?.trim() || saving) return;
    try {
      setSaving(true);
      await apiClient.post('/records/batch', {
        student_id: studentId,
        measured_at: measuredAt,
        records: [{ record_type_id: recordTypeId, value: parseFloat(inputData.value), notes: null }]
      });
      setSavedStudents(prev => new Set([...prev, studentId]));
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleStudent = (studentId: number) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) newSet.delete(studentId); else newSet.add(studentId);
      return newSet;
    });
  };

  const getDecimalPlaces = (recordTypeId: number): number => scoreTablesCache[recordTypeId]?.scoreTable?.decimal_places || 0;
  const getInputCount = (studentId: number): number => Object.values(inputs[studentId] || {}).filter(d => d.value?.trim()).length;
  const getTotalScore = (studentId: number): number | null => {
    const scores = Object.values(inputs[studentId] || {}).filter(d => d.score !== null).map(d => d.score as number);
    return scores.length === 0 ? null : scores.reduce((sum, s) => sum + s, 0);
  };

  const currentRecordType = recordTypes.find(t => t.id === selectedRecordType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={40} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">기록 측정</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              value={measuredAt}
              onChange={e => setMeasuredAt(e.target.value)}
              className="border-none focus:ring-0 text-slate-700 text-sm bg-transparent"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 text-slate-600 bg-white border border-slate-200 rounded-xl"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {availableSlots.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">오늘 수업 스케줄이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 시간대 탭 */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {availableSlots.map(slot => (
              <button
                key={slot}
                onClick={() => { setSelectedSlot(slot); if (isAdmin) setSelectedTrainerId(null); }}
                className={`px-5 py-3 rounded-xl font-medium transition whitespace-nowrap ${
                  selectedSlot === slot ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>

          {!isAdmin && !selectedTrainerId ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">해당 시간대에 배정된 수업이 없습니다.</p>
            </div>
          ) : myStudents.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
              <p className="text-slate-600 font-medium">배정된 학생이 없습니다</p>
            </div>
          ) : (
            <>
              {/* 입력 모드 선택 */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <div className={`flex ${orientation === 'portrait' ? 'flex-col gap-3' : 'items-center justify-between'}`}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInputMode('student')}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
                        inputMode === 'student' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Users size={20} />
                      학생별
                    </button>
                    <button
                      onClick={() => setInputMode('event')}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
                        inputMode === 'event' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <List size={20} />
                      종목별
                    </button>
                  </div>

                  {inputMode === 'event' && (
                    <div className="flex gap-2 overflow-x-auto">
                      {recordTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => setSelectedRecordType(type.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                            selectedRecordType === type.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {type.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 학생 수 */}
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Users size={16} />
                <span>{isAdmin ? '수업 참여 학생 수' : '내 반'}: {myStudents.length}명</span>
                {saving && <RefreshCw size={14} className="animate-spin text-orange-500" />}
              </div>

              {inputMode === 'student' ? (
                /* 학생별 입력 모드 */
                <div className="space-y-3">
                  {myStudents.map(student => {
                    const isExpanded = expandedStudents.has(student.student_id);
                    const inputCount = getInputCount(student.student_id);
                    const totalScore = getTotalScore(student.student_id);
                    const isSaved = savedStudents.has(student.student_id);

                    return (
                      <div
                        key={student.student_id}
                        className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isSaved ? 'ring-2 ring-green-400' : ''}`}
                      >
                        <button
                          className="w-full p-4 flex items-center justify-between text-left"
                          onClick={() => toggleStudent(student.student_id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${
                              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                            }`}>
                              {student.student_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800 text-lg">{student.student_name}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                                }`}>
                                  {student.gender === 'M' ? '남' : '여'}
                                </span>
                                {isSaved && (
                                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                    <Check size={12} /> 저장됨
                                  </span>
                                )}
                              </div>
                              {inputCount > 0 && (
                                <div className="text-sm text-slate-500 mt-1">
                                  {inputCount}개 종목 입력
                                  {totalScore !== null && <span className="text-orange-500 font-medium"> · 총점 {totalScore}점</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={24} className="text-slate-400" /> : <ChevronDown size={24} className="text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-100 p-4">
                            <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'}`}>
                              {recordTypes.map(type => {
                                const inputData = inputs[student.student_id]?.[type.id] || { value: '', score: null };
                                const decimalPlaces = getDecimalPlaces(type.id);

                                return (
                                  <div key={type.id} className="relative">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">
                                      {type.name} <span className="text-slate-400">({type.unit})</span>
                                    </label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        step={Math.pow(10, -decimalPlaces)}
                                        value={inputData.value}
                                        onChange={e => handleInputChange(student.student_id, type.id, e.target.value, student.gender)}
                                        onBlur={() => handleInputBlur(student.student_id, type.id)}
                                        placeholder={`0${decimalPlaces > 0 ? '.' + '0'.repeat(decimalPlaces) : ''}`}
                                        className="w-full px-4 py-3 pr-16 border border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-orange-500"
                                      />
                                      {inputData.score !== null && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                          <Trophy size={16} className="text-orange-500" />
                                          <span className="font-bold text-orange-600">{inputData.score}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* 종목별 입력 모드 */
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {currentRecordType && (
                    <>
                      <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-800">{currentRecordType.name}</span>
                          <span className="text-slate-500">({currentRecordType.unit})</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {myStudents.map((student, idx) => {
                          const inputData = inputs[student.student_id]?.[currentRecordType.id] || { value: '', score: null };
                          const decimalPlaces = getDecimalPlaces(currentRecordType.id);
                          const isSaved = savedStudents.has(student.student_id);

                          return (
                            <div key={student.student_id} className={`p-4 ${isSaved ? 'bg-green-50' : ''}`}>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="text-slate-400 w-6">{idx + 1}</span>
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                    student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                                  }`}>
                                    {student.student_name.charAt(0)}
                                  </div>
                                  <span className="font-medium text-slate-800">{student.student_name}</span>
                                </div>
                                <input
                                  type="number"
                                  step={Math.pow(10, -decimalPlaces)}
                                  value={inputData.value}
                                  onChange={e => handleInputChange(student.student_id, currentRecordType.id, e.target.value, student.gender)}
                                  onBlur={() => handleInputBlur(student.student_id, currentRecordType.id)}
                                  placeholder="0"
                                  className="w-28 px-4 py-3 border border-slate-200 rounded-xl text-center text-lg focus:ring-2 focus:ring-orange-500"
                                />
                                <div className="w-16 text-center">
                                  {inputData.score !== null ? (
                                    <span className="inline-flex items-center gap-1 text-orange-600 font-bold">
                                      <Trophy size={16} /> {inputData.score}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                                <div className="w-16 text-center">
                                  {isSaved ? (
                                    <Check size={20} className="text-green-500 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
