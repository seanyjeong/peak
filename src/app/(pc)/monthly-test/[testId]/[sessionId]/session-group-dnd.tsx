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
      className="mb-2 cursor-grab touch-none rounded-lg border border-border bg-card p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${participant.gender === 'M' ? 'bg-primary-soft text-primary' : 'bg-destructive-soft text-destructive'}`}>
          {participant.gender === 'M' ? '남' : '여'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-bold text-foreground">{participant.name}</span>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${PARTICIPANT_TYPE_CLASSES[participant.participant_type]}`}>
              {PARTICIPANT_TYPE_LABELS[participant.participant_type]}
            </span>
          </div>
          {(participant.school || participant.grade) && (
            <div className="truncate text-xs text-muted-foreground">{participant.school || ''} {participant.grade || ''}</div>
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
        supervisor.isOwner ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'
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
    <article className="flex w-64 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border bg-muted px-3 py-3">
        <div>
          <h3 className="font-bold text-foreground">{groupTitle}</h3>
          <p className="text-xs text-muted-foreground">{group.participants.length}명 배치</p>
        </div>
        <button type="button" onClick={onDeleteGroup} className="rounded-md p-2 text-muted-foreground hover:bg-destructive-soft hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={setSupervisorsRef}
        className={`min-h-16 border-b border-border p-3 transition ${isOverSupervisors ? 'bg-primary-soft ring-2 ring-primary/30' : 'bg-muted'}`}
      >
        {group.supervisors.length === 0 ? (
          <span className="text-xs font-semibold text-muted-foreground">감독관 드롭</span>
        ) : (
          <div className="flex flex-wrap gap-1">{group.supervisors.map((supervisor) => <DraggableSupervisor key={supervisor.instructor_id} supervisor={supervisor} />)}</div>
        )}
      </div>

      <div ref={setParticipantsRef} className={`min-h-96 flex-1 overflow-y-auto p-3 transition ${isOverParticipants ? 'bg-success-soft ring-2 ring-success/30' : ''}`}>
        {group.participants.map((participant) => <DraggableParticipant key={participant.id} participant={participant} />)}
        {group.participants.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">학생 드롭</div>
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
        isOver ? 'border-primary bg-primary-soft ring-2 ring-primary/30' : 'border-border bg-card'
      }`}
    >
      <div className="text-center text-sm font-bold text-muted-foreground">
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
      <section className={`overflow-hidden rounded-lg border border-border bg-card shadow-sm transition ${isDragging ? 'ring-2 ring-dashed ring-primary/30' : ''}`}>
        <header className="border-b border-border bg-muted px-4 py-3 text-sm font-bold text-secondary-foreground">감독관 대기 {waitingInstructors.length}명</header>
        <div ref={setWaitingSupervisorsRef} className={`min-h-24 p-3 transition ${isOverSupervisors ? 'bg-primary-soft ring-2 ring-primary/30' : ''}`}>
          {waitingInstructors.length === 0 ? <EmptyDropText text="감독관을 여기로 이동" /> : <div className="flex flex-wrap gap-1">{waitingInstructors.map((supervisor) => <DraggableSupervisor key={supervisor.instructor_id} supervisor={supervisor} />)}</div>}
        </div>
      </section>

      <section className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition ${isDragging ? 'ring-2 ring-dashed ring-success/30' : ''}`}>
        <header className="border-b border-border bg-muted px-4 py-3 text-sm font-bold text-secondary-foreground">미배치 학생 {waitingParticipants.length}명</header>
        <div ref={setWaitingParticipantsRef} className={`min-h-80 flex-1 overflow-y-auto p-3 transition ${isOverParticipants ? 'bg-success-soft ring-2 ring-success/30' : ''}`}>
          {waitingParticipants.length === 0 ? <EmptyDropText text="학생을 여기로 이동" /> : waitingParticipants.map((participant) => <DraggableParticipant key={participant.id} participant={participant} />)}
        </div>
      </section>
    </aside>
  );
}

function EmptyDropText({ text }: { text: string }) {
  return <div className="flex h-full min-h-20 items-center justify-center text-sm font-semibold text-muted-foreground">{text}</div>;
}
