'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calendar, Users, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import {
  StudentRecordCard,
  EventRecordCard,
  RecordModeSelector,
  RecordType,
  Student,
  SlotData,
  ScoreTableData,
  RecordInput,
  InputMode,
  SLOT_LABELS,
  getRoleDisplayName,
} from '@/components/records';

export default function RecordsPage() {
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().split('T')[0]);

  const [currentUser, setCurrentUser] = useState<{
    id: number; name: string; role?: string; position?: string | null; instructorId?: number
  } | null>(null);

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
      let myClassNumInSlot: number | null = null;

      ['morning', 'afternoon', 'evening'].forEach(slot => {
        const slotData = slotsData[slot] as SlotData;
        if (!slotData) return;
        const hasStudents = slotData.classes?.some(c => c.students?.length > 0) ||
                           (slotData.waitingStudents?.length > 0);
        if (hasStudents) {
          availableSlots.push(slot);
          if (myInstructorId) {
            const myClass = slotData.classes?.find(c => c.instructors?.some(i => i.id === myInstructorId));
            if (myClass) {
              mySlot = slot;
              myClassNumInSlot = myClass.class_num;
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
        if (!admin && myClassNumInSlot) return myClassNumInSlot;
        return prev;
      });

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

      const allStudentIds: number[] = [];
      Object.values(slotsData).forEach((slotData) => {
        const sd = slotData as SlotData;
        sd.classes?.forEach(c => c.students?.forEach(s => {
          if (!allStudentIds.includes(s.student_id)) allStudentIds.push(s.student_id);
        }));
        sd.waitingStudents?.forEach(s => {
          if (!allStudentIds.includes(s.student_id)) allStudentIds.push(s.student_id);
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
  }, [measuredAt, loadExistingRecords]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const availableSlots = ['morning', 'afternoon', 'evening'].filter(slot => {
    const slotData = slots[slot] as SlotData;
    if (!slotData) return false;
    return slotData.classes?.some(c => c.students?.length > 0) || slotData.waitingStudents?.length > 0;
  });

  const currentSlotData = slots[selectedSlot] as SlotData | undefined;
  const currentClasses = currentSlotData?.classes || [];

  const getMyStudents = (): Student[] => {
    if (!currentSlotData) return [];
    if (isAdmin) {
      const allStudents: Student[] = [];
      currentSlotData.classes?.forEach(c => c.students && allStudents.push(...c.students));
      if (currentSlotData.waitingStudents) allStudents.push(...currentSlotData.waitingStudents);
      return allStudents;
    }
    if (!selectedTrainerId) return [];
    return currentClasses.find(c => c.class_num === selectedTrainerId)?.students || [];
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
    setInputs(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [recordTypeId]: { value, score } }
    }));
    setSavedStudents(prev => { const n = new Set(prev); n.delete(studentId); return n; });
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
      const n = new Set(prev);
      n.has(studentId) ? n.delete(studentId) : n.add(studentId);
      return n;
    });
  };

  const expandAll = () => setExpandedStudents(new Set(myStudents.map(s => s.student_id)));
  const collapseAll = () => setExpandedStudents(new Set());
  const getDecimalPlaces = (recordTypeId: number) => scoreTablesCache[recordTypeId]?.scoreTable?.decimal_places || 0;

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
              : `${currentUser?.name || ''} ${getRoleDisplayName(currentUser?.role, currentUser?.position)}의 반 학생 기록 입력`}
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
                onClick={() => { setSelectedSlot(slot); if (isAdmin) setSelectedTrainerId(null); }}
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

          {!isAdmin && !selectedTrainerId ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">해당 시간대에 배정된 반이 없습니다.</p>
            </div>
          ) : myStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
              <p className="text-slate-600 font-medium">배정된 학생이 없습니다</p>
            </div>
          ) : (
            <>
              <RecordModeSelector
                inputMode={inputMode}
                setInputMode={setInputMode}
                recordTypes={recordTypes}
                selectedRecordType={selectedRecordType}
                setSelectedRecordType={setSelectedRecordType}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
              />

              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Users size={16} />
                <span>{isAdmin ? '수업 참여 학생 수' : '내 반'}: {myStudents.length}명</span>
              </div>

              {inputMode === 'student' ? (
                <div className="grid grid-cols-2 gap-2">
                  {myStudents.map(student => (
                    <StudentRecordCard
                      key={student.student_id}
                      student={student}
                      recordTypes={recordTypes}
                      inputs={inputs[student.student_id] || {}}
                      isExpanded={expandedStudents.has(student.student_id)}
                      isSaved={savedStudents.has(student.student_id)}
                      onToggle={() => toggleStudent(student.student_id)}
                      onInputChange={(recordTypeId, value) => handleInputChange(student.student_id, recordTypeId, value, student.gender)}
                      onInputBlur={(recordTypeId) => handleInputBlur(student.student_id, recordTypeId)}
                      getDecimalPlaces={getDecimalPlaces}
                    />
                  ))}
                </div>
              ) : currentRecordType && (
                <div>
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
                    {myStudents.map(student => (
                      <EventRecordCard
                        key={student.student_id}
                        student={student}
                        recordTypeId={currentRecordType.id}
                        inputData={inputs[student.student_id]?.[currentRecordType.id] || { value: '', score: null }}
                        decimalPlaces={getDecimalPlaces(currentRecordType.id)}
                        isSaved={savedStudents.has(student.student_id)}
                        onInputChange={(value) => handleInputChange(student.student_id, currentRecordType.id, value, student.gender)}
                        onInputBlur={() => handleInputBlur(student.student_id, currentRecordType.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
