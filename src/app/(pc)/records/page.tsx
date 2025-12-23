'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, RefreshCw, Calendar, Users, Trophy, ChevronDown, ChevronUp, Check, List, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';

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

interface ClassInstructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain: boolean;
}

interface ClassData {
  class_num: number;
  instructors: ClassInstructor[];
  students: Student[];
}

interface SlotData {
  waitingStudents: Student[];
  waitingInstructors: { id: number; name: string; isOwner: boolean }[];
  classes: ClassData[];
}

interface ScoreRange {
  score: number;
  male_min: number;
  male_max: number;
  female_min: number;
  female_max: number;
}

interface ScoreTableData {
  scoreTable: {
    id: number;
    decimal_places: number;
  } | null;
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

// 역할 표시명 매핑
const getRoleDisplayName = (role?: string, position?: string | null): string => {
  if (position) {
    return position;
  }
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};

export default function RecordsPage() {
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

  // 현재 로그인 사용자
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; role?: string; position?: string | null; instructorId?: number } | null>(null);

  // 입력 모드: student(학생별) / event(종목별)
  const [inputMode, setInputMode] = useState<InputMode>('student');

  // 종목별 모드에서 선택된 종목
  const [selectedRecordType, setSelectedRecordType] = useState<number | null>(null);

  // 종목별 배점표 데이터 캐시
  const [scoreTablesCache, setScoreTablesCache] = useState<{ [key: number]: ScoreTableData }>({});

  // 학생별, 종목별 입력값: { [studentId]: { [recordTypeId]: { value, score } } }
  const [inputs, setInputs] = useState<{ [key: number]: { [key: number]: RecordInput } }>({});

