'use client';

import { useState } from 'react';
import { RefreshCw, Calendar, Users, Trophy, ChevronDown, ChevronUp, Check, List, AlertCircle, Target } from 'lucide-react';
import { useOrientation } from '../layout';
import { useRecords, useRecordInput, SLOT_LABELS } from '@/features/records';
import type { InputMode } from '@/components/records';
import { motion } from 'framer-motion';

export default function TabletRecordsPage() {
  const orientation = useOrientation();

  const {
    recordTypes,
    slots,
    availableSlots,
    myStudents,
    selectedSlot,
    measuredAt,
    loading,
    setSelectedSlot,
    setMeasuredAt,
    fetchData,
    calculateScore,
    getDecimalPlaces,
  } = useRecords({ ownClassOnly: true });

  const {
    inputs,
    expandedStudents,
    savedStudents,
    saving,
    handleInputChange,
    handleInputBlur,
    toggleStudent,
    getInputCount,
    getTotalScore,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={40} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <motion.div 
      className="tablet-scroll"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="p-2 bg-gradient-to-br from-brand-orange to-orange-600 rounded-xl">
            <Target size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">기록 측정</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Performance Tracking</p>
          </div>
        </motion.div>
        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Calendar size={18} className="text-slate-500 dark:text-slate-400" />
            <input
              type="date"
              value={measuredAt}
              onChange={e => setMeasuredAt(e.target.value)}
              className="border-none focus:ring-0 text-slate-900 dark:text-slate-100 text-sm bg-transparent font-medium"
            />
          </div>
          <motion.button
            onClick={fetchData}
            disabled={loading}
            className="p-3 text-white bg-gradient-to-r from-brand-blue to-blue-600 rounded-xl shadow-sm hover:shadow-lg transition-all disabled:opacity-50"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </motion.button>
        </motion.div>
      </div>

      {availableSlots.length === 0 ? (
        <motion.div 
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertCircle size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">오늘 수업 스케줄이 없습니다.</p>
        </motion.div>
      ) : (
        <>
          {/* 시간대 탭 */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {availableSlots.map(slot => (
              <button
                key={slot}
                onClick={() => setSelectedSlot(slot)}
                className={`px-5 py-3 rounded-xl font-medium transition whitespace-nowrap ${
                  selectedSlot === slot ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>

          {myStudents.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
              <p className="text-slate-600 font-medium">배정된 학생이 없습니다</p>
            </div>
          ) : (
            <>
              {/* 입력 모드 선택 */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <div className={`flex ${orientation === 'portrait' ? 'flex-col gap-3' : 'items-center justify-between'}`}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInputMode('student')}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
                        inputMode === 'student' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Users size={20} />
                      학생별
                    </button>
                    <button
                      onClick={() => setInputMode('event')}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
                        inputMode === 'event' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <List size={20} />
                      종목별
                    </button>
                  </div>

                  {inputMode === 'event' && (
                    <div className="flex gap-2 overflow-x-auto">
                      {recordTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => setSelectedRecordType(type.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                            selectedRecordType === type.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {type.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 학생 수 */}
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Users size={16} />
                <span>내 반: {myStudents.length}명</span>
                {saving && <RefreshCw size={14} className="animate-spin text-orange-500" />}
              </div>

              {inputMode === 'student' ? (
                /* 학생별 입력 모드 */
                <div className="space-y-3">
                  {myStudents.map(student => {
                    const isExpanded = expandedStudents.has(student.student_id);
                    const inputCount = getInputCount(student.student_id);
                    const totalScore = getTotalScore(student.student_id);
                    const isSaved = savedStudents.has(student.student_id);
                    const isAbsent = student.attendance_status === 'absent';

                    return (
                      <div
                        key={student.student_id}
                        className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isSaved ? 'ring-2 ring-green-400' : ''} ${isAbsent ? 'opacity-60' : ''}`}
                      >
                        <button
                          className="w-full p-4 flex items-center justify-between text-left"
                          onClick={() => toggleStudent(student.student_id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${
                              isAbsent ? 'bg-slate-200 text-slate-400' :
                              student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                            }`}>
                              {student.student_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold text-lg ${isAbsent ? 'line-through text-slate-400' : 'text-slate-800'}`}>{student.student_name}</span>
                                {isAbsent ? (
                                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-600">결석</span>
                                ) : (
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                                  }`}>
                                    {student.gender === 'M' ? '남' : '여'}
                                  </span>
                                )}
                                {isSaved && (
                                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                    <Check size={12} /> 저장됨
                                  </span>
                                )}
                              </div>
                              {inputCount > 0 && (
                                <div className="text-sm text-slate-500 mt-1">
                                  {inputCount}개 종목 입력
                                  {totalScore !== null && <span className="text-orange-500 font-medium"> · 총점 {totalScore}점</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={24} className="text-slate-400" /> : <ChevronDown size={24} className="text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-100 p-4">
                            <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'}`}>
                              {recordTypes.map(type => {
                                const inputData = inputs[student.student_id]?.[type.id] || { value: '', score: null };
                                const decimalPlaces = getDecimalPlaces(type.id);

                                return (
                                  <div key={type.id} className="relative">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">
                                      {type.name} <span className="text-slate-400">({type.unit})</span>
                                    </label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        step={Math.pow(10, -decimalPlaces)}
                                        value={inputData.value}
                                        onChange={e => handleInputChange(student.student_id, type.id, e.target.value, student.gender)}
                                        onBlur={() => handleInputBlur(student.student_id, type.id)}
                                        placeholder={`0${decimalPlaces > 0 ? '.' + '0'.repeat(decimalPlaces) : ''}`}
                                        className="w-full px-4 py-3 pr-16 border border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-orange-500"
                                      />
                                      {inputData.score !== null && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                          <Trophy size={16} className="text-orange-500" />
                                          <span className="font-bold text-orange-600">{inputData.score}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* 종목별 입력 모드 */
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {currentRecordType && (
                    <>
                      <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-800">{currentRecordType.name}</span>
                          <span className="text-slate-500">({currentRecordType.unit})</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {myStudents.map((student, idx) => {
                          const inputData = inputs[student.student_id]?.[currentRecordType.id] || { value: '', score: null };
                          const decimalPlaces = getDecimalPlaces(currentRecordType.id);
                          const isSaved = savedStudents.has(student.student_id);
                          const isAbsent = student.attendance_status === 'absent';

                          return (
                            <div key={student.student_id} className={`p-4 ${isSaved ? 'bg-green-50' : ''} ${isAbsent ? 'opacity-60' : ''}`}>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="text-slate-400 w-6">{idx + 1}</span>
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                    isAbsent ? 'bg-slate-200 text-slate-400' :
                                    student.gender === 'M' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                                  }`}>
                                    {student.student_name.charAt(0)}
                                  </div>
                                  <span className={`font-medium ${isAbsent ? 'line-through text-slate-400' : 'text-slate-800'}`}>{student.student_name}</span>
                                  {isAbsent && <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-600">결석</span>}
                                </div>
                                <input
                                  type="number"
                                  step={Math.pow(10, -decimalPlaces)}
                                  value={inputData.value}
                                  onChange={e => handleInputChange(student.student_id, currentRecordType.id, e.target.value, student.gender)}
                                  onBlur={() => handleInputBlur(student.student_id, currentRecordType.id)}
                                  placeholder="0"
                                  className="w-28 px-4 py-3 border border-slate-200 rounded-xl text-center text-lg focus:ring-2 focus:ring-orange-500"
                                />
                                <div className="w-16 text-center">
                                  {inputData.score !== null ? (
                                    <span className="inline-flex items-center gap-1 text-orange-600 font-bold">
                                      <Trophy size={16} /> {inputData.score}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                                <div className="w-16 text-center">
                                  {isSaved ? (
                                    <Check size={20} className="text-green-500 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
