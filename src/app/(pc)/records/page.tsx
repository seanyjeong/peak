'use client';

import { useState } from 'react';
import { RefreshCw, Calendar, Users, AlertCircle } from 'lucide-react';
import {
  StudentRecordCard,
  EventRecordCard,
  RecordModeSelector,
  SLOT_LABELS,
  getRoleDisplayName,
  InputMode,
} from '@/components/records';
import { useRecords, useRecordInput } from '@/features/records';
import { PageTransition, StaggerChildren, StaggerItem } from '@/components/animations';

export default function RecordsPage() {
  const {
    recordTypes,
    slots,
    availableSlots,
    myStudents,
    currentUser,
    selectedSlot,
    measuredAt,
    loading,
    isAdmin,
    setSelectedSlot,
    setSelectedTrainerId,
    setMeasuredAt,
    fetchData,
    calculateScore,
    getDecimalPlaces,
  } = useRecords({ ownClassOnly: false });

  const {
    inputs,
    expandedStudents,
    savedStudents,
    handleInputChange,
    handleInputBlur,
    toggleStudent,
    expandAll,
    collapseAll,
  } = useRecordInput({
    measuredAt,
    slots,
    calculateScore,
  });

  const [inputMode, setInputMode] = useState<InputMode>('student');
  const [selectedRecordType, setSelectedRecordType] = useState<number | null>(null);

  // 첫 번째 종목 자동 선택
  if (selectedRecordType === null && recordTypes.length > 0) {
    setSelectedRecordType(recordTypes[0].id);
  }

  const currentRecordType = recordTypes.find(t => t.id === selectedRecordType);

  return (
    <PageTransition className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">기록 측정</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? `${SLOT_LABELS[selectedSlot] || ''} 전체 학생 기록 입력`
              : `${currentUser?.name || ''} ${getRoleDisplayName(currentUser?.role, currentUser?.position)}의 반 학생 기록 입력`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-base px-3 py-2 rounded-lg border border-border">
            <Calendar size={18} className="text-muted-foreground" />
            <input
              type="date"
              value={measuredAt}
              onChange={e => setMeasuredAt(e.target.value)}
              className="border-none focus:ring-0 text-foreground bg-transparent"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-foreground bg-surface-base border border-border rounded-lg hover:bg-muted transition-smooth disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bento-card">
          <RefreshCw size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="bento-card p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">해당 날짜에 배정된 학생이 없습니다.</p>
          <p className="text-muted-foreground text-sm mt-1">반 배치 페이지에서 학생을 배치해주세요.</p>
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
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>

          {myStudents.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">배정된 학생이 없습니다</p>
            </div>
          ) : (
            <>
              <RecordModeSelector
                inputMode={inputMode}
                setInputMode={setInputMode}
                recordTypes={recordTypes}
                selectedRecordType={selectedRecordType}
                setSelectedRecordType={setSelectedRecordType}
                onExpandAll={() => expandAll(myStudents.map(s => s.student_id))}
                onCollapseAll={collapseAll}
              />

              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
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
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{currentRecordType.name}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">({currentRecordType.unit})</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        currentRecordType.direction === 'higher' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
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
                                                                                                    </PageTransition>
  );
}
