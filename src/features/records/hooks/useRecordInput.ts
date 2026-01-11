'use client';

import { useState, useCallback, useEffect } from 'react';
import apiClient from '@/lib/api/client';
import {
  RecordInput,
  SlotData,
} from '@/components/records';

export interface UseRecordInputOptions {
  measuredAt: string;
  slots: Record<string, SlotData>;
  calculateScore: (value: number, gender: 'M' | 'F', recordTypeId: number) => number | null;
}

export interface UseRecordInputReturn {
  inputs: Record<number, Record<number, RecordInput>>;
  expandedStudents: Set<number>;
  savedStudents: Set<number>;
  saving: boolean;

  handleInputChange: (studentId: number, recordTypeId: number, value: string, gender: 'M' | 'F') => void;
  handleInputBlur: (studentId: number, recordTypeId: number) => Promise<void>;
  toggleStudent: (studentId: number) => void;
  expandAll: (studentIds: number[]) => void;
  collapseAll: () => void;

  // 유틸
  getInputCount: (studentId: number) => number;
  getTotalScore: (studentId: number) => number | null;
}

export function useRecordInput(options: UseRecordInputOptions): UseRecordInputReturn {
  const { measuredAt, slots, calculateScore } = options;

  const [inputs, setInputs] = useState<Record<number, Record<number, RecordInput>>>({});
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  const [savedStudents, setSavedStudents] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // 기존 기록 로드
  const loadExistingRecords = useCallback(async (studentIds: number[], date: string) => {
    if (studentIds.length === 0) return;
    try {
      const res = await apiClient.get(`/records/by-date?date=${date}&student_ids=${studentIds.join(',')}`);
      const records = res.data.records || [];
      const newInputs: Record<number, Record<number, RecordInput>> = {};
      records.forEach((r: { student_id: number; record_type_id: number; value: number }) => {
        if (!newInputs[r.student_id]) newInputs[r.student_id] = {};
        newInputs[r.student_id][r.record_type_id] = { value: r.value.toString(), score: null };
      });
      setInputs(newInputs);
      setSavedStudents(new Set(Object.keys(newInputs).map(Number)));
    } catch (error) {
      console.error('Failed to load existing records:', error);
    }
  }, []);

  // slots 변경시 기존 기록 로드
  useEffect(() => {
    const allStudentIds: number[] = [];
    Object.values(slots).forEach((slotData) => {
      const sd = slotData as SlotData;
      sd.classes?.forEach(c => c.students?.forEach(s => {
        if (!allStudentIds.includes(s.student_id)) allStudentIds.push(s.student_id);
      }));
      sd.waitingStudents?.forEach(s => {
        if (!allStudentIds.includes(s.student_id)) allStudentIds.push(s.student_id);
      });
    });
    if (allStudentIds.length > 0) {
      loadExistingRecords(allStudentIds, measuredAt);
    }
  }, [slots, measuredAt, loadExistingRecords]);

  const handleInputChange = useCallback((
    studentId: number,
    recordTypeId: number,
    value: string,
    gender: 'M' | 'F'
  ) => {
    const numValue = parseFloat(value);
    const score = !isNaN(numValue) ? calculateScore(numValue, gender, recordTypeId) : null;
    setInputs(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [recordTypeId]: { value, score } }
    }));
    setSavedStudents(prev => {
      const newSet = new Set(prev);
      newSet.delete(studentId);
      return newSet;
    });
  }, [calculateScore]);

  const handleInputBlur = useCallback(async (studentId: number, recordTypeId: number) => {
    const inputData = inputs[studentId]?.[recordTypeId];
    if (!inputData?.value?.trim() || saving) return;
    try {
      setSaving(true);
      await apiClient.post('/records/batch', {
        student_id: studentId,
        measured_at: measuredAt,
        records: [{ record_type_id: recordTypeId, value: parseFloat(inputData.value), notes: null }]
      });
      setSavedStudents(prev => new Set([...prev, studentId]));
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [inputs, saving, measuredAt]);

  const toggleStudent = useCallback((studentId: number) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  }, []);

  const expandAll = useCallback((studentIds: number[]) => {
    setExpandedStudents(new Set(studentIds));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedStudents(new Set());
  }, []);

  const getInputCount = useCallback((studentId: number): number => {
    return Object.values(inputs[studentId] || {}).filter(d => d.value?.trim()).length;
  }, [inputs]);

  const getTotalScore = useCallback((studentId: number): number | null => {
    const scores = Object.values(inputs[studentId] || {})
      .filter(d => d.score !== null)
      .map(d => d.score as number);
    return scores.length === 0 ? null : scores.reduce((sum, s) => sum + s, 0);
  }, [inputs]);

  return {
    inputs,
    expandedStudents,
    savedStudents,
    saving,

    handleInputChange,
    handleInputBlur,
    toggleStudent,
    expandAll,
    collapseAll,

    getInputCount,
    getTotalScore,
  };
}
