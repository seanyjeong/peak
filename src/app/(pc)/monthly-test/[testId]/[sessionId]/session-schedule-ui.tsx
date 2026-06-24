import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useToast } from '@/hooks/useToast';
import apiClient from '@/lib/api/client';
import { Group, RecordType, ScheduleItem, snapCenterToCursor } from './session-group-model';

export function ScheduleTable({
  groups,
  onSwapped,
  recordTypes,
  schedule,
  sessionId,
}: {
  groups: Group[];
  onSwapped: () => void;
  recordTypes: RecordType[];
  schedule: ScheduleItem[];
  sessionId: string;
}) {
  const toast = useToast();
  const [dragItem, setDragItem] = useState<{ groupId: number; name: string; timeOrder: number } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const timeSlots = [...new Set(schedule.map((item) => item.time_order))].sort((a, b) => a - b);

  const handleDragStart = (event: DragStartEvent) => {
    const { groupId, timeOrder } = event.active.data.current as { groupId: number; timeOrder: number };
    const item = schedule.find((entry) => entry.group_id === groupId && entry.time_order === timeOrder);
    setDragItem({
      groupId,
      timeOrder,
      name: item?.record_type_id ? (item.record_type_short || item.record_type_name || '?') : '휴식',
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as { groupId: number; timeOrder: number };
    const overData = over.data.current as { groupId: number; timeOrder: number };
    if (!activeData || !overData) return;
    if (activeData.groupId === overData.groupId && activeData.timeOrder === overData.timeOrder) return;

    try {
      await apiClient.put(`/test-sessions/${sessionId}/schedule/swap`, {
        group_id_1: activeData.groupId,
        group_id_2: overData.groupId,
        time_order_1: activeData.timeOrder,
        time_order_2: overData.timeOrder,
      });
      onSwapped();
    } catch {
      toast.error('순서표를 바꾸지 못했습니다.');
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="mb-3 text-sm font-semibold text-slate-500">종목 셀을 드래그하면 다른 셀과 교체됩니다.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-slate-50 p-3 text-left font-bold text-slate-600">타임</th>
                {groups.map((group) => {
                  const mainSupervisor = group.supervisors.find((supervisor) => supervisor.is_main);
                  return (
                    <th key={group.id} className="min-w-36 border border-slate-200 bg-slate-50 p-3 text-center font-bold text-slate-700">
                      {mainSupervisor ? `${mainSupervisor.name}반` : `${group.group_num}조`}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((timeOrder) => (
                <tr key={timeOrder}>
                  <td className="border border-slate-200 bg-slate-50 p-3 font-bold text-slate-600">타임 {timeOrder + 1}</td>
                  {groups.map((group) => {
                    const item = schedule.find((entry) => entry.group_id === group.id && entry.time_order === timeOrder);
                    const cellId = `schedule-${timeOrder}-${group.id}`;
                    return (
                      <ScheduleCell key={cellId} groupId={group.id} id={cellId} timeOrder={timeOrder}>
                        {item?.record_type_id ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                            {item.record_type_short || item.record_type_name}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-slate-400">휴식</span>
                        )}
                      </ScheduleCell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {dragItem && <div className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg">{dragItem.name}</div>}
        </DragOverlay>
      </DndContext>

      {recordTypes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {recordTypes.map((type) => (
            <span key={type.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
              {type.short_name || type.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function ScheduleCell({
  children,
  groupId,
  id,
  timeOrder,
}: {
  children: React.ReactNode;
  groupId: number;
  id: string;
  timeOrder: number;
}) {
  const { attributes, isDragging, listeners, setNodeRef: setDragRef } = useDraggable({
    id,
    data: { type: 'schedule-cell', groupId, timeOrder },
  });
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id,
    data: { type: 'schedule-cell', groupId, timeOrder },
  });

  return (
    <td
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={`cursor-grab select-none border border-slate-200 p-3 text-center transition active:cursor-grabbing ${
        isOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      {children}
    </td>
  );
}
