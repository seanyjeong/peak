'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
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
import { Users, RefreshCw, UserPlus, AlertCircle, Coffee } from 'lucide-react';
import apiClient from '@/lib/api/client';

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
  status: 'training' | 'rest' | 'injury';
}

interface TrainerColumn {
  trainer_id: number | null;
  trainer_name: string;
  students: Student[];
}

interface Trainer {
  id: number;
  name: string;
}

// 학생 카드 컴포넌트
function StudentCard({ student, isDragging }: { student: Student; isDragging?: boolean }) {
  const genderColor = student.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700';
  const statusIcon = student.status === 'rest' ? <Coffee size={14} /> :
                     student.status === 'injury' ? <AlertCircle size={14} /> : null;

  return (
    <div
      className={`p-3 bg-white rounded-lg border-2 border-transparent shadow-sm cursor-grab active:cursor-grabbing transition ${
        isDragging ? 'opacity-50 border-orange-400 shadow-lg' : 'hover:border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${genderColor}`}>
          {student.gender === 'M' ? '남' : '여'}
        </span>
        <span className="font-medium text-slate-800">{student.student_name}</span>
        {!!student.is_trial && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
            체험 {student.trial_total - student.trial_remaining + 1}/{student.trial_total}
          </span>
        )}
        {statusIcon && <span className="ml-auto text-slate-400">{statusIcon}</span>}
      </div>
      {(student.school || student.grade) && (
        <p className="text-xs text-slate-400 mt-1 ml-9">
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
  isUnassigned = false
}: {
  column: TrainerColumn;
  isUnassigned?: boolean;
}) {
  const columnId = column.trainer_id?.toString() ?? 'unassigned';
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const bgColor = isUnassigned ? 'bg-slate-100' : 'bg-orange-50';
  const headerColor = isUnassigned ? 'bg-slate-600' : 'bg-orange-500';

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 rounded-xl overflow-hidden ${bgColor} ${
        isOver ? 'ring-2 ring-orange-400 ring-offset-2' : ''
      }`}
    >
      {/* Header */}
      <div className={`${headerColor} text-white px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <span className="font-semibold">{column.trainer_name}</span>
          </div>
          <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
            {column.students.length}명
          </span>
        </div>
      </div>

      {/* Students */}
      <div className="flex-1 p-3 min-h-[300px]">
        <SortableContext
          items={column.students.map(s => `student-${s.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {column.students.map((student) => (
              <DraggableStudent key={student.id} student={student} />
            ))}
          </div>
        </SortableContext>

        {column.students.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            학생을 드래그하여 배치하세요
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const [columns, setColumns] = useState<TrainerColumn[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  // 로컬 날짜 (KST) - API 호출용
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateStr = getLocalDateString();

      // 트레이너 목록 & 오늘 배치 현황 조회
      const [trainersRes, assignmentsRes] = await Promise.all([
        apiClient.get('/trainers'),
        apiClient.get(`/assignments?date=${dateStr}`)
      ]);

      const trainerList = trainersRes.data.trainers || [];
      setTrainers(trainerList);

      let assignmentData = assignmentsRes.data.assignments || [];

      // 배치 데이터가 없으면 초기화
      if (assignmentData.length === 0) {
        await apiClient.post('/assignments/init', { date: dateStr });
        const refreshRes = await apiClient.get(`/assignments?date=${dateStr}`);
        assignmentData = refreshRes.data.assignments || [];
      }

      // 미배정 컬럼 + 트레이너별 컬럼 구성
      const unassigned = assignmentData.find((c: TrainerColumn) => !c.trainer_id) || {
        trainer_id: null,
        trainer_name: '미배정',
        students: []
      };

      const trainerColumns = trainerList.map((t: Trainer) => {
        const existing = assignmentData.find((c: TrainerColumn) => c.trainer_id === t.id);
        return existing || {
          trainer_id: t.id,
          trainer_name: t.name,
          students: []
        };
      });

      setColumns([unassigned, ...trainerColumns]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const findStudent = (id: string): Student | null => {
    const studentId = parseInt(id.replace('student-', ''));
    for (const col of columns) {
      const found = col.students.find(s => s.id === studentId);
      if (found) return found;
    }
    return null;
  };

  const findColumn = (studentId: string): TrainerColumn | null => {
    const id = parseInt(studentId.replace('student-', ''));
    for (const col of columns) {
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

    // 타겟 컬럼 찾기
    let targetColumn: TrainerColumn | null = null;
    let targetTrainerId: number | null = null;

    if (overId.startsWith('student-')) {
      targetColumn = findColumn(overId);
    } else {
      // 컬럼 자체에 드롭
      targetColumn = columns.find(c =>
        (c.trainer_id === null && overId === 'unassigned') ||
        c.trainer_id?.toString() === overId
      ) || null;
    }

    if (!targetColumn || sourceColumn === targetColumn) return;

    targetTrainerId = targetColumn.trainer_id;
    const student = findStudent(activeId);
    if (!student) return;

    // UI 즉시 업데이트
    setColumns(prev => {
      const newColumns = prev.map(col => ({
        ...col,
        students: col.students.filter(s => s.id !== student.id)
      }));

      const targetIdx = newColumns.findIndex(c => c.trainer_id === targetTrainerId);
      if (targetIdx !== -1) {
        newColumns[targetIdx].students.push(student);
      }

      return newColumns;
    });

    // API 호출
    try {
      await apiClient.put(`/assignments/${student.id}`, {
        trainer_id: targetTrainerId,
        status: student.status,
        order_num: 0
      });
    } catch (error) {
      console.error('Failed to update assignment:', error);
      fetchData(); // 실패시 데이터 다시 로드
    }
  };

  const totalStudents = columns.reduce((sum, col) => sum + col.students.length, 0);
  const assignedStudents = columns
    .filter(col => col.trainer_id !== null)
    .reduce((sum, col) => sum + col.students.length, 0);

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">반 배치</h1>
          <p className="text-slate-500 mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white rounded-lg shadow-sm">
            <span className="text-slate-500 text-sm">배정 현황</span>
            <span className="ml-2 font-bold text-orange-500">{assignedStudents}/{totalStudents}명</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <TrainerColumnComponent
                key={column.trainer_id ?? 'unassigned'}
                column={column}
                isUnassigned={column.trainer_id === null}
              />
            ))}
          </div>

          <DragOverlay>
            {activeStudent && <StudentCard student={activeStudent} isDragging />}
          </DragOverlay>
        </DndContext>
      )}

      {/* 범례 */}
      <div className="mt-6 flex items-center gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">남</span>
          <span>남학생</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded text-xs">여</span>
          <span>여학생</span>
        </div>
        <div className="flex items-center gap-2">
          <Coffee size={14} />
          <span>휴식</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle size={14} />
          <span>부상</span>
        </div>
      </div>
    </div>
  );
}
