import { Crown, Star, Trash2, UserPlus } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Group,
  Participant,
  PARTICIPANT_TYPE_CLASSES,
  PARTICIPANT_TYPE_LABELS,
  Supervisor,
} from './session-group-model';

export function DraggableParticipant({ participant }: { participant: Participant }) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `participant-${participant.id}`,
    data: { type: 'participant', participant },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="mb-2 cursor-grab touch-none rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${participant.gender === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
          {participant.gender === 'M' ? '남' : '여'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-bold text-slate-950 dark:text-white">{participant.name}</span>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${PARTICIPANT_TYPE_CLASSES[participant.participant_type]}`}>
              {PARTICIPANT_TYPE_LABELS[participant.participant_type]}
            </span>
          </div>
          {(participant.school || participant.grade) && (
            <div className="truncate text-xs text-slate-500">{participant.school || ''} {participant.grade || ''}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DraggableSupervisor({ supervisor }: { supervisor: Supervisor }) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `supervisor-${supervisor.instructor_id}`,
    data: { type: 'supervisor', supervisor },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`inline-flex cursor-grab touch-none items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold active:cursor-grabbing ${
        supervisor.isOwner ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'
      }`}
    >
      {supervisor.is_main && <Star className="h-3.5 w-3.5 fill-current" />}
      {supervisor.isOwner && <Crown className="h-3.5 w-3.5" />}
      {supervisor.name}
    </div>
  );
}

export function GroupColumn({ group, onDeleteGroup }: { group: Group; onDeleteGroup: () => void }) {
  const { isOver: isOverParticipants, setNodeRef: setParticipantsRef } = useDroppable({
    id: `group-${group.id}-participants`,
    data: { type: 'group-participants', groupId: group.id },
  });
  const { isOver: isOverSupervisors, setNodeRef: setSupervisorsRef } = useDroppable({
    id: `group-${group.id}-supervisors`,
    data: { type: 'group-supervisors', groupId: group.id },
  });
  const mainSupervisor = group.supervisors.find((supervisor) => supervisor.is_main);
  const groupTitle = mainSupervisor ? `${mainSupervisor.name}T` : `${group.group_num}조`;

  return (
    <article className="flex w-64 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h3 className="font-bold text-slate-950 dark:text-white">{groupTitle}</h3>
          <p className="text-xs text-slate-500">{group.participants.length}명 배치</p>
        </div>
        <button type="button" onClick={onDeleteGroup} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={setSupervisorsRef}
        className={`min-h-16 border-b border-slate-100 p-3 transition dark:border-slate-800 ${isOverSupervisors ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-slate-50 dark:bg-slate-900'}`}
      >
        {group.supervisors.length === 0 ? (
          <span className="text-xs font-semibold text-slate-400">감독관 드롭</span>
        ) : (
          <div className="flex flex-wrap gap-1">{group.supervisors.map((supervisor) => <DraggableSupervisor key={supervisor.instructor_id} supervisor={supervisor} />)}</div>
        )}
      </div>

      <div ref={setParticipantsRef} className={`min-h-96 flex-1 overflow-y-auto p-3 transition ${isOverParticipants ? 'bg-emerald-50 ring-2 ring-emerald-300' : ''}`}>
        {group.participants.map((participant) => <DraggableParticipant key={participant.id} participant={participant} />)}
        {group.participants.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">학생 드롭</div>
        )}
      </div>
    </article>
  );
}

export function NewGroupZone() {
  const { isOver, setNodeRef } = useDroppable({ id: 'new-group', data: { type: 'new-group' } });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-96 w-52 shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition ${
        isOver ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' : 'border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-950'
      }`}
    >
      <div className="text-center text-sm font-bold text-slate-400">
        <UserPlus className="mx-auto mb-2 h-7 w-7" />
        감독관 드롭<br />새 조 생성
      </div>
    </div>
  );
}

export function WaitingArea({
  isDragging,
  waitingInstructors,
  waitingParticipants,
}: {
  isDragging: boolean;
  waitingInstructors: Supervisor[];
  waitingParticipants: Participant[];
}) {
  const { isOver: isOverParticipants, setNodeRef: setWaitingParticipantsRef } = useDroppable({
    id: 'waiting-participants',
    data: { type: 'waiting-participants' },
  });
  const { isOver: isOverSupervisors, setNodeRef: setWaitingSupervisorsRef } = useDroppable({
    id: 'waiting-supervisors',
    data: { type: 'waiting-supervisors' },
  });

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4">
      <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-950 ${isDragging ? 'ring-2 ring-dashed ring-blue-200' : ''}`}>
        <header className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900">감독관 대기 {waitingInstructors.length}명</header>
        <div ref={setWaitingSupervisorsRef} className={`min-h-24 p-3 transition ${isOverSupervisors ? 'bg-blue-50 ring-2 ring-blue-300' : ''}`}>
          {waitingInstructors.length === 0 ? <EmptyDropText text="감독관을 여기로 이동" /> : <div className="flex flex-wrap gap-1">{waitingInstructors.map((supervisor) => <DraggableSupervisor key={supervisor.instructor_id} supervisor={supervisor} />)}</div>}
        </div>
      </section>

      <section className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-950 ${isDragging ? 'ring-2 ring-dashed ring-emerald-200' : ''}`}>
        <header className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900">미배치 학생 {waitingParticipants.length}명</header>
        <div ref={setWaitingParticipantsRef} className={`min-h-80 flex-1 overflow-y-auto p-3 transition ${isOverParticipants ? 'bg-emerald-50 ring-2 ring-emerald-300' : ''}`}>
          {waitingParticipants.length === 0 ? <EmptyDropText text="학생을 여기로 이동" /> : waitingParticipants.map((participant) => <DraggableParticipant key={participant.id} participant={participant} />)}
        </div>
      </section>
    </aside>
  );
}

function EmptyDropText({ text }: { text: string }) {
  return <div className="flex h-full min-h-20 items-center justify-center text-sm font-semibold text-slate-400">{text}</div>;
}
