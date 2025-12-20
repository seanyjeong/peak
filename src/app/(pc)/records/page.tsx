'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Save, RefreshCw, Calendar, Users, Trophy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import apiClient from '@/lib/api/client';

interface RecordType {
  id: number;
  name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
}

interface Student {
  id: number;
  name: string;
  gender: 'M' | 'F';
  grade?: string;
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

export default function RecordsPage() {
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [measuredAt, setMeasuredAt] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // 종목별 배점표 데이터 캐시
  const [scoreTablesCache, setScoreTablesCache] = useState<{ [key: number]: ScoreTableData }>({});

  // 학생별, 종목별 입력값: { [studentId]: { [recordTypeId]: { value, score } } }
  const [inputs, setInputs] = useState<{ [key: number]: { [key: number]: RecordInput } }>({});

  // 펼쳐진 학생
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  // 저장 성공한 학생
  const [savedStudents, setSavedStudents] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [typesRes, studentsRes] = await Promise.all([
        apiClient.get('/record-types'),
        apiClient.get('/students')
      ]);

      const activeTypes = (typesRes.data.recordTypes || []).filter((t: RecordType) => t.is_active);
      setRecordTypes(activeTypes);
      setStudents(studentsRes.data.students || []);

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
  }, []);

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

  // 전체 펼치기
  const expandAll = () => {
    setExpandedStudents(new Set(students.map(s => s.id)));
  };

  // 전체 접기
  const collapseAll = () => {
    setExpandedStudents(new Set());
  };

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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">기록 측정</h1>
          <p className="text-slate-500 mt-1">학생별 종목 기록 입력</p>
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

      {/* 종목 범례 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          {recordTypes.map(type => (
            <div key={type.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <span className="font-medium text-slate-700">{type.name}</span>
              <span className="text-xs text-slate-500">({type.unit})</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                type.direction === 'higher' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {type.direction === 'higher' ? '↑' : '↓'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 펼치기/접기 버튼 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users size={16} />
          <span>{students.length}명</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1"
          >
            전체 펼치기
          </button>
          <button
            onClick={collapseAll}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1"
          >
            전체 접기
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl shadow-sm">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">등록된 학생이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map(student => {
            const isExpanded = expandedStudents.has(student.id);
            const inputCount = getInputCount(student.id);
            const totalScore = getTotalScore(student.id);
            const isSaved = savedStudents.has(student.id);

            return (
              <div
                key={student.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition ${
                  isSaved ? 'ring-2 ring-green-400' : ''
                }`}
              >
                {/* 학생 헤더 */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleStudent(student.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{student.name}</span>
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
                        onClick={(e) => { e.stopPropagation(); saveStudent(student.id); }}
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
                        const inputData = inputs[student.id]?.[type.id] || { value: '', score: null };
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
                                onChange={e => handleInputChange(student.id, type.id, e.target.value, student.gender)}
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
      )}
    </div>
  );
}
