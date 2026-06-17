'use client';

import { useState, useCallback, useEffect } from 'react';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import {
  RecordInput,
  RecordType,
  SlotData,
} from '@/components/records';

export interface UseRecordInputOptions {
  measuredAt: string;
  slots: Record<string, SlotData>;
  recordTypes: RecordType[];
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
  isOutOfRange: (recordTypeId: number, value: string) => boolean;
}

export function useRecordInput(options: UseRecordInputOptions): UseRecordInputReturn {
  const { measuredAt, slots, recordTypes, calculateScore } = options;
  const toast = useToast();

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
    if (saving) return;

    // 값이 비어있거나 0이면 DB에서 삭제 (입력칸 터치만으로 0 저장 방지)
    const trimmed = inputData?.value?.trim() || '';
    if (!trimmed || Number(trimmed) === 0) {
      try {
        setSaving(true);
        await apiClient.delete('/records', {
          data: { student_id: studentId, record_type_id: recordTypeId, measured_at: measuredAt }
        });
        setInputs(prev => {
          const updated = { ...prev };
          if (updated[studentId]) {
            const rest = { ...updated[studentId] };
            delete rest[recordTypeId];
            if (Object.keys(rest).length === 0) {
              delete updated[studentId];
            } else {
              updated[studentId] = rest;
            }
          }
          return updated;
        });
        setSavedStudents(prev => {
          const remaining = Object.keys(inputs[studentId] || {}).filter(k => Number(k) !== recordTypeId && inputs[studentId]?.[Number(k)]?.value?.trim());
          if (remaining.length === 0) {
            const newSet = new Set(prev);
            newSet.delete(studentId);
            return newSet;
          }
          return prev;
        });
      } catch (error) {
        console.error('Delete record failed:', error);
        toast.error(error);
      } finally {
        setSaving(false);
      }
      return;
    }

    // 범위 체크
    const numValue = Number(inputData.value);
    if (!Number.isFinite(numValue)) {
      toast.error('기록은 숫자로 입력해주세요.');
      return;
    }
    const recordType = recordTypes.find(rt => rt.id === recordTypeId);
    if (recordType) {
      const { min_value, max_value } = recordType;
      const outOfRange =
        (min_value != null && numValue < min_value) ||
        (max_value != null && numValue > max_value);
      if (outOfRange) {
        const rangeText = `${min_value ?? ''} ~ ${max_value ?? ''}`;
        toast.error(`${recordType.name} 기록은 ${rangeText}${recordType.unit} 사이로 입력해주세요.`);
        return;
      }
    }

    try {
      setSaving(true);
      await apiClient.post('/records/batch', {
        student_id: studentId,
        measured_at: measuredAt,
        records: [{ record_type_id: recordTypeId, value: numValue, notes: null }]
      });
      setSavedStudents(prev => new Set([...prev, studentId]));
    } catch (error) {
      console.error('Auto-save failed:', error);
      toast.error(error);
    } finally {
      setSaving(false);
    }
  }, [inputs, saving, measuredAt, recordTypes, toast]);

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

  const isOutOfRange = useCallback((recordTypeId: number, value: string): boolean => {
    const trimmed = value?.trim();
    if (!trimmed) return false;
    const numValue = parseFloat(trimmed);
    if (isNaN(numValue)) return false;
    const recordType = recordTypes.find(rt => rt.id === recordTypeId);
    if (!recordType) return false;
    const { min_value, max_value } = recordType;
    return (min_value != null && numValue < min_value) || (max_value != null && numValue > max_value);
  }, [recordTypes]);

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
    isOutOfRange,
  };
}