  // 펼쳐진 학생 (학생별 모드)
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  // 저장 성공한 학생
  const [savedStudents, setSavedStudents] = useState<Set<number>>(new Set());

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  // 기존 기록 로드
  const loadExistingRecords = useCallback(async (studentIds: number[], date: string) => {
    if (studentIds.length === 0) return;
    try {
      const res = await apiClient.get(`/records/by-date?date=${date}&student_ids=${studentIds.join(',')}`);
      const records = res.data.records || [];

      // 입력값으로 변환
      const newInputs: { [key: number]: { [key: number]: RecordInput } } = {};
      records.forEach((r: { student_id: number; record_type_id: number; value: number }) => {
        if (!newInputs[r.student_id]) {
          newInputs[r.student_id] = {};
        }
        newInputs[r.student_id][r.record_type_id] = {
          value: r.value.toString(),
          score: null // 점수는 나중에 계산
        };
      });

      setInputs(newInputs);
      // 기록이 있는 학생은 저장됨 표시
      setSavedStudents(new Set(Object.keys(newInputs).map(Number)));
    } catch (error) {
      console.error('Failed to load existing records:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 현재 사용자 정보
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);

      const admin = user?.role === 'admin' || user?.role === 'owner';

      // 종목 목록
      const typesRes = await apiClient.get('/record-types');
      const activeTypes = (typesRes.data.recordTypes || []).filter((t: RecordType) => t.is_active);
      setRecordTypes(activeTypes);

      if (activeTypes.length > 0 && !selectedRecordType) {
        setSelectedRecordType(activeTypes[0].id);
      }

      // 반 배치 현황
      const assignRes = await apiClient.get(`/assignments?date=${measuredAt}`);
      const slotsData = assignRes.data.slots || {};
      setSlots(slotsData);

      // 현재 사용자의 instructor_id
      const myInstructorId = user?.instructorId;

      // 학생이 배치된 시간대 찾기 (반배치 기준)
      const availableSlots: string[] = [];
      let mySlot: string | null = null;
      let myClassNumInSlot: number | null = null;

      ['morning', 'afternoon', 'evening'].forEach(slot => {
        const slotData = slotsData[slot] as SlotData;
        if (!slotData) return;

        // 학생이 있는지 확인 (반에 배치된 학생 + 대기 학생)
        const hasStudentsInClasses = slotData.classes?.some(c => c.students && c.students.length > 0);
        const hasWaitingStudents = slotData.waitingStudents && slotData.waitingStudents.length > 0;

        if (hasStudentsInClasses || hasWaitingStudents) {
          availableSlots.push(slot);

          // 내가 배치된 반 찾기
          if (myInstructorId) {
            const myClass = slotData.classes?.find(c =>
              c.instructors?.some(i => i.id === myInstructorId)
            );
            if (myClass) {
              mySlot = slot;
              myClassNumInSlot = myClass.class_num;
            }
          }
        }
      });

      // 시간대/반 자동 선택
      if (!admin && mySlot) {
        setSelectedSlot(mySlot);
        setSelectedTrainerId(myClassNumInSlot);  // 내 반 번호
      } else if (availableSlots.length > 0) {
        setSelectedSlot(availableSlots[0]);
        setSelectedTrainerId(null);
      }

      // 종목별 배점표 로드
      const scoreTablesData: { [key: number]: ScoreTableData } = {};
      for (const type of activeTypes) {
        try {
          const res = await apiClient.get(`/score-tables/by-type/${type.id}`);
          scoreTablesData[type.id] = res.data;
        } catch {
          scoreTablesData[type.id] = { scoreTable: null, ranges: [] };
        }
      }
      setScoreTablesCache(scoreTablesData);

      // 해당 시간대의 학생 ID 목록 수집 후 기존 기록 로드
      const allStudentIds: number[] = [];
      Object.values(slotsData).forEach((slotData) => {
        const sd = slotData as SlotData;
        // 반에 배치된 학생
        sd.classes?.forEach(c => {
          c.students?.forEach(s => {
            if (!allStudentIds.includes(s.student_id)) {
              allStudentIds.push(s.student_id);
            }
          });
        });
        // 대기 중인 학생
        sd.waitingStudents?.forEach(s => {
          if (!allStudentIds.includes(s.student_id)) {
            allStudentIds.push(s.student_id);
          }
        });
      });

      if (allStudentIds.length > 0) {
        await loadExistingRecords(allStudentIds, measuredAt);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [measuredAt, selectedRecordType, loadExistingRecords]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 학생이 배치된 시간대 목록 (반배치 기준)
  const availableSlots = ['morning', 'afternoon', 'evening'].filter(slot => {
    const slotData = slots[slot] as SlotData;
    if (!slotData) return false;
    const hasStudentsInClasses = slotData.classes?.some(c => c.students && c.students.length > 0);
    const hasWaitingStudents = slotData.waitingStudents && slotData.waitingStudents.length > 0;
    return hasStudentsInClasses || hasWaitingStudents;
  });

  // 선택된 시간대의 데이터
  const currentSlotData = slots[selectedSlot] as SlotData | undefined;
  const currentClasses = currentSlotData?.classes || [];

  // 학생 목록 (원장은 전체, 강사는 자기 반)
  const getMyStudents = (): Student[] => {
    if (!currentSlotData) return [];

    if (isAdmin) {
      // 원장/admin: 해당 시간대 전체 학생 (반 배치 + 대기)
      const allStudents: Student[] = [];
      currentSlotData.classes?.forEach(c => {
        if (c.students) {
          allStudents.push(...c.students);
        }
      });
      // 대기 중인 학생도 포함
      if (currentSlotData.waitingStudents) {
        allStudents.push(...currentSlotData.waitingStudents);
      }
      return allStudents;
    } else {
      // 일반 강사: 자기 반 학생만
      if (!selectedTrainerId) return [];
      const myClass = currentClasses.find(c => c.class_num === selectedTrainerId);
      return myClass?.students || [];
    }
  };

  const myStudents = getMyStudents();

  // 점수 계산
  const calculateScore = (value: number, gender: 'M' | 'F', recordTypeId: number): number | null => {
    const tableData = scoreTablesCache[recordTypeId];
    if (!tableData || !tableData.scoreTable || tableData.ranges.length === 0) {
      return null;
    }

    for (const range of tableData.ranges) {
      const min = gender === 'M' ? range.male_min : range.female_min;
      const max = gender === 'M' ? range.male_max : range.female_max;

      if (value >= min && value <= max) {
        return range.score;
      }
    }

    return null;
  };

  // 입력값 변경
  const handleInputChange = (studentId: number, recordTypeId: number, value: string, gender: 'M' | 'F') => {
    const numValue = parseFloat(value);
    const score = !isNaN(numValue) ? calculateScore(numValue, gender, recordTypeId) : null;

    setInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [recordTypeId]: { value, score }
      }
    }));

    setSavedStudents(prev => {
      const newSet = new Set(prev);
      newSet.delete(studentId);
      return newSet;
    });
  };

