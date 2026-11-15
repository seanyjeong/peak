'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import { Users, RefreshCw, Search, User, X, Activity, Plus, ExternalLink, TableProperties } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { BranchTabs } from '@/components/BranchTabs';
import { PageHeader, chipClass, decorTone, toolbarButtonClass } from '@/components/ui/page';
import {
  StudentListItem,
  RecordAddForm,
  RecordTypeCard,
  RecordChart,
  ChosungJumpNav,
  RecordType,
  StudentRecord,
  ScoreTableData,
  RecordInput,
} from '@/components/students';
import { useStudentList, STATUS_MAP } from '@/features/students';
import type { Student } from '@/features/students';
import { groupByChosung, getSortedGroups } from '@/lib/utils/korean';
import { getProfileErrorMessage } from './[id]/student-profile-model';

export default function StudentsPage() {
  const toast = useToast();
  const {
    filteredStudents,
    loading,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    statusCounts,
    fetchStudents,
    branches,
    branchId,
    setBranchId,
  } = useStudentList();

  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordDate, setRecordDate] = useState(() => (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })());
  const [recordInputs, setRecordInputs] = useState<{ [key: number]: RecordInput }>({});
  const [scoreTables, setScoreTables] = useState<{ [key: number]: ScoreTableData }>({});
  const [savingRecord, setSavingRecord] = useState(false);
  const [selectedRecordType, setSelectedRecordType] = useState<number | null>(null);

  // 초성 그룹핑
  const groupRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [activeChosung, setActiveChosung] = useState<string | undefined>(undefined);

  const sortedGroups = useMemo(() => {
    const groups = groupByChosung(filteredStudents, (s) => s.name);
    return getSortedGroups(groups);
  }, [filteredStudents]);

  const availableChosung = useMemo(() => {
    return new Set(sortedGroups.map(([chosung]) => chosung));
  }, [sortedGroups]);

  const handleChosungJump = (chosung: string) => {
    const element = groupRefs.current[chosung];
    if (element) {
      element.scrollIntoView({ behavior: 'instant', block: 'start' });
      setActiveChosung(chosung);
    }
  };

  useEffect(() => {
    fetchRecordTypesAndTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecordTypesAndTables = async () => {
    try {
      const typesRes = await apiClient.get('/record-types?active=true');
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
    } catch (error) {
      toast.error(getProfileErrorMessage(error, '측정 종목을 불러오지 못했습니다.'));
    }
  };

  const calculateScore = (value: number, gender: 'M' | 'F' | null, recordTypeId: number): number | null => {
    const tableData = scoreTables[recordTypeId];
    if (!tableData?.scoreTable || tableData.ranges.length === 0) return null;
    if (gender !== 'M' && gender !== 'F') return null; // 성별이 없으면 배점하지 않는다
    if (value === 0) return tableData.scoreTable.min_score || 0; // 파울(0)은 기본점수
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
    if (records.length === 0) { toast.error('입력된 기록이 없습니다.'); return; }
    try {
      setSavingRecord(true);
      await apiClient.post('/records/batch', { student_id: selectedStudent.id, measured_at: recordDate, records });
      toast.success('기록이 저장되었습니다.');
      setShowAddRecord(false);
      setRecordInputs({});
      fetchStudentRecords(selectedStudent.id);
    } catch (error) { toast.error(getProfileErrorMessage(error, '기록을 저장하지 못했습니다.')); }
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
    } catch (error) { toast.error(getProfileErrorMessage(error, '학생 기록을 불러오지 못했습니다.')); }
    finally { setLoadingRecords(false); }
  };

  useEffect(() => { if (selectedStudent) fetchStudentRecords(selectedStudent.id); }, [selectedStudent]);

  const getLatestRecordByType = (typeId: number) => {
    if (studentRecords.length === 0) return { value: null, trend: null };
    const typeRecords: { date: string; value: number; source?: string }[] = [];
    studentRecords.forEach(sr => {
      sr.records
        .filter((r: { record_type_id: number }) => r.record_type_id === typeId)
        .forEach((record: { value: number; source?: string }) => {
          typeRecords.push({ date: sr.measured_at, value: record.value, source: record.source });
        });
    });
    if (typeRecords.length === 0) return { value: null, trend: null };
    // 같은 날이면 월말 우선, 그다음 날짜순
    typeRecords.sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (d !== 0) return d;
      if (a.source !== b.source) return a.source === 'monthly_test' ? 1 : -1;
      return 0;
    });
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
      const baseLabel = new Date(sr.measured_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      sr.records
        .filter((r: { record_type_id: number }) => r.record_type_id === typeId)
        .forEach((record: { value: number | string; source?: string }, idx: number) => {
          const isMonthly = record.source === 'monthly_test';
          data.push({
            date: `${sr.measured_at}#${record.source || 'training'}#${idx}`,
            value: typeof record.value === 'string' ? parseFloat(record.value) : record.value,
            label: isMonthly ? `${baseLabel} 월말` : baseLabel,
          });
        });
    });
    return data.sort((a, b) => a.date.localeCompare(b.date));
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader
        title="학생 관리"
        actions={(
          <>
            <Link href="/students/records" className={toolbarButtonClass()}>
              <TableProperties size={16} />
              <span>전체 기록</span>
            </Link>
            <button onClick={fetchStudents} disabled={loading} className={`${toolbarButtonClass()} w-10 px-0`} aria-label="새로고침">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        )}
      />

      <BranchTabs branches={branches} value={branchId} onChange={setBranchId} />

      {/* Filters */}
      <div className="rounded-2xl bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="학생 이름 검색" className="h-11 w-full rounded-xl border border-transparent bg-muted pl-10 pr-4 text-[15px] text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter('all')} aria-pressed={statusFilter === 'all'}
              className={chipClass(statusFilter === 'all', 'card')}>
              전체 <span className="tabular-nums opacity-70">{statusCounts.all}</span>
            </button>
            {Object.entries(STATUS_MAP).map(([key, value]) => (
              <button key={key} onClick={() => setStatusFilter(key)} aria-pressed={statusFilter === key}
                className={chipClass(statusFilter === key, 'card')}>
                {value.label} <span className="tabular-nums opacity-70">{statusCounts[key as keyof typeof statusCounts] ?? 0}</span>
              </button>
            ))}
            <button onClick={() => setStatusFilter('trial')} aria-pressed={statusFilter === 'trial'}
              className={statusFilter === 'trial' ? chipClass(true, 'card') : `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${decorTone.purple}`}>
              체험생 <span className="tabular-nums opacity-70">{statusCounts.trial}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-4">
        {/* Student List with Chosung Jump */}
        <div className={`${selectedStudent ? 'hidden lg:block lg:w-1/2' : 'w-full'} relative transition-all`}>
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-card">
              <RefreshCw size={32} className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-2xl bg-card p-16 text-center">
              <Users size={48} className="mx-auto text-muted-foreground/60 mb-4" />
              <p className="text-muted-foreground">학생이 없습니다.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              {/* Student List with Groups */}
              <div className="flex-1 overflow-hidden rounded-2xl bg-card">
                <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                  {sortedGroups.map(([chosung, students]) => (
                    <div
                      key={chosung}
                      ref={(el) => { groupRefs.current[chosung] = el; }}
                    >
                      {/* Chosung Header */}
                      <div className="sticky top-0 z-10 bg-muted/90 px-5 py-2 backdrop-blur">
                        <span className="text-sm font-bold text-secondary-foreground">
                          {chosung}
                        </span>
                        <span className="ml-2 text-xs font-semibold text-muted-foreground">
                          {students.length}명
                        </span>
                      </div>
                      {/* Students in Group */}
                      <div className="divide-y divide-border/60">
                        {students.map(student => (
                          <StudentListItem
                            key={student.id}
                            student={student}
                            isSelected={selectedStudent?.id === student.id}
                            onSelect={() => selectStudent(student)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chosung Jump Navigation */}
              <ChosungJumpNav
                availableChosung={availableChosung}
                activeChosung={activeChosung}
                onJump={handleChosungJump}
                className="sticky top-0 self-start"
              />
            </div>
          )}
        </div>

        {/* Student Detail */}
        {selectedStudent && (
          <div className="w-full lg:w-1/2">
            <div className="sticky top-20 overflow-hidden rounded-2xl bg-card">
              <div className="relative border-b border-border/60 p-5 sm:p-6">
                <button onClick={() => setSelectedStudent(null)} className="absolute right-4 top-4 rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="닫기">
                  <X size={20} />
                </button>
                <div className="flex items-center gap-4">
                  <div className={`flex size-14 items-center justify-center rounded-full ${selectedStudent.gender === 'M' ? 'bg-primary-soft text-primary' : selectedStudent.gender === 'F' ? decorTone.pink : 'bg-muted text-muted-foreground'}`}>
                    <User size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-foreground">{selectedStudent.name}</h2>
                      <Link href={`/students/${selectedStudent.id}`} className="rounded-lg p-2 text-primary transition hover:bg-primary-soft" title="프로필 보기">
                        <ExternalLink size={16} />
                      </Link>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {selectedStudent.gender === 'M' ? '남' : selectedStudent.gender === 'F' ? '여' : '성별 입력 필요'}
                      {selectedStudent.join_date && ` · ${new Date(selectedStudent.join_date).toLocaleDateString('ko-KR')} 등록`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-foreground">
                    <Activity size={18} /> 측정 종목 기록
                  </h3>
                  <button onClick={() => { setShowAddRecord(!showAddRecord); setRecordInputs({}); }}
                    className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${showAddRecord ? 'bg-secondary text-secondary-foreground hover:bg-secondary/70' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
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
                    <RefreshCw size={24} className="animate-spin text-muted-foreground" />
                  </div>
                ) : recordTypes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
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
                      <div className="text-center py-8 text-muted-foreground">
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
