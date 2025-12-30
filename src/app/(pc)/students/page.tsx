'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, RefreshCw, Search, User, X, Activity, Plus, Download, ExternalLink } from 'lucide-react';
import { authAPI } from '@/lib/api/auth';
import apiClient from '@/lib/api/client';
import {
  StudentListItem,
  RecordAddForm,
  RecordTypeCard,
  RecordChart,
  Student,
  RecordType,
  StudentRecord,
  ScoreTableData,
  RecordInput,
  STATUS_MAP,
} from '@/components/students';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordInputs, setRecordInputs] = useState<{ [key: number]: RecordInput }>({});
  const [scoreTables, setScoreTables] = useState<{ [key: number]: ScoreTableData }>({});
  const [savingRecord, setSavingRecord] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedRecordType, setSelectedRecordType] = useState<number | null>(null);

  const statusCounts = {
    all: students.length,
    active: students.filter(s => s.status === 'active' && !s.is_trial).length,
    inactive: students.filter(s => s.status === 'inactive').length,
    injury: students.filter(s => s.status === 'injury').length,
    paused: students.filter(s => s.status === 'paused').length,
    pending: students.filter(s => s.status === 'pending').length,
    trial: students.filter(s => s.is_trial).length,
  };

  const syncStudents = async () => {
    const user = authAPI.getCurrentUser();
    if (!user?.academyId) { alert('학원 정보를 찾을 수 없습니다.'); return; }
    try {
      setSyncing(true);
      const response = await apiClient.post('/students/sync', { academyId: user.academyId });
      alert(response.data.message);
      fetchStudents();
    } catch (error) {
      console.error('Sync error:', error);
      alert('동기화에 실패했습니다.');
    } finally { setSyncing(false); }
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

      const tables: { [key: number]: ScoreTableData } = {};
      for (const type of types) {
        try {
          const res = await apiClient.get(`/score-tables/by-type/${type.id}`);
          tables[type.id] = res.data;
        } catch { tables[type.id] = { scoreTable: null, ranges: [] }; }
      }
      setScoreTables(tables);
    } catch (error) { console.error('Failed to fetch students:', error); }
    finally { setLoading(false); }
  };

  const calculateScore = (value: number, gender: 'M' | 'F', recordTypeId: number): number | null => {
    const tableData = scoreTables[recordTypeId];
    if (!tableData?.scoreTable || tableData.ranges.length === 0) return null;
    for (const range of tableData.ranges) {
      const min = gender === 'M' ? range.male_min : range.female_min;
      const max = gender === 'M' ? range.male_max : range.female_max;
      if (value >= min && value <= max) return range.score;
    }
    return null;
  };

  const handleRecordInput = (typeId: number, value: string) => {
    const numValue = parseFloat(value);
    const score = !isNaN(numValue) && selectedStudent
      ? calculateScore(numValue, selectedStudent.gender, typeId) : null;
    setRecordInputs(prev => ({ ...prev, [typeId]: { value, score } }));
  };

  const saveStudentRecord = async () => {
    if (!selectedStudent) return;
    const records = Object.entries(recordInputs)
      .filter(([, data]) => data.value?.trim())
      .map(([typeId, data]) => ({ record_type_id: parseInt(typeId), value: parseFloat(data.value), notes: null }));
    if (records.length === 0) { alert('입력된 기록이 없습니다.'); return; }
    try {
      setSavingRecord(true);
      await apiClient.post('/records/batch', { student_id: selectedStudent.id, measured_at: recordDate, records });
      alert('기록이 저장되었습니다.');
      setShowAddRecord(false);
      setRecordInputs({});
      fetchStudentRecords(selectedStudent.id);
    } catch (error) { console.error('Failed to save record:', error); alert('저장에 실패했습니다.'); }
    finally { setSavingRecord(false); }
  };

  const getDecimalPlaces = (typeId: number) => scoreTables[typeId]?.scoreTable?.decimal_places || 0;

  const detectDecimalPlaces = (values: number[]): number => {
    let maxDecimals = 0;
    for (const val of values) {
      const str = val.toString();
      const idx = str.indexOf('.');
      if (idx !== -1) { const d = str.length - idx - 1; if (d > maxDecimals) maxDecimals = d; }
    }
    return maxDecimals;
  };

  const fetchStudentRecords = async (studentId: number) => {
    try {
      setLoadingRecords(true);
      const response = await apiClient.get(`/students/${studentId}/records`);
      setStudentRecords(response.data.records || []);
    } catch (error) { console.error('Failed to fetch records:', error); }
    finally { setLoadingRecords(false); }
  };

  useEffect(() => { fetchStudents(); }, []);
  useEffect(() => { if (selectedStudent) fetchStudentRecords(selectedStudent.id); }, [selectedStudent]);

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesFilter = false;
    switch (statusFilter) {
      case 'all': matchesFilter = true; break;
      case 'trial': matchesFilter = student.is_trial; break;
      case 'active': matchesFilter = student.status === 'active' && !student.is_trial; break;
      default: matchesFilter = student.status === statusFilter;
    }
    return matchesSearch && matchesFilter;
  });

  const getLatestRecordByType = (typeId: number) => {
    if (studentRecords.length === 0) return { value: null, trend: null };
    const typeRecords: { date: string; value: number }[] = [];
    studentRecords.forEach(sr => {
      const record = sr.records.find(r => r.record_type_id === typeId);
      if (record) typeRecords.push({ date: sr.measured_at, value: record.value });
    });
    if (typeRecords.length === 0) return { value: null, trend: null };
    typeRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = typeRecords[typeRecords.length - 1].value;
    let trend = null;
    if (typeRecords.length >= 2) {
      const previous = typeRecords[typeRecords.length - 2].value;
      const diff = latest - previous;
      const recordType = recordTypes.find(rt => rt.id === typeId);
      const isImprovement = recordType?.direction === 'higher' ? diff > 0 : diff < 0;
      if (Math.abs(diff) >= 0.1) trend = { direction: isImprovement ? 'up' : 'down', diff: Math.abs(diff) };
      else trend = { direction: 'same', diff: 0 };
    }
    return { value: latest, trend };
  };

  const selectStudent = (student: Student) => {
    setSelectedStudent(student);
    setStudentRecords([]);
    setSelectedRecordType(null);
  };

  const getChartData = (typeId: number) => {
    const data: { date: string; value: number; label: string }[] = [];
    studentRecords.forEach(sr => {
      const record = sr.records.find(r => r.record_type_id === typeId);
      if (record) data.push({
        date: sr.measured_at,
        value: typeof record.value === 'string' ? parseFloat(record.value) : record.value,
        label: new Date(sr.measured_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      });
    });
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
          <button onClick={syncStudents} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50">
            <Download size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? '동기화 중...' : 'P-ACA 동기화'}</span>
          </button>
          <button onClick={fetchStudents} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="이름 검색..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              전체 <span className="ml-1 opacity-80">{statusCounts.all}</span>
            </button>
            {Object.entries(STATUS_MAP).map(([key, value]) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === key ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {value.label} <span className="ml-1 opacity-80">{statusCounts[key as keyof typeof statusCounts] ?? 0}</span>
              </button>
            ))}
            <button onClick={() => setStatusFilter('trial')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === 'trial' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}>
              체험생 <span className="ml-1 opacity-80">{statusCounts.trial}</span>
            </button>
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
                  <StudentListItem key={student.id} student={student}
                    isSelected={selectedStudent?.id === student.id}
                    onSelect={() => selectStudent(student)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Student Detail */}
        {selectedStudent && (
          <div className="w-1/2">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden sticky top-8">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white relative">
                <button onClick={() => setSelectedStudent(null)} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition">
                  <X size={20} />
                </button>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${selectedStudent.gender === 'M' ? 'bg-blue-400' : 'bg-pink-400'}`}>
                    <User size={32} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                      <Link href={`/students/${selectedStudent.id}`} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition" title="프로필 보기">
                        <ExternalLink size={16} />
                      </Link>
                    </div>
                    <p className="text-orange-100">
                      {selectedStudent.gender === 'M' ? '남' : '여'}
                      {selectedStudent.join_date && ` · ${new Date(selectedStudent.join_date).toLocaleDateString('ko-KR')} 등록`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Activity size={18} /> 측정 종목 기록
                  </h3>
                  <button onClick={() => { setShowAddRecord(!showAddRecord); setRecordInputs({}); }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${showAddRecord ? 'bg-slate-200 text-slate-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                    {showAddRecord ? <X size={16} /> : <Plus size={16} />}
                    {showAddRecord ? '취소' : '기록 추가'}
                  </button>
                </div>

                {showAddRecord && (
                  <RecordAddForm recordDate={recordDate} setRecordDate={setRecordDate}
                    recordTypes={recordTypes} recordInputs={recordInputs}
                    onInputChange={handleRecordInput} onSave={saveStudentRecord}
                    saving={savingRecord} getDecimalPlaces={getDecimalPlaces} />
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
                    <div className="grid grid-cols-2 gap-3">
                      {recordTypes.map(type => {
                        const { value, trend } = getLatestRecordByType(type.id);
                        const hasData = getChartData(type.id).length > 0;
                        return (
                          <RecordTypeCard key={type.id} type={type} value={value} trend={trend}
                            isSelected={selectedRecordType === type.id} hasData={hasData}
                            onClick={() => setSelectedRecordType(selectedRecordType === type.id ? null : type.id)} />
                        );
                      })}
                    </div>

                    {selectedRecordType && (() => {
                      const type = recordTypes.find(t => t.id === selectedRecordType);
                      const chartData = getChartData(selectedRecordType);
                      if (!type || chartData.length === 0) return null;
                      return <RecordChart type={type} chartData={chartData}
                        getDecimalPlaces={getDecimalPlaces} detectDecimalPlaces={detectDecimalPlaces} />;
                    })()}

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
