// Hooks
export * from './hooks';

// Re-export types from components/records
export type {
  RecordType,
  Student,
  ClassInstructor,
  ClassData,
  SlotData,
  ScoreRange,
  ScoreTableData,
  RecordInput,
  InputMode,
} from '@/components/records';

export { SLOT_LABELS, getRoleDisplayName } from '@/components/records';
