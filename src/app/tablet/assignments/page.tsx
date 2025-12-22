'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Users, RefreshCw, AlertCircle, Coffee, Sunrise, Sun, Moon, Download, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api/client';
import { useOrientation } from '../layout';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface Student {
  id: number;
  student_id: number;
  student_name: string;
  gender: 'M' | 'F';
  school: string | null;
  grade: string | null;
  is_trial: boolean;
  trial_total: number;
  trial_remaining: number;
  status: 'enrolled' | 'trial' | 'rest' | 'injury';
}

interface TrainerColumn {
  trainer_id: number | null;
  trainer_name: string;
  students: Student[];
}

interface SlotData {
  instructors: { id: number; name: string }[];
  trainers: TrainerColumn[];
}

interface SlotsData {
  morning: SlotData;
  afternoon: SlotData;
  evening: SlotData;
}

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: typeof Sun; color: string; bgColor: string }> = {
  morning: { label: '오전', icon: Sunrise, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  afternoon: { label: '오후', icon: Sun, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  evening: { label: '저녁', icon: Moon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

// 학생 카드 컴포넌트 (터치 최적화)
function StudentCard({ student, isDragging }: { student: Student; isDragging?: boolean }) {
  const genderColor = student.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700';
  const statusIcon = student.status === 'rest' ? <Coffee size={16} /> :
                     student.status === 'injury' ? <AlertCircle size={16} /> : null;

  return (
    <div
      className={`p-4 bg-white rounded-xl border-2 border-transparent shadow-sm transition touch-draggable ${
        isDragging ? 'opacity-50 border-orange-400 shadow-lg scale-105' : 'active:border-orange-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`px-2.5 py-1 rounded-lg text-sm font-medium ${genderColor}`}>
          {student.gender === 'M' ? '남' : '여'}
        </span>
        <span className="font-medium text-slate-800 text-lg">{student.student_name}</span>
        <Link
          href={`/tablet/students/${student.student_id}`}
          className="p-2 hover:bg-orange-100 rounded-lg transition"
          title="프로필 보기"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ExternalLink size={16} className="text-orange-500" />
        </Link>
        {!!student.is_trial && (
          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">
            체험 {student.trial_total - student.trial_remaining + 1}/{student.trial_total}
          </span>
        )}
        {statusIcon && <span className="ml-auto text-slate-400">{statusIcon}</span>}
      </div>
      {(student.school || student.grade) && (
        <p className="text-sm text-slate-400 mt-2 ml-11">
          {student.school}{student.school && student.grade && ' '}{student.grade}
        </p>
      )}
    </div>
  );
}

// 드래그 가능한 학생 카드
function DraggableStudent({ student }: { student: Student }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `student-${student.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StudentCard student={student} isDragging={isDragging} />
    </div>
  );
}

// 트레이너 컬럼 컴포넌트
function TrainerColumnComponent({
  column,
  isUnassigned = false,
  orientation
}: {
  column: TrainerColumn;
  isUnassigned?: boolean;
  orientation: 'portrait' | 'landscape';
}) {
  const columnId = column.trainer_id?.toString() ?? 'unassigned';
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const bgColor = isUnassigned ? 'bg-slate-100' : 'bg-orange-50';
  const headerColor = isUnassigned ? 'bg-slate-600' : 'bg-orange-500';

  // 세로모드: 2컬럼, 가로모드: 가로 스크롤
  const columnWidth = orientation === 'portrait' ? 'w-full' : 'w-80 flex-shrink-0';
  const maxHeight = orientation === 'portrait' ? 'max-h-[400px]' : 'max-h-[calc(100vh-300px)]';

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col ${columnWidth} ${maxHeight} rounded-xl ${bgColor} ${
        isOver ? 'ring-2 ring-orange-400 ring-offset-2' : ''
      }`}
    >
      {/* 헤더 */}
      <div className={`${headerColor} text-white px-5 py-4 rounded-t-xl flex-shrink-0`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} />
            <span className="font-semibold text-lg">{column.trainer_name}</span>
          </div>
          <span className="px-3 py-1 bg-white/20 rounded-full text-base font-medium">
            {column.students.length}명
          </span>
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="flex-1 p-3 overflow-y-auto min-h-[150px]">
        <SortableContext
          items={column.students.map(s => `student-${s.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {column.students.map((student) => (
              <DraggableStudent key={student.id} student={student} />
            ))}
          </div>
        </SortableContext>

        {column.students.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-400 text-base py-8">
            학생을 드래그하여 배치하세요
          </div>
        )}
      </div>
    </div>
  );
}

export default function TabletAssignmentsPage() {
  const orientation = useOrientation();
  const [slotsData, setSlotsData] = useState<SlotsData>({
    morning: { instructors: [], trainers: [] },
    afternoon: { instructors: [], trainers: [] },
    evening: { instructors: [], trainers: [] }
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');

  // 날짜 선택
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const formatDateKorean = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 터치 센서 (터치 디바이스 최적화)
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 터치 유지 시간
        tolerance: 5, // 이동 허용치
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: { distance: 10 },
    })
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const assignmentsRes = await apiClient.get(`/assignments?date=${selectedDate}`);

      const slots = assignmentsRes.data.slots || {
        morning: { instructors: [], trainers: [] },
        afternoon: { instructors: [], trainers: [] },
        evening: { instructors: [], trainers: [] }
      };

      setSlotsData({
        morning: { instructors: slots.morning.instructors || [], trainers: slots.morning.trainers || [] },
        afternoon: { instructors: slots.afternoon.instructors || [], trainers: slots.afternoon.trainers || [] },
        evening: { instructors: slots.evening.instructors || [], trainers: slots.evening.trainers || [] }
      });

      const hasStudents = (slot: SlotData) => slot.trainers.some(t => t.students.length > 0);
      if (hasStudents(slots.evening)) setActiveSlot('evening');
      else if (hasStudents(slots.afternoon)) setActiveSlot('afternoon');
      else if (hasStudents(slots.morning)) setActiveSlot('morning');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await apiClient.post('/assignments/sync', { date: selectedDate });
      await fetchData();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const currentColumns = slotsData[activeSlot].trainers;

  const findStudent = (id: string): Student | null => {
    const studentId = parseInt(id.replace('student-', ''));
    for (const col of currentColumns) {
      const found = col.students.find(s => s.id === studentId);
      if (found) return found;
    }
    return null;
  };

  const findColumn = (studentId: string): TrainerColumn | null => {
    const id = parseInt(studentId.replace('student-', ''));
    for (const col of currentColumns) {
      if (col.students.some(s => s.id === id)) return col;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const student = findStudent(event.active.id as string);
    setActiveStudent(student);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStudent(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceColumn = findColumn(activeId);
    if (!sourceColumn) return;

    let targetColumn: TrainerColumn | null = null;
    let targetTrainerId: number | null = null;

    if (overId.startsWith('student-')) {
      targetColumn = findColumn(overId);
    } else {
      targetColumn = currentColumns.find(c =>
        (c.trainer_id === null && overId === 'unassigned') ||
        c.trainer_id?.toString() === overId
      ) || null;
    }

    if (!targetColumn || sourceColumn === targetColumn) return;

    targetTrainerId = targetColumn.trainer_id;
    const student = findStudent(activeId);
    if (!student) return;

    // UI 즉시 업데이트
    setSlotsData(prev => {
      const newSlots = { ...prev };
      const newTrainers = newSlots[activeSlot].trainers.map(col => ({
        ...col,
        students: col.students.filter(s => s.id !== student.id)
      }));

      const targetIdx = newTrainers.findIndex(c => c.trainer_id === targetTrainerId);
      if (targetIdx !== -1) {
        newTrainers[targetIdx].students.push(student);
      }

      newSlots[activeSlot] = {
        instructors: newSlots[activeSlot].instructors,
        trainers: newTrainers
      };
      return newSlots;
    });

    // API 호출
    try {
      await apiClient.put(`/assignments/${student.id}`, {
        trainer_id: targetTrainerId,
        status: student.status,
        order_num: 0,
        time_slot: activeSlot
      });
    } catch (error) {
      console.error('Failed to update assignment:', error);
      fetchData();
    }
  };

  const getSlotStudentCount = (slot: TimeSlot) => {
    return slotsData[slot].trainers.reduce((sum, col) => sum + col.students.length, 0);
  };

  const totalStudents = currentColumns.reduce((sum, col) => sum + col.students.length, 0);
  const assignedStudents = currentColumns
    .filter(col => col.trainer_id !== null)
    .reduce((sum, col) => sum + col.students.length, 0);

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">반 배치</h1>
          <p className="text-slate-500 text-sm mt-1">{formatDateKorean(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 날짜 선택 */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border-none focus:ring-0 text-slate-700 text-sm bg-transparent"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-3 text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition disabled:opacity-50"
          >
            <Download size={18} className={syncing ? 'animate-bounce' : ''} />
            <span className="text-sm font-medium">동기화</span>
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 배정 현황 */}
      <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex items-center justify-between">
        <span className="text-slate-500 text-sm">배정 현황</span>
        <span className="font-bold text-orange-500 text-lg">{assignedStudents}/{totalStudents}명</span>
      </div>

      {/* 시간대 탭 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(Object.keys(TIME_SLOT_INFO) as TimeSlot[]).map((slot) => {
          const info = TIME_SLOT_INFO[slot];
          const Icon = info.icon;
          const count = getSlotStudentCount(slot);
          const isActive = activeSlot === slot;

          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition flex-shrink-0 ${
                isActive
                  ? `${info.bgColor} ${info.color} ring-2 ring-offset-2`
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{info.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-sm ${
                isActive ? 'bg-white/50' : 'bg-slate-100'
              }`}>
                {count}명
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw size={40} className="animate-spin text-slate-400" />
        </div>
      ) : totalStudents === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <p className="text-lg mb-4">오늘 {TIME_SLOT_INFO[activeSlot].label} 수업에 배정된 학생이 없습니다.</p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-6 py-4 text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition text-base"
          >
            <Download size={22} />
            <span>P-ACA에서 스케줄 가져오기</span>
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* 세로모드: 2컬럼 그리드, 가로모드: 가로 스크롤 */}
          <div className={
            orientation === 'portrait'
              ? 'grid grid-cols-2 gap-4'
              : 'flex gap-4 overflow-x-auto pb-4'
          }>
            {currentColumns.map((column) => (
              <TrainerColumnComponent
                key={column.trainer_id ?? 'unassigned'}
                column={column}
                isUnassigned={column.trainer_id === null}
                orientation={orientation}
              />
            ))}
          </div>

          <DragOverlay>
            {activeStudent && <StudentCard student={activeStudent} isDragging />}
          </DragOverlay>
        </DndContext>
      )}

      {/* 범례 */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">남</span>
          <span>남학생</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-lg text-xs font-medium">여</span>
          <span>여학생</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">체험</span>
          <span>체험생</span>
        </div>
        <div className="flex items-center gap-2">
          <Coffee size={16} />
          <span>휴식</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle size={16} />
          <span>부상</span>
        </div>
      </div>
    </div>
  );
}
