'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Users, RefreshCw, Download, Calendar, Star, Crown, Plus, ExternalLink } from 'lucide-react';
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
  attendance_status?: 'scheduled' | 'present' | 'absent' | 'late' | 'early_leave';
  absence_reason?: string | null;
}

interface Instructor {
  id: number;
  name: string;
  isOwner: boolean;
  isMain?: boolean;
  order_num?: number;
}

interface ClassData {
  class_num: number;
  instructors: Instructor[];
  students: Student[];
}

interface SlotData {
  waitingStudents: Student[];
  waitingInstructors: Instructor[];
  classes: ClassData[];
}

interface SlotsData {
  morning: SlotData;
  afternoon: SlotData;
  evening: SlotData;
}

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; color: string; bgColor: string }> = {
  morning: { label: '오전', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  afternoon: { label: '오후', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  evening: { label: '저녁', color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

// 컴팩트 학생 카드
function CompactStudentCard({ student, isDragging }: { student: Student; isDragging?: boolean }) {
  const genderColor = student.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700';
  const isAbsent = student.attendance_status === 'absent';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition touch-none ${
        isDragging ? 'opacity-50 border-orange-400 shadow-lg scale-105' : ''
      } ${isAbsent ? 'opacity-60 border-red-200 bg-red-50' : 'hover:border-slate-300'}`}
    >
      <span className={`px-2 py-1 rounded text-xs font-medium ${genderColor}`}>
        {student.gender === 'M' ? '남' : '여'}
      </span>
      <span className={`font-medium text-base truncate max-w-[80px] ${isAbsent ? 'line-through text-slate-400' : 'text-slate-800'}`}>
        {student.student_name}
      </span>
      {isAbsent && (
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">결석</span>
      )}
      <Link
        href={`/tablet/students/${student.student_id}`}
        className="p-1 hover:bg-orange-100 rounded transition"
        title="프로필"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ExternalLink size={14} className="text-orange-500" />
      </Link>
      {!isAbsent && !!student.is_trial && (
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
          {student.trial_total - student.trial_remaining}/{student.trial_total}
        </span>
      )}
      {isAbsent && student.absence_reason && (
        <span className="text-xs text-red-500 truncate max-w-[60px]" title={student.absence_reason}>
          ({student.absence_reason})
        </span>
      )}
    </div>
  );
}

// 드래그 가능한 학생
function DraggableStudent({ student }: { student: Student }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { type: 'student', student }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CompactStudentCard student={student} isDragging={isDragging} />
    </div>
  );
}

// 강사 칩
function InstructorChip({ instructor, isDragging, showMain = false }: { instructor: Instructor; isDragging?: boolean; showMain?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-grab active:cursor-grabbing transition touch-none ${
        isDragging
          ? 'bg-orange-200 border-orange-400 shadow-lg scale-105'
          : 'bg-orange-50 border-orange-200 hover:bg-orange-100'
      }`}
    >
      {showMain && instructor.isMain && (
        <Star size={14} className="text-orange-500 fill-orange-500" />
      )}
      {instructor.isOwner && (
        <Crown size={14} className="text-amber-500" />
      )}
      <span className="text-base font-medium text-orange-700">{instructor.name}</span>
    </div>
  );
}

// 드래그 가능한 강사
function DraggableInstructor({ instructor, showMain = false }: { instructor: Instructor; showMain?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `instructor-${instructor.id}`,
    data: { type: 'instructor', instructor }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <InstructorChip instructor={instructor} isDragging={isDragging} showMain={showMain} />
    </div>
  );
}

// 대기 영역
function WaitingArea({
  waitingStudents,
  waitingInstructors,
  orientation
}: {
  waitingStudents: Student[];
  waitingInstructors: Instructor[];
  orientation: 'portrait' | 'landscape';
}) {
  const { setNodeRef: setStudentRef, isOver: isOverStudents } = useDroppable({ id: 'waiting-students' });
  const { setNodeRef: setInstructorRef, isOver: isOverInstructors } = useDroppable({ id: 'waiting-instructors' });

  return (
    <div className="bg-slate-50 rounded-xl p-4 mb-4">
      <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* 학생 대기 */}
        <div
          ref={setStudentRef}
          className={`bg-white rounded-lg p-4 min-h-[100px] transition ${
            isOverStudents ? 'ring-2 ring-blue-400 bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center gap-2 mb-3 text-slate-600">
            <Users size={18} />
            <span className="text-base font-medium">학생 대기</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-sm">{waitingStudents.length}명</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {waitingStudents.map((student) => (
              <DraggableStudent key={student.id} student={student} />
            ))}
            {waitingStudents.length === 0 && (
              <span className="text-slate-400">대기 중인 학생 없음</span>
            )}
          </div>
        </div>

        {/* 강사 대기 */}
        <div
          ref={setInstructorRef}
          className={`bg-white rounded-lg p-4 min-h-[100px] transition ${
            isOverInstructors ? 'ring-2 ring-orange-400 bg-orange-50' : ''
          }`}
        >
          <div className="flex items-center gap-2 mb-3 text-slate-600">
            <Users size={18} />
            <span className="text-base font-medium">강사 대기</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-sm">{waitingInstructors.length}명</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {waitingInstructors.map((instructor) => (
              <DraggableInstructor key={instructor.id} instructor={instructor} />
            ))}
            {waitingInstructors.length === 0 && (
              <span className="text-slate-400">대기 중인 강사 없음</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 반 컬럼
function ClassColumn({ classData, orientation }: { classData: ClassData; orientation: 'portrait' | 'landscape' }) {
  const { setNodeRef: setStudentRef, isOver: isOverStudents } = useDroppable({
    id: `class-${classData.class_num}-students`
  });
  const { setNodeRef: setInstructorRef, isOver: isOverInstructors } = useDroppable({
    id: `class-${classData.class_num}-instructors`
  });

  const columnWidth = orientation === 'landscape' ? 'w-56' : 'w-52';

  // 주강사 이름으로 반 이름 생성
  const mainInstructor = classData.instructors.find(i => i.isMain);
  const className = mainInstructor ? `${mainInstructor.name}T` : `${classData.class_num}반`;

  return (
    <div className={`flex flex-col ${columnWidth} bg-white rounded-xl shadow-sm border overflow-hidden`}>
      {/* 헤더 */}
      <div className="bg-orange-500 text-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-lg truncate">{className}</span>
          <span className="text-sm bg-white/20 px-2 py-0.5 rounded shrink-0">
            {classData.students.length}명
          </span>
        </div>
      </div>

      {/* 강사 영역 */}
      <div
        ref={setInstructorRef}
        className={`p-3 bg-orange-50 border-b min-h-[50px] transition ${
          isOverInstructors ? 'ring-2 ring-inset ring-orange-400 bg-orange-100' : ''
        }`}
      >
        <div className="flex flex-wrap gap-1.5">
          {classData.instructors.map((inst) => (
            <DraggableInstructor key={inst.id} instructor={inst} showMain />
          ))}
          {classData.instructors.length === 0 && (
            <span className="text-orange-400 text-sm">강사 배치 필요</span>
          )}
        </div>
      </div>

      {/* 학생 영역 */}
      <div
        ref={setStudentRef}
        className={`flex-1 p-3 min-h-[150px] max-h-[350px] overflow-y-auto transition ${
          isOverStudents ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''
        }`}
      >
        <div className="space-y-2">
          {classData.students.map((student) => (
            <DraggableStudent key={student.id} student={student} />
          ))}
          {classData.students.length === 0 && (
            <div className="text-slate-400 text-sm text-center py-6">
              학생을 드래그하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 새 반 생성 드롭존
function NewClassZone({ orientation }: { orientation: 'portrait' | 'landscape' }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'new-class' });
  const columnWidth = orientation === 'landscape' ? 'w-56' : 'w-52';

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center justify-center ${columnWidth} min-h-[250px] rounded-xl border-2 border-dashed transition ${
        isOver
          ? 'border-orange-400 bg-orange-50'
          : 'border-slate-300 bg-slate-50 hover:border-slate-400'
      }`}
    >
      <Plus size={40} className={isOver ? 'text-orange-500' : 'text-slate-400'} />
      <span className={`mt-3 text-base font-medium ${isOver ? 'text-orange-600' : 'text-slate-500'}`}>
        새 반 생성
      </span>
      <span className="text-sm text-slate-400 mt-1">강사를 드롭하세요</span>
    </div>
  );
}

export default function TabletAssignmentsPage() {
  const orientation = useOrientation();
  const [slotsData, setSlotsData] = useState<SlotsData>({
    morning: { waitingStudents: [], waitingInstructors: [], classes: [] },
    afternoon: { waitingStudents: [], waitingInstructors: [], classes: [] },
    evening: { waitingStudents: [], waitingInstructors: [], classes: [] }
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeItem, setActiveItem] = useState<{ type: 'student' | 'instructor'; data: Student | Instructor } | null>(null);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('evening');

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  const formatDateKorean = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  // 터치 센서 최적화
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 }
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/assignments?date=${selectedDate}`);
      const slots = res.data.slots || {
        morning: { waitingStudents: [], waitingInstructors: [], classes: [] },
        afternoon: { waitingStudents: [], waitingInstructors: [], classes: [] },
        evening: { waitingStudents: [], waitingInstructors: [], classes: [] }
      };
      setSlotsData(slots);

      const hasStudents = (slot: SlotData) =>
        slot.waitingStudents.length > 0 || slot.classes.some(c => c.students.length > 0);

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

  const currentSlotData = slotsData[activeSlot];

  const getNextClassNum = () => {
    const classNums = currentSlotData.classes.map(c => c.class_num);
    return classNums.length > 0 ? Math.max(...classNums) + 1 : 1;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.type === 'student') {
      setActiveItem({ type: 'student', data: data.student });
    } else if (data?.type === 'instructor') {
      setActiveItem({ type: 'instructor', data: data.instructor });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const overId = over.id as string;
    const data = active.data.current;

    try {
      if (data?.type === 'student') {
        const student = data.student as Student;

        if (overId === 'waiting-students') {
          await apiClient.put(`/assignments/${student.id}`, { class_id: null });
        } else if (overId.startsWith('class-') && overId.endsWith('-students')) {
          const classNum = parseInt(overId.split('-')[1]);
          await apiClient.put(`/assignments/${student.id}`, { class_id: classNum });
        }
      }

      if (data?.type === 'instructor') {
        const instructor = data.instructor as Instructor;

        if (overId === 'waiting-instructors') {
          await apiClient.post('/assignments/instructor', {
            date: selectedDate,
            time_slot: activeSlot,
            instructor_id: instructor.id,
            to_class_num: null
          });
        } else if (overId.startsWith('class-') && overId.endsWith('-instructors')) {
          const classNum = parseInt(overId.split('-')[1]);
          await apiClient.post('/assignments/instructor', {
            date: selectedDate,
            time_slot: activeSlot,
            instructor_id: instructor.id,
            to_class_num: classNum,
            is_main: false
          });
        } else if (overId === 'new-class') {
          const newClassNum = getNextClassNum();
          await apiClient.post('/assignments/instructor', {
            date: selectedDate,
            time_slot: activeSlot,
            instructor_id: instructor.id,
            to_class_num: newClassNum,
            is_main: true
          });
        }
      }

      await fetchData();
    } catch (error) {
      console.error('Failed to update:', error);
    }
  };

  const getSlotStudentCount = (slot: TimeSlot) => {
    const data = slotsData[slot];
    return data.waitingStudents.length + data.classes.reduce((sum, c) => sum + c.students.length, 0);
  };

  const totalStudents = currentSlotData.waitingStudents.length +
    currentSlotData.classes.reduce((sum, c) => sum + c.students.length, 0);
  const assignedStudents = currentSlotData.classes.reduce((sum, c) => sum + c.students.length, 0);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">반 배치</h1>
          <p className="text-slate-500 text-sm">{formatDateKorean(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border-none focus:ring-0 text-slate-700 text-sm w-32"
            />
          </div>
          <div className="px-3 py-2 bg-white rounded-lg shadow-sm">
            <span className="text-slate-500 text-sm">배정</span>
            <span className="ml-2 font-bold text-orange-500">{assignedStudents}/{totalStudents}</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-500 rounded-lg min-h-12"
          >
            <Download size={18} className={syncing ? 'animate-bounce' : ''} />
            <span>동기화</span>
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 text-slate-600 bg-white border rounded-lg min-h-12"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 시간대 탭 */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(TIME_SLOT_INFO) as TimeSlot[]).map((slot) => {
          const info = TIME_SLOT_INFO[slot];
          const count = getSlotStudentCount(slot);
          const isActive = activeSlot === slot;

          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg transition min-h-12 ${
                isActive
                  ? `${info.bgColor} ${info.color} ring-2 ring-offset-1`
                  : 'bg-white text-slate-500'
              }`}
            >
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
        <div className="flex items-center justify-center h-96">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : totalStudents === 0 && currentSlotData.waitingInstructors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
          <p className="text-lg mb-4">{TIME_SLOT_INFO[activeSlot].label} 수업 데이터가 없습니다.</p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-6 py-3 text-white bg-blue-500 rounded-lg min-h-12"
          >
            <Download size={20} />
            <span>P-ACA에서 가져오기</span>
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <WaitingArea
            waitingStudents={currentSlotData.waitingStudents}
            waitingInstructors={currentSlotData.waitingInstructors}
            orientation={orientation}
          />

          <div className="flex flex-wrap gap-4">
            {currentSlotData.classes.map((classData) => (
              <ClassColumn key={classData.class_num} classData={classData} orientation={orientation} />
            ))}
            <NewClassZone orientation={orientation} />
          </div>

          <DragOverlay>
            {activeItem?.type === 'student' && (
              <CompactStudentCard student={activeItem.data as Student} isDragging />
            )}
            {activeItem?.type === 'instructor' && (
              <InstructorChip instructor={activeItem.data as Instructor} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* 범례 */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">남</span>
          <span>남학생</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">여</span>
          <span>여학생</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">1/2</span>
          <span>체험</span>
        </div>
        <div className="flex items-center gap-2">
          <Star size={14} className="text-orange-500 fill-orange-500" />
          <span>주강사</span>
        </div>
        <div className="flex items-center gap-2">
          <Crown size={14} className="text-amber-500" />
          <span>원장</span>
        </div>
      </div>
    </div>
  );
}
