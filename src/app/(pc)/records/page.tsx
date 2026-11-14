'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, RefreshCw, Target, Users } from 'lucide-react';
import {
  EventRecordCard,
  InputMode,
  RecordModeSelector,
  SLOT_LABELS,
  StudentRecordCard,
  getRoleDisplayName,
} from '@/components/records';
import { useRecordInput, useRecords } from '@/features/records';
import { BranchTabs } from '@/components/BranchTabs';

export default function RecordsPage() {
  const {
    availableSlots,
    calculateScore,
    currentUser,
    fetchData,
    getDecimalPlaces,
    isAdmin,
    loading,
    measuredAt,
    myStudents,
    recordTypes,
    selectedSlot,
    setMeasuredAt,
    setSelectedSlot,
    setSelectedTrainerId,
    slots,
    branches,
    branchId,
    setBranchId,
  } = useRecords({ ownClassOnly: false });

  const {
    collapseAll,
    expandedStudents,
    expandAll,
    handleInputBlur,
    handleInputChange,
    inputs,
    isOutOfRange,
    savedStudents,
    toggleStudent,
  } = useRecordInput({ measuredAt, slots, recordTypes, calculateScore });

  const [inputMode, setInputMode] = useState<InputMode>('student');
  const [selectedRecordType, setSelectedRecordType] = useState<number | null>(null);

  useEffect(() => {
    if (selectedRecordType === null && recordTypes.length > 0) {
      setSelectedRecordType(recordTypes[0].id);
    }
  }, [recordTypes, selectedRecordType]);

  const currentRecordType = recordTypes.find((recordType) => recordType.id === selectedRecordType);
  const roleLabel = getRoleDisplayName(currentUser?.role, currentUser?.position);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-success">RECORD ENTRY</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-foreground">기록 측정</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {isAdmin ? `${SLOT_LABELS[selectedSlot] || ''} 전체 학생` : `${currentUser?.name || ''} ${roleLabel} 반`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMeasuredAt(shiftDate(measuredAt, -1))} className="rounded-lg border border-border bg-card p-2">
            <ChevronLeft className="size-4" />
          </button>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-secondary-foreground">
            <Calendar className="size-4 text-muted-foreground" />
            <input type="date" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} className="bg-transparent outline-none" />
          </label>
          <button type="button" onClick={() => setMeasuredAt(shiftDate(measuredAt, 1))} className="rounded-lg border border-border bg-card p-2">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={fetchData} disabled={loading} className="rounded-lg border border-border bg-card p-2 text-secondary-foreground disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <BranchTabs branches={branches} value={branchId} onChange={setBranchId} />

      {loading && <div className="rounded-lg border border-border bg-card p-12 text-center text-sm font-semibold text-muted-foreground">불러오는 중입니다.</div>}
      {!loading && availableSlots.length === 0 && (
        <EmptyState message="해당 날짜에 배정된 학생이 없습니다." subMessage="반 배치에서 학생을 먼저 배정해주세요." />
      )}
      {!loading && availableSlots.length > 0 && (
        <>
          <section className="grid gap-3 lg:grid-cols-3">
            <MetricCard icon={Calendar} label="측정일" value={formatKoreanDate(measuredAt)} />
            <MetricCard icon={Users} label="대상 학생" value={`${myStudents.length}명`} />
            <MetricCard icon={Target} label="측정 종목" value={`${recordTypes.length}개`} />
          </section>

          <section className="grid gap-2 sm:grid-cols-3">
            {availableSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => {
                  setSelectedSlot(slot);
                  if (isAdmin) setSelectedTrainerId(null);
                }}
                className={`h-12 rounded-lg border px-4 text-left text-sm font-black transition ${
                  selectedSlot === slot
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card text-secondary-foreground hover:bg-muted'
                }`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </section>

          {myStudents.length === 0 ? (
            <EmptyState message="배정된 학생이 없습니다." />
          ) : (
            <>
              <RecordModeSelector
                inputMode={inputMode}
                setInputMode={setInputMode}
                recordTypes={recordTypes}
                selectedRecordType={selectedRecordType}
                setSelectedRecordType={setSelectedRecordType}
                onExpandAll={() => expandAll(myStudents.map((student) => student.student_id))}
                onCollapseAll={collapseAll}
              />

              {inputMode === 'student' ? (
                <div className="grid gap-3 xl:grid-cols-3">
                  {myStudents.map((student) => (
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
                      isOutOfRange={isOutOfRange}
                    />
                  ))}
                </div>
              ) : currentRecordType && (
                <section className="space-y-3">
                  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-foreground">{currentRecordType.name}</span>
                      <span className="text-sm font-semibold text-muted-foreground">{currentRecordType.unit}</span>
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-secondary-foreground">
                        {currentRecordType.direction === 'higher' ? '높을수록 좋음' : '낮을수록 좋음'}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-3">
                    {myStudents.map((student) => (
                      <EventRecordCard
                        key={student.student_id}
                        student={student}
                        recordTypeId={currentRecordType.id}
                        inputData={inputs[student.student_id]?.[currentRecordType.id] || { value: '', score: null }}
                        decimalPlaces={getDecimalPlaces(currentRecordType.id)}
                        isSaved={savedStudents.has(student.student_id)}
                        onInputChange={(value) => handleInputChange(student.student_id, currentRecordType.id, value, student.gender)}
                        onInputBlur={() => handleInputBlur(student.student_id, currentRecordType.id)}
                        isOutOfRange={isOutOfRange(currentRecordType.id, inputs[student.student_id]?.[currentRecordType.id]?.value || '')}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-secondary-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-black text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message, subMessage }: { message: string; subMessage?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
      <p className="mt-3 text-sm font-bold text-secondary-foreground">{message}</p>
      {subMessage && <p className="mt-1 text-sm text-muted-foreground">{subMessage}</p>}
    </div>
  );
}

function shiftDate(dateValue: string, delta: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function formatKoreanDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}