  // 자동저장 (blur 시)
  const handleInputBlur = async (studentId: number, recordTypeId: number) => {
    const studentInputs = inputs[studentId];
    const inputData = studentInputs?.[recordTypeId];
    if (!inputData || !inputData.value || inputData.value.trim() === '') return;

    // 이미 저장 중이면 스킵
    if (saving) return;

    try {
      setSaving(true);
      await apiClient.post('/records/batch', {
        student_id: studentId,
        measured_at: measuredAt,
        records: [{
          record_type_id: recordTypeId,
          value: parseFloat(inputData.value),
          notes: null
        }]
      });

      // 저장 성공 표시
      setSavedStudents(prev => new Set([...prev, studentId]));
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  // 학생 펼치기/접기
  const toggleStudent = (studentId: number) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const expandAll = () => setExpandedStudents(new Set(myStudents.map(s => s.student_id)));
  const collapseAll = () => setExpandedStudents(new Set());

  // 학생별 저장
  const saveStudent = async (studentId: number) => {
    const studentInputs = inputs[studentId];
    if (!studentInputs) return;

    const records = Object.entries(studentInputs)
      .filter(([, data]) => data.value && data.value.trim() !== '')
      .map(([recordTypeId, data]) => ({
        record_type_id: parseInt(recordTypeId),
        value: parseFloat(data.value),
        notes: null
      }));

    if (records.length === 0) return;

    try {
      setSaving(true);
      await apiClient.post('/records/batch', {
        student_id: studentId,
        measured_at: measuredAt,
        records
      });

      setSavedStudents(prev => new Set([...prev, studentId]));

      setInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[studentId];
        return newInputs;
      });
    } catch (error) {
      console.error('Failed to save records:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 전체 저장
  const saveAll = async () => {
    const studentsToSave = Object.keys(inputs).filter(studentId => {
      const studentInputs = inputs[parseInt(studentId)];
      return Object.values(studentInputs || {}).some(data => data.value && data.value.trim() !== '');
    });

    if (studentsToSave.length === 0) {
      alert('저장할 기록이 없습니다.');
      return;
    }

    setSaving(true);
    try {
      for (const studentId of studentsToSave) {
        await saveStudent(parseInt(studentId));
      }
      alert(`${studentsToSave.length}명의 기록이 저장되었습니다.`);
    } catch (error) {
      console.error('Failed to save all:', error);
    } finally {
      setSaving(false);
    }
  };

  const getDecimalPlaces = (recordTypeId: number): number => {
    return scoreTablesCache[recordTypeId]?.scoreTable?.decimal_places || 0;
  };

  const getInputCount = (studentId: number): number => {
    const studentInputs = inputs[studentId];
    if (!studentInputs) return 0;
    return Object.values(studentInputs).filter(d => d.value && d.value.trim() !== '').length;
  };

  const getTotalScore = (studentId: number): number | null => {
    const studentInputs = inputs[studentId];
    if (!studentInputs) return null;

    const scores = Object.values(studentInputs)
      .filter(d => d.score !== null)
      .map(d => d.score as number);

    if (scores.length === 0) return null;
    return scores.reduce((sum, s) => sum + s, 0);
  };

  const currentRecordType = recordTypes.find(t => t.id === selectedRecordType);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">기록 측정</h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? `${SLOT_LABELS[selectedSlot] || ''} 전체 학생 기록 입력`
              : `${currentUser?.name || ''} ${getRoleDisplayName(currentUser?.role, currentUser?.position)}의 반 학생 기록 입력`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              value={measuredAt}
              onChange={e => setMeasuredAt(e.target.value)}
              className="border-none focus:ring-0 text-slate-700"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl shadow-sm">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">해당 날짜에 배정된 학생이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 학생을 배치해주세요.</p>
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
              </button>
            ))}
          </div>

