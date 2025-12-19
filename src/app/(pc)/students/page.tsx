'use client';

import { useState, useEffect } from 'react';
import { Users, RefreshCw, Search, User, TrendingUp, TrendingDown, Minus, X, ChevronRight, Activity } from 'lucide-react';
import apiClient from '@/lib/api/client';

interface Student {
  id: number;
  paca_student_id: number;
  name: string;
  gender: 'M' | 'F';
  phone: string | null;
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

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const [studentsRes, typesRes] = await Promise.all([
        apiClient.get('/students'),
        apiClient.get('/record-types?active=true')
      ]);
      setStudents(studentsRes.data.students || []);
      setRecordTypes(typesRes.data.recordTypes || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
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
        <button
          onClick={fetchStudents}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
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
                          {student.phone && ` · ${student.phone}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Activity size={18} />
                  측정 종목 기록
                </h3>

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
