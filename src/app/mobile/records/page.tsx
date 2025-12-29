'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sunrise,
  Sun,
  Moon,
  Check,
  Users,
  Trophy
} from 'lucide-react';
import { authAPI } from '@/lib/api/auth';

interface Student {
  id: number;
  assignment_id: number;
  name: string;
  gender: 'male' | 'female';
  school?: string;
  grade?: string;
  is_trial?: boolean;
  trial_total?: number;
  trial_remaining?: number;
}

interface ClassInstructor {
  id: number;
  name: string;
  isOwner?: boolean;
  isMain?: boolean;
}

interface ClassData {
  class_num: number;
  instructors: ClassInstructor[];
  students: Array<{
    id: number;
    student_id: number;
    student_name: string;
    student_gender: string;
    is_trial?: boolean;
    trial_total?: number;
    trial_remaining?: number;
  }>;
}

interface RecordType {
  id: number;
  name: string;
  short_name?: string;
  unit: string;
  direction: 'higher' | 'lower';
}

interface StudentRecord {
  student_id: number;
  record_type_id: number;
  value: number | null;
  score?: number | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/peak';

const timeSlotConfig = [
  { key: 'morning', label: '오전', icon: Sunrise },
  { key: 'afternoon', label: '오후', icon: Sun },
  { key: 'evening', label: '저녁', icon: Moon },
];

export default function MobileRecordsPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('morning');
  const [students, setStudents] = useState<Student[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [records, setRecords] = useState<Record<string, StudentRecord>>({});
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'student' | 'type'>('student');
  const [selectedType, setSelectedType] = useState<number | null>(null);
  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = authAPI.getToken();
      const headers = { Authorization: `Bearer ${token}` };

      // 반 배치 데이터 로드
      const assignRes = await fetch(
        `${API_BASE}/assignments?date=${selectedDate}`,
        { headers }
      );
      const assignData = await assignRes.json();

      // 시간대별 학생 필터링 (v2.0.0 새 구조)
      const slotData = assignData.slots?.[selectedTimeSlot];
      const slotStudents: Student[] = [];

      // 현재 유저 정보
      const currentUser = authAPI.getCurrentUser();
      const userIsOwnerOrAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin';
      const userInstructorId = currentUser?.instructorId;
      // 원장의 경우 음수 ID 사용 (-user.id)
      const userNegativeId = currentUser?.role === 'owner' ? -(currentUser?.id || 0) : null;

      if (slotData) {
        // 반에 배치된 학생들 - 강사 필터링 적용
        (slotData.classes as ClassData[] || []).forEach((cls) => {
          // 원장/관리자이거나, 내가 이 반의 강사인 경우에만 학생 포함
          const isMyClass = userIsOwnerOrAdmin ||
            cls.instructors?.some((inst: ClassInstructor) =>
              inst.id === userInstructorId || inst.id === userNegativeId
            );

          if (isMyClass) {
            cls.students?.forEach(s => {
              slotStudents.push({
                id: s.student_id,
                assignment_id: s.id,
                name: s.student_name,
                gender: s.student_gender as 'male' | 'female',
                is_trial: s.is_trial,
                trial_total: s.trial_total,
                trial_remaining: s.trial_remaining,
              });
            });
          }
        });

        // 대기 중인 학생들 - 원장/관리자만 볼 수 있음
        if (userIsOwnerOrAdmin) {
          slotData.waitingStudents?.forEach((s: { id: number; student_id: number; student_name: string; student_gender: string; is_trial?: boolean; trial_total?: number; trial_remaining?: number }) => {
            slotStudents.push({
              id: s.student_id,
              assignment_id: s.id,
              name: s.student_name,
              gender: s.student_gender as 'male' | 'female',
              is_trial: s.is_trial,
              trial_total: s.trial_total,
              trial_remaining: s.trial_remaining,
            });
          });
        }
      }

      setStudents(slotStudents);

      // 종목 로드
      const typeRes = await fetch(`${API_BASE}/record-types`, { headers });
      const typeData = await typeRes.json();
      const activeTypes = (typeData.recordTypes || []).filter((t: { is_active: boolean }) => t.is_active);
      setRecordTypes(activeTypes);

      // 기존 선택이 유효하면 유지, 없으면 첫 번째 종목 선택
      setSelectedType(prev => {
        if (prev && activeTypes.some((t: RecordType) => t.id === prev)) return prev;
        return activeTypes.length > 0 ? activeTypes[0].id : null;
      });

      // 기록 로드
      if (slotStudents.length > 0) {
        const studentIds = slotStudents.map((s: Student) => s.id).join(',');
        const recRes = await fetch(
          `${API_BASE}/records/by-date?date=${selectedDate}&student_ids=${studentIds}`,
          { headers }
        );
        const recData = await recRes.json();

        const recordMap: Record<string, StudentRecord> = {};
        (recData.records || []).forEach((r: StudentRecord) => {
          const key = `${r.student_id}-${r.record_type_id}`;
          recordMap[key] = r;
        });
        setRecords(recordMap);
      } else {
        setRecords({});
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTimeSlot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 기록 저장
  const saveRecord = async (studentId: number, recordTypeId: number, value: string) => {
    const key = `${studentId}-${recordTypeId}`;
    setSaving(key);

    try {
      const token = authAPI.getToken();
      const numValue = value === '' ? null : parseFloat(value);

      const response = await fetch(`${API_BASE}/records/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          records: [
            {
              student_id: studentId,
              record_type_id: recordTypeId,
              value: numValue,
              measured_at: selectedDate,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const saved = data.results?.[0];
        if (saved) {
          setRecords(prev => ({
            ...prev,
            [key]: {
              student_id: studentId,
              record_type_id: recordTypeId,
              value: numValue,
              score: saved.score,
            },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setTimeout(() => setSaving(null), 500);
    }
  };

  // 학생 펼치기/접기
  const toggleStudent = (studentId: number) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // 전체 펼치기/접기
  const toggleAll = () => {
    if (expandedStudents.size === students.length) {
      setExpandedStudents(new Set());
    } else {
      setExpandedStudents(new Set(students.map(s => s.id)));
    }
  };

  const koreanDate = format(new Date(selectedDate), 'M월 d일 (E)', { locale: ko });

  return (
    <div className="space-y-3">
      {/* 날짜 & 새로고침 */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-medium text-slate-800 bg-transparent border-none outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{koreanDate}</span>
          <button
            onClick={loadData}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-orange-500' : 'text-slate-500'} />
          </button>
        </div>
      </div>

      {/* 시간대 탭 */}
      <div className="flex gap-2">
        {timeSlotConfig.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSelectedTimeSlot(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl font-medium text-sm transition ${
              selectedTimeSlot === key
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 입력 모드 선택 */}
      <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm">
        <button
          onClick={() => setInputMode('student')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition ${
            inputMode === 'student'
              ? 'bg-slate-800 text-white'
              : 'text-slate-600'
          }`}
        >
          <Users size={16} />
          <span>학생별</span>
        </button>
        <button
          onClick={() => setInputMode('type')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition ${
            inputMode === 'type'
              ? 'bg-slate-800 text-white'
              : 'text-slate-600'
          }`}
        >
          <Trophy size={16} />
          <span>종목별</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-orange-500" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-slate-500 text-sm">배치된 학생이 없습니다</p>
        </div>
      ) : inputMode === 'student' ? (
        /* 학생별 모드 */
        <div className="space-y-2">
          {/* 전체 펼치기/접기 */}
          <button
            onClick={toggleAll}
            className="text-xs text-slate-500 underline"
          >
            {expandedStudents.size === students.length ? '전체 접기' : '전체 펼치기'}
          </button>

          {students.map((student) => {
            const isExpanded = expandedStudents.has(student.id);
            return (
              <div key={student.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* 학생 헤더 */}
                <button
                  onClick={() => toggleStudent(student.id)}
                  className="w-full flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      student.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-slate-800 text-sm">{student.name}</p>
                        {!!student.is_trial && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                            {(student.trial_total || 0) - (student.trial_remaining || 0)}/{student.trial_total || 0}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {student.gender === 'male' ? '남' : '여'}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={20} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                  )}
                </button>

                {/* 기록 입력 영역 */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
                    {recordTypes.map((type) => {
                      const key = `${student.id}-${type.id}`;
                      const record = records[key];
                      const isSaving = saving === key;

                      return (
                        <div key={type.id} className="flex items-center gap-2 pt-2">
                          <span className="text-xs text-slate-600 w-20 truncate">
                            {type.short_name || type.name}
                          </span>
                          <div className="flex-1 relative">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="기록"
                              defaultValue={record?.value ?? ''}
                              onBlur={(e) => saveRecord(student.id, type.id, e.target.value)}
                              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                            />
                            {isSaving && (
                              <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                            )}
                          </div>
                          <span className="text-xs text-slate-400 w-8">{type.unit}</span>
                          {record?.score != null && (
                            <span className="text-xs font-medium text-orange-500 w-10 text-right">
                              {record.score}점
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 종목별 모드 */
        <div className="space-y-3">
          {/* 종목 선택 탭 */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {recordTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  selectedType === type.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-slate-600'
                }`}
              >
                {type.short_name || type.name}
              </button>
            ))}
          </div>

          {/* 학생별 입력 리스트 */}
          <div className="bg-white rounded-xl shadow-sm divide-y divide-slate-100">
            {students.map((student) => {
              if (!selectedType) return null;
              const key = `${student.id}-${selectedType}`;
              const record = records[key];
              const type = recordTypes.find(t => t.id === selectedType);
              const isSaving = saving === key;

              return (
                <div key={student.id} className="flex items-center gap-2 p-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                    student.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'
                  }`}>
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-slate-800 text-sm truncate">{student.name}</p>
                      {!!student.is_trial && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700 flex-shrink-0">
                          {(student.trial_total || 0) - (student.trial_remaining || 0)}/{student.trial_total || 0}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="기록"
                      defaultValue={record?.value ?? ''}
                      onBlur={(e) => saveRecord(student.id, selectedType, e.target.value)}
                      className="w-20 h-10 px-2 text-sm text-right border border-slate-200 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                    {isSaving && (
                      <Check size={14} className="text-green-500" />
                    )}
                    <span className="text-xs text-slate-400 w-6">{type?.unit}</span>
                  </div>
                  {record?.score != null && (
                    <span className="text-xs font-medium text-orange-500 w-10 text-right">
                      {record.score}점
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
