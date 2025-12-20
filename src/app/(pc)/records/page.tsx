'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Save, RefreshCw, Calendar, Users, Trophy, ChevronDown, ChevronUp, Check, List, Grid3X3, AlertCircle } from 'lucide-react';
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

export default function RecordsPage() {
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [myStudents, setMyStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [measuredAt, setMeasuredAt] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // 현재 로그인 사용자
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; instructorId?: number } | null>(null);

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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 현재 사용자 정보
      const user = authAPI.getCurrentUser();
      setCurrentUser(user);

      // 종목 목록
      const typesRes = await apiClient.get('/record-types');
      const activeTypes = (typesRes.data.recordTypes || []).filter((t: RecordType) => t.is_active);
      setRecordTypes(activeTypes);

      if (activeTypes.length > 0 && !selectedRecordType) {
        setSelectedRecordType(activeTypes[0].id);
      }

      // 오늘 반 배치 현황에서 내 반 학생만 가져오기
      const assignRes = await apiClient.get(`/assignments?date=${measuredAt}`);
      const assignments = assignRes.data.assignments || [];

      // 내 반 학생 필터링 (instructorId = trainerId)
      let myAssignment = null;
      if (user?.instructorId) {
        myAssignment = assignments.find((a: { trainer_id: number }) => a.trainer_id === user.instructorId);
      }

      if (myAssignment && myAssignment.students) {
        setMyStudents(myAssignment.students);
      } else {
        setMyStudents([]);
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
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [measuredAt, selectedRecordType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

    // 저장됨 상태 초기화
    setSavedStudents(prev => {
      const newSet = new Set(prev);
      newSet.delete(studentId);
      return newSet;
    });
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

  // 전체 펼치기/접기
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

      // 입력값 초기화
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

  // 소수점 자리수 가져오기
  const getDecimalPlaces = (recordTypeId: number): number => {
    return scoreTablesCache[recordTypeId]?.scoreTable?.decimal_places || 0;
  };

  // 학생별 입력된 종목 수
  const getInputCount = (studentId: number): number => {
    const studentInputs = inputs[studentId];
    if (!studentInputs) return 0;
    return Object.values(studentInputs).filter(d => d.value && d.value.trim() !== '').length;
  };

  // 학생별 총점 계산
  const getTotalScore = (studentId: number): number | null => {
    const studentInputs = inputs[studentId];
    if (!studentInputs) return null;

    const scores = Object.values(studentInputs)
      .filter(d => d.score !== null)
      .map(d => d.score as number);

    if (scores.length === 0) return null;
    return scores.reduce((sum, s) => sum + s, 0);
  };

  // 현재 선택된 종목 정보
  const currentRecordType = recordTypes.find(t => t.id === selectedRecordType);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">기록 측정</h1>
          <p className="text-slate-500 mt-1">
            {currentUser?.name ? `${currentUser.name} 코치` : ''}의 반 학생 기록 입력
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
          <button
            onClick={saveAll}
            disabled={saving || Object.keys(inputs).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            <span>전체 저장</span>
          </button>
        </div>
      </div>

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

          {/* 종목별 모드: 종목 선택 */}
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

          {/* 학생별 모드: 펼치기/접기 */}
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

      {/* 내 반 학생 수 */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Users size={16} />
        <span>내 반: {myStudents.length}명</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl shadow-sm">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : myStudents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
          <p className="text-slate-600 font-medium">오늘 배치된 학생이 없습니다</p>
          <p className="text-slate-400 text-sm mt-1">반 배치 페이지에서 학생을 배치해주세요</p>
        </div>
      ) : inputMode === 'student' ? (
        /* 학생별 입력 모드 */
        <div className="space-y-2">
          {myStudents.map(student => {
            const isExpanded = expandedStudents.has(student.student_id);
            const inputCount = getInputCount(student.student_id);
            const totalScore = getTotalScore(student.student_id);
            const isSaved = savedStudents.has(student.student_id);

            return (
              <div
                key={student.student_id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition ${
                  isSaved ? 'ring-2 ring-green-400' : ''
                }`}
              >
                {/* 학생 헤더 */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleStudent(student.student_id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    }`}>
                      {student.student_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{student.student_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                        }`}>
                          {student.gender === 'M' ? '남' : '여'}
                        </span>
                        {isSaved && (
                          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                            <Check size={12} />
                            저장됨
                          </span>
                        )}
                      </div>
                      {inputCount > 0 && (
                        <div className="text-sm text-slate-500">
                          {inputCount}개 종목 입력 {totalScore !== null && (
                            <span className="text-orange-500 font-medium">· 총점 {totalScore}점</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inputCount > 0 && !isSaved && (
                      <button
                        onClick={(e) => { e.stopPropagation(); saveStudent(student.student_id); }}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                      >
                        <Save size={14} />
                        저장
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </div>
                </div>

                {/* 종목별 입력 */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {recordTypes.map(type => {
                        const inputData = inputs[student.student_id]?.[type.id] || { value: '', score: null };
                        const decimalPlaces = getDecimalPlaces(type.id);

                        return (
                          <div key={type.id} className="relative">
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                              {type.name}
                              <span className="text-slate-400 ml-1">({type.unit})</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step={Math.pow(10, -decimalPlaces)}
                                value={inputData.value}
                                onChange={e => handleInputChange(student.student_id, type.id, e.target.value, student.gender)}
                                placeholder={`0${decimalPlaces > 0 ? '.' + '0'.repeat(decimalPlaces) : ''}`}
                                className="w-full px-3 py-2 pr-16 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              />
                              {inputData.score !== null && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                  <Trophy size={14} className="text-orange-500" />
                                  <span className="text-sm font-bold text-orange-600">{inputData.score}</span>
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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {currentRecordType && (
            <>
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-800">{currentRecordType.name}</span>
                  <span className="text-slate-500">({currentRecordType.unit})</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    currentRecordType.direction === 'higher' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {currentRecordType.direction === 'higher' ? '높을수록 좋음 ↑' : '낮을수록 좋음 ↓'}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium text-slate-600 w-16">#</th>
                      <th className="py-3 px-4 text-left font-medium text-slate-600">이름</th>
                      <th className="py-3 px-4 text-left font-medium text-slate-600 w-24">성별</th>
                      <th className="py-3 px-4 text-center font-medium text-slate-600 w-40">
                        기록 ({currentRecordType.unit})
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-slate-600 w-24">점수</th>
                      <th className="py-3 px-4 text-center font-medium text-slate-600 w-24">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myStudents.map((student, idx) => {
                      const inputData = inputs[student.student_id]?.[currentRecordType.id] || { value: '', score: null };
                      const decimalPlaces = getDecimalPlaces(currentRecordType.id);
                      const isSaved = savedStudents.has(student.student_id);

                      return (
                        <tr key={student.student_id} className={isSaved ? 'bg-green-50' : 'hover:bg-slate-50'}>
                          <td className="py-3 px-4 text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-800">{student.student_name}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded ${
                              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                            }`}>
                              {student.gender === 'M' ? '남' : '여'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              step={Math.pow(10, -decimalPlaces)}
                              value={inputData.value}
                              onChange={e => handleInputChange(student.student_id, currentRecordType.id, e.target.value, student.gender)}
                              placeholder={`0${decimalPlaces > 0 ? '.' + '0'.repeat(decimalPlaces) : ''}`}
                              className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            {inputData.score !== null ? (
                              <span className="inline-flex items-center gap-1 text-orange-600 font-bold">
                                <Trophy size={14} />
                                {inputData.score}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isSaved ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                <Check size={12} />
                                저장됨
                              </span>
                            ) : inputData.value ? (
                              <button
                                onClick={() => saveStudent(student.student_id)}
                                disabled={saving}
                                className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                              >
                                저장
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
