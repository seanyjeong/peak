'use client';

import { useState, useEffect } from 'react';
import { Users, RefreshCw, Search, User, TrendingUp, TrendingDown, Minus, X, ChevronRight, Activity, Plus, Save, Trophy, Calendar, Download } from 'lucide-react';
import { authAPI } from '@/lib/api/auth';
import apiClient from '@/lib/api/client';

interface Student {
  id: number;
  paca_student_id: number;
  name: string;
  gender: 'M' | 'F';
  phone: string | null;
  school: string | null;
  grade: string | null;
  class_days: number[] | null;
  is_trial: boolean;
  trial_total: number;
  trial_remaining: number;
  join_date: string | null;
  status: 'active' | 'inactive' | 'injury';
}

interface RecordType {
  id: number;
  name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
  display_order: number;
}

interface RecordItem {
  record_type_id: number;
  record_type_name: string;
  unit: string;
  direction: 'higher' | 'lower';
  value: number;
  notes: string | null;
}

interface StudentRecord {
  measured_at: string;
  records: RecordItem[];
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

const STATUS_MAP = {
  active: { label: '훈련 중', color: 'bg-green-100 text-green-700' },
  inactive: { label: '휴원', color: 'bg-slate-100 text-slate-600' },
  injury: { label: '부상', color: 'bg-red-100 text-red-700' },
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // 기록 추가 폼 상태
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordInputs, setRecordInputs] = useState<{ [key: number]: { value: string; score: number | null } }>({});
  const [scoreTables, setScoreTables] = useState<{ [key: number]: ScoreTableData }>({});
  const [savingRecord, setSavingRecord] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // P-ACA 학생 동기화
  const syncStudents = async () => {
    const user = authAPI.getCurrentUser();
    if (!user?.academyId) {
      alert('학원 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      setSyncing(true);
      const response = await apiClient.post('/students/sync', { academyId: user.academyId });
      alert(response.data.message);
      fetchStudents();
    } catch (error) {
      console.error('Sync error:', error);
      alert('동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const [studentsRes, typesRes] = await Promise.all([
        apiClient.get('/students'),
        apiClient.get('/record-types?active=true')
      ]);
      setStudents(studentsRes.data.students || []);
      const types = typesRes.data.recordTypes || [];
      setRecordTypes(types);

      // 배점표 로드
      const tables: { [key: number]: ScoreTableData } = {};
      for (const type of types) {
        try {
          const res = await apiClient.get(`/score-tables/by-type/${type.id}`);
          tables[type.id] = res.data;
        } catch {
          tables[type.id] = { scoreTable: null, ranges: [] };
        }
      }
      setScoreTables(tables);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  // 점수 계산
  const calculateScore = (value: number, gender: 'M' | 'F', recordTypeId: number): number | null => {
    const tableData = scoreTables[recordTypeId];
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

  // 기록 입력 변경
  const handleRecordInput = (typeId: number, value: string) => {
    const numValue = parseFloat(value);
    const score = !isNaN(numValue) && selectedStudent
      ? calculateScore(numValue, selectedStudent.gender, typeId)
      : null;

    setRecordInputs(prev => ({
      ...prev,
      [typeId]: { value, score }
    }));
  };

  // 기록 저장
  const saveStudentRecord = async () => {
    if (!selectedStudent) return;

    const records = Object.entries(recordInputs)
      .filter(([, data]) => data.value && data.value.trim() !== '')
      .map(([typeId, data]) => ({
        record_type_id: parseInt(typeId),
        value: parseFloat(data.value),
        notes: null
      }));

    if (records.length === 0) {
      alert('입력된 기록이 없습니다.');
      return;
    }

    try {
      setSavingRecord(true);
      await apiClient.post('/records/batch', {
        student_id: selectedStudent.id,
        measured_at: recordDate,
        records
      });

      alert('기록이 저장되었습니다.');
      setShowAddRecord(false);
      setRecordInputs({});
      fetchStudentRecords(selectedStudent.id);
    } catch (error) {
      console.error('Failed to save record:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSavingRecord(false);
    }
  };

  // 소수점 자리수
  const getDecimalPlaces = (typeId: number): number => {
    return scoreTables[typeId]?.scoreTable?.decimal_places || 0;
  };

  const fetchStudentRecords = async (studentId: number) => {
    try {
      setLoadingRecords(true);
      const response = await apiClient.get(`/students/${studentId}/records`);
      setStudentRecords(response.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentRecords(selectedStudent.id);
    }
  }, [selectedStudent]);

  // 필터링
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 종목별 최신 기록 및 변화 계산
  const getLatestRecordByType = (typeId: number): { value: number | null; trend: { direction: string; diff: number } | null } => {
    if (studentRecords.length === 0) return { value: null, trend: null };

    // 해당 종목의 모든 기록 수집
    const typeRecords: { date: string; value: number }[] = [];
    studentRecords.forEach(sr => {
      const record = sr.records.find(r => r.record_type_id === typeId);
      if (record) {
        typeRecords.push({ date: sr.measured_at, value: record.value });
      }
    });

    if (typeRecords.length === 0) return { value: null, trend: null };

    // 날짜순 정렬 (최신이 마지막)
    typeRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const latest = typeRecords[typeRecords.length - 1].value;
    let trend = null;

    if (typeRecords.length >= 2) {
      const previous = typeRecords[typeRecords.length - 2].value;
      const diff = latest - previous;
      const recordType = recordTypes.find(rt => rt.id === typeId);
      const isImprovement = recordType?.direction === 'higher' ? diff > 0 : diff < 0;

      if (Math.abs(diff) >= 0.1) {
        trend = {
          direction: isImprovement ? 'up' : 'down',
          diff: Math.abs(diff)
        };
      } else {
        trend = { direction: 'same', diff: 0 };
      }
    }

    return { value: latest, trend };
  };

  const selectStudent = (student: Student) => {
    setSelectedStudent(student);
    setStudentRecords([]);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">학생 관리</h1>
          <p className="text-slate-500 mt-1">총 {students.length}명</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncStudents}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            <Download size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? '동기화 중...' : 'P-ACA 동기화'}</span>
          </button>
          <button
            onClick={fetchStudents}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="이름 검색..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체
            </button>
            {Object.entries(STATUS_MAP).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statusFilter === key
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {value.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Student List */}
        <div className={`${selectedStudent ? 'w-1/2' : 'w-full'} transition-all`}>
          {loading ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-2xl shadow-sm">
              <RefreshCw size={32} className="animate-spin text-slate-400" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Users size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">학생이 없습니다.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    onClick={() => selectStudent(student)}
                    className={`p-4 flex items-center justify-between cursor-pointer transition ${
                      selectedStudent?.id === student.id
                        ? 'bg-orange-50 border-l-4 border-orange-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                      }`}>
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-400">
                          {student.gender === 'M' ? '남' : '여'}
                          {student.school && ` · ${student.school}`}
                          {student.grade && ` ${student.grade}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!!student.is_trial && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          체험 {student.trial_total - student.trial_remaining + 1}/{student.trial_total}
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_MAP[student.status].color}`}>
                        {STATUS_MAP[student.status].label}
                      </span>
                      <ChevronRight size={18} className="text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Student Detail */}
        {selectedStudent && (
          <div className="w-1/2">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden sticky top-8">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white relative">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    selectedStudent.gender === 'M' ? 'bg-blue-400' : 'bg-pink-400'
                  }`}>
                    <User size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                    <p className="text-orange-100">
                      {selectedStudent.gender === 'M' ? '남' : '여'}
                      {selectedStudent.join_date && ` · ${new Date(selectedStudent.join_date).toLocaleDateString('ko-KR')} 등록`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Records */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Activity size={18} />
                    측정 종목 기록
                  </h3>
                  <button
                    onClick={() => { setShowAddRecord(!showAddRecord); setRecordInputs({}); }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      showAddRecord
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {showAddRecord ? <X size={16} /> : <Plus size={16} />}
                    {showAddRecord ? '취소' : '기록 추가'}
                  </button>
                </div>

                {/* 기록 추가 폼 */}
                {showAddRecord && (
                  <div className="bg-orange-50 rounded-xl p-4 mb-4 border border-orange-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={16} className="text-orange-500" />
                      <input
                        type="date"
                        value={recordDate}
                        onChange={e => setRecordDate(e.target.value)}
                        className="px-2 py-1 border border-orange-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {recordTypes.map(type => {
                        const inputData = recordInputs[type.id] || { value: '', score: null };
                        const decimalPlaces = getDecimalPlaces(type.id);

                        return (
                          <div key={type.id}>
                            <label className="block text-xs text-slate-600 mb-1">
                              {type.name} ({type.unit})
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step={Math.pow(10, -decimalPlaces)}
                                value={inputData.value}
                                onChange={e => handleRecordInput(type.id, e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 pr-14 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                              />
                              {inputData.score !== null && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                  <Trophy size={12} className="text-orange-500" />
                                  <span className="text-xs font-bold text-orange-600">{inputData.score}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={saveStudentRecord}
                      disabled={savingRecord}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                    >
                      {savingRecord ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                      저장
                    </button>
                  </div>
                )}

                {loadingRecords ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw size={24} className="animate-spin text-slate-400" />
                  </div>
                ) : recordTypes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Activity size={32} className="mx-auto mb-2 opacity-50" />
                    <p>등록된 종목이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Record Type Summary */}
                    <div className="grid grid-cols-2 gap-3">
                      {recordTypes.map(type => {
                        const { value, trend } = getLatestRecordByType(type.id);

                        return (
                          <div key={type.id} className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs text-slate-500 mb-1">{type.name}</p>
                            <div className="flex items-end justify-between">
                              <p className="text-2xl font-bold text-slate-800">
                                {value !== null ? value : '-'}
                                <span className="text-sm font-normal text-slate-400 ml-1">{type.unit}</span>
                              </p>
                              {trend && (
                                <div className={`flex items-center gap-1 text-sm ${
                                  trend.direction === 'up' ? 'text-green-600' :
                                  trend.direction === 'down' ? 'text-red-600' : 'text-slate-400'
                                }`}>
                                  {trend.direction === 'up' && <TrendingUp size={16} />}
                                  {trend.direction === 'down' && <TrendingDown size={16} />}
                                  {trend.direction === 'same' && <Minus size={16} />}
                                  {trend.diff !== 0 && <span>{trend.diff.toFixed(1)}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Record History */}
                    {studentRecords.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">기록 히스토리</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-2 text-slate-500 font-medium">날짜</th>
                                {recordTypes.map(type => (
                                  <th key={type.id} className="text-right py-2 px-2 text-slate-500 font-medium">
                                    {type.name.length > 4 ? type.name.slice(0, 4) : type.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {studentRecords.slice(0, 10).map((sr, idx) => (
                                <tr key={sr.measured_at} className={`border-b border-slate-100 ${idx === 0 ? 'bg-orange-50' : ''}`}>
                                  <td className="py-2 px-2 text-slate-600">
                                    {new Date(sr.measured_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                  </td>
                                  {recordTypes.map(type => {
                                    const record = sr.records.find(r => r.record_type_id === type.id);
                                    return (
                                      <td key={type.id} className="text-right py-2 px-2 text-slate-800">
                                        {record ? record.value : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {studentRecords.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Activity size={32} className="mx-auto mb-2 opacity-50" />
                        <p>기록이 없습니다.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
