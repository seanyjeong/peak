'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, RefreshCw, Target, Users } from 'lucide-react';
import { PageHeader, StatTile, chipClass, toolbarButtonClass } from '@/components/ui/page';
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
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader
        title="기록 측정"
        description={`${formatKoreanDate(measuredAt)} · ${isAdmin ? `${SLOT_LABELS[selectedSlot] || ''} 전체 학생` : `${currentUser?.name || ''} ${roleLabel} 반`}`}
        actions={(
          <>
            <button type="button" onClick={() => setMeasuredAt(shiftDate(measuredAt, -1))} className={`${toolbarButtonClass()} w-10 px-0`} aria-label="전날">
              <ChevronLeft className="size-4" />
            </button>
            <label className={toolbarButtonClass()}>
              <Calendar className="size-4 text-muted-foreground" />
              <input type="date" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} className="bg-transparent outline-none" />
            </label>
            <button type="button" onClick={() => setMeasuredAt(shiftDate(measuredAt, 1))} className={`${toolbarButtonClass()} w-10 px-0`} aria-label="다음날">
              <ChevronRight className="size-4" />
            </button>
            <button type="button" onClick={fetchData} disabled={loading} className={`${toolbarButtonClass()} w-10 px-0`} aria-label="새로고침">
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      />

      <BranchTabs branches={branches} value={branchId} onChange={setBranchId} />

      {loading && <div className="rounded-2xl bg-card p-12 text-center text-sm font-semibold text-muted-foreground">불러오는 중입니다.</div>}
      {!loading && availableSlots.length === 0 && (
        <EmptyState message="해당 날짜에 배정된 학생이 없습니다." subMessage="반 배치에서 학생을 먼저 배정해주세요." />
      )}
      {!loading && availableSlots.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-3">
            <StatTile icon={Users} tone="primary" label="대상 학생" value={`${myStudents.length}명`} />
            <StatTile icon={Target} label="측정 종목" value={`${recordTypes.length}개`} />
          </section>

          <section className="space-y-4 rounded-2xl bg-card p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={selectedSlot === slot}
                  onClick={() => {
                    setSelectedSlot(slot);
                    if (isAdmin) setSelectedTrainerId(null);
                  }}
                  className={chipClass(selectedSlot === slot, 'card')}
                >
                  {SLOT_LABELS[slot]}
                </button>
              ))}
            </div>
            {myStudents.length > 0 && (
              <RecordModeSelector
                inputMode={inputMode}
                setInputMode={setInputMode}
                recordTypes={recordTypes}
                selectedRecordType={selectedRecordType}
                setSelectedRecordType={setSelectedRecordType}
                onExpandAll={() => expandAll(myStudents.map((student) => student.student_id))}
                onCollapseAll={collapseAll}
              />
            )}
          </section>

          {myStudents.length === 0 ? (
            <EmptyState message="배정된 학생이 없습니다." />
          ) : (
            <>

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
                  <div className="px-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-foreground">{currentRecordType.name}</span>
                      <span className="text-sm font-semibold text-muted-foreground">{currentRecordType.unit}</span>
                      <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
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

function EmptyState({ message, subMessage }: { message: string; subMessage?: string }) {
  return (
    <div className="rounded-2xl bg-card p-10 text-center">
      <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
      <p className="mt-3 text-[15px] font-semibold text-foreground">{message}</p>
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