          {/* 강사가 반에 배치되지 않은 경우 (일반 강사만) */}
          {!isAdmin && !selectedTrainerId ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">해당 시간대에 배정된 반이 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 반에 배정되어야 합니다.</p>
            </div>
          ) : myStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
              <p className="text-slate-600 font-medium">배정된 학생이 없습니다</p>
              <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 학생을 배치해주세요</p>
            </div>
          ) : (
            <>
              {/* 입력 모드 선택 */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInputMode('student')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                        inputMode === 'student'
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Users size={18} />
                      학생별 입력
                    </button>
                    <button
                      onClick={() => setInputMode('event')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                        inputMode === 'event'
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <List size={18} />
                      종목별 입력
                    </button>
                  </div>

                  {inputMode === 'event' && (
                    <div className="flex gap-2">
                      {recordTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => setSelectedRecordType(type.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            selectedRecordType === type.id
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {type.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {inputMode === 'student' && (
                    <div className="flex gap-2">
                      <button onClick={expandAll} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1">
                        전체 펼치기
                      </button>
                      <button onClick={collapseAll} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1">
                        전체 접기
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 학생 수 */}
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Users size={16} />
                <span>{isAdmin ? '수업 참여 학생 수' : '내 반'}: {myStudents.length}명</span>
              </div>

              {inputMode === 'student' ? (
                /* 학생별 입력 모드 - 2열 그리드 */
                <div className="grid grid-cols-2 gap-2">
                  {myStudents.map(student => {
                    const isExpanded = expandedStudents.has(student.student_id);
                    const inputCount = getInputCount(student.student_id);
                    const totalScore = getTotalScore(student.student_id);
                    const isSaved = savedStudents.has(student.student_id);

                    return (
                      <div
                        key={student.student_id}
                        className={`bg-white rounded-lg shadow-sm overflow-hidden transition ${
                          isSaved ? 'ring-2 ring-green-400' : ''
                        }`}
                      >
                        <div
                          className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                          onClick={() => toggleStudent(student.student_id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                            }`}>
                              {student.gender === 'M' ? '남' : '여'}
                            </span>
                            <span className="font-medium text-slate-800 truncate">{student.student_name}</span>
                            {isSaved && <Check size={14} className="text-green-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {inputCount > 0 && (
                              <span className="text-xs text-orange-500 font-medium">
                                {totalScore !== null ? `${totalScore}점` : `${inputCount}개`}
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={16} className="text-slate-400" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-100 px-3 py-2">
                            <div className="grid grid-cols-2 gap-2">
                              {recordTypes.map(type => {
                                const inputData = inputs[student.student_id]?.[type.id] || { value: '', score: null };
                                const decimalPlaces = getDecimalPlaces(type.id);

                                return (
                                  <div key={type.id} className="relative">
                                    <label className="block text-xs text-slate-500 mb-0.5 truncate">
                                      {type.name}
                                    </label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        step={Math.pow(10, -decimalPlaces)}
                                        value={inputData.value}
                                        onChange={e => handleInputChange(student.student_id, type.id, e.target.value, student.gender)}
                                        onBlur={() => handleInputBlur(student.student_id, type.id)}
                                        placeholder="0"
                                        className="w-full px-2 py-1.5 pr-12 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                                      />
                                      {inputData.score !== null && (
                                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                          <Trophy size={12} className="text-orange-500" />
                                          <span className="text-xs font-bold text-orange-600">{inputData.score}</span>
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
                /* 종목별 입력 모드 - 2열 그리드 */
                <div>
                  {currentRecordType && (
                    <>
                      <div className="bg-white rounded-lg shadow-sm p-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{currentRecordType.name}</span>
                          <span className="text-sm text-slate-500">({currentRecordType.unit})</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            currentRecordType.direction === 'higher' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {currentRecordType.direction === 'higher' ? '↑' : '↓'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {myStudents.map((student) => {
                          const inputData = inputs[student.student_id]?.[currentRecordType.id] || { value: '', score: null };
                          const decimalPlaces = getDecimalPlaces(currentRecordType.id);
                          const isSaved = savedStudents.has(student.student_id);

                          return (
                            <div
                              key={student.student_id}
                              className={`bg-white rounded-lg shadow-sm px-3 py-2 flex items-center gap-2 ${
                                isSaved ? 'ring-2 ring-green-400' : ''
                              }`}
                            >
                              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                              }`}>
                                {student.gender === 'M' ? '남' : '여'}
                              </span>
                              <span className="font-medium text-slate-800 truncate min-w-0 flex-shrink">{student.student_name}</span>
                              <input
                                type="number"
                                step={Math.pow(10, -decimalPlaces)}
                                value={inputData.value}
                                onChange={e => handleInputChange(student.student_id, currentRecordType.id, e.target.value, student.gender)}
                                onBlur={() => handleInputBlur(student.student_id, currentRecordType.id)}
                                placeholder="0"
                                className="w-20 px-2 py-1 text-sm border border-slate-200 rounded text-center focus:ring-1 focus:ring-orange-500 flex-shrink-0"
                              />
                              {inputData.score !== null ? (
                                <span className="flex items-center gap-0.5 text-xs text-orange-600 font-bold flex-shrink-0">
                                  <Trophy size={12} />
                                  {inputData.score}
                                </span>
                              ) : (
                                <span className="w-8 flex-shrink-0"></span>
                              )}
                              {isSaved && <Check size={14} className="text-green-500 flex-shrink-0" />}
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
