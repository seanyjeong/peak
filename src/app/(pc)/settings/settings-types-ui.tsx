import { Edit2, Plus, Save, ToggleLeft, ToggleRight, X } from 'lucide-react';
import type { RecordType, TypeForm } from './settings-model';
import { getDirectionLabel } from './settings-model';

export function RecordTypesPanel({
  editingType,
  onAdd,
  onCancel,
  onEdit,
  onFormChange,
  onSave,
  onToggleActive,
  recordTypes,
  showForm,
  typeForm,
}: {
  editingType: RecordType | null;
  onAdd: () => void;
  onCancel: () => void;
  onEdit: (type: RecordType) => void;
  onFormChange: (form: TypeForm) => void;
  onSave: () => void;
  onToggleActive: (type: RecordType) => void;
  recordTypes: RecordType[];
  showForm: boolean;
  typeForm: TypeForm;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">측정 종목</h2>
          <p className="mt-1 text-sm text-slate-500">기록 입력, 수업 계획, 월말테스트에서 함께 쓰는 기준입니다.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          <Plus className="h-4 w-4" />
          종목 추가
        </button>
      </div>

      {showForm && (
        <TypeFormCard
          editingType={editingType}
          onCancel={onCancel}
          onChange={onFormChange}
          onSave={onSave}
          typeForm={typeForm}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <th className="px-5 py-3 text-left font-bold">종목명</th>
                <th className="px-3 py-3 text-center font-bold">단위</th>
                <th className="px-3 py-3 text-center font-bold">방향</th>
                <th className="px-3 py-3 text-center font-bold">허용 범위</th>
                <th className="px-3 py-3 text-center font-bold">상태</th>
                <th className="px-5 py-3 text-right font-bold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recordTypes.map((type) => (
                <RecordTypeRow
                  key={type.id}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                  type={type}
                />
              ))}
            </tbody>
          </table>
        </div>
        {recordTypes.length === 0 && (
          <div className="px-5 py-10 text-center text-sm font-semibold text-slate-500">등록된 종목이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function TypeFormCard({
  editingType,
  onCancel,
  onChange,
  onSave,
  typeForm,
}: {
  editingType: RecordType | null;
  onCancel: () => void;
  onChange: (form: TypeForm) => void;
  onSave: () => void;
  typeForm: TypeForm;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-950 dark:text-white">{editingType ? '종목 수정' : '새 종목 추가'}</h3>
        <button type="button" onClick={onCancel} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <InputField
          label="종목명"
          value={typeForm.name}
          placeholder="제자리멀리뛰기"
          onChange={(value) => onChange({ ...typeForm, name: value })}
        />
        <InputField
          label="단위"
          value={typeForm.unit}
          placeholder="cm, m, 초"
          onChange={(value) => onChange({ ...typeForm, unit: value })}
        />
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          방향
          <select
            value={typeForm.direction}
            onChange={(event) => onChange({ ...typeForm, direction: event.target.value as TypeForm['direction'] })}
            className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            <option value="higher">높을수록 좋음</option>
            <option value="lower">낮을수록 좋음</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InputField
          label="허용 최소값"
          type="number"
          value={typeForm.min_value}
          placeholder="비워두면 제한 없음"
          onChange={(value) => onChange({ ...typeForm, min_value: value })}
        />
        <InputField
          label="허용 최대값"
          type="number"
          value={typeForm.max_value}
          placeholder="비워두면 제한 없음"
          onChange={(value) => onChange({ ...typeForm, max_value: value })}
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
          취소
        </button>
        <button type="button" onClick={onSave} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          <Save className="h-4 w-4" />
          저장
        </button>
      </div>
    </section>
  );
}

function RecordTypeRow({
  onEdit,
  onToggleActive,
  type,
}: {
  onEdit: (type: RecordType) => void;
  onToggleActive: (type: RecordType) => void;
  type: RecordType;
}) {
  return (
    <tr className={type.is_active ? 'text-slate-700 dark:text-slate-200' : 'bg-slate-50 text-slate-400 dark:bg-slate-900/50'}>
      <td className="px-5 py-3 font-bold text-slate-950 dark:text-white">{type.name}</td>
      <td className="px-3 py-3 text-center">{type.unit}</td>
      <td className="px-3 py-3 text-center">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
          type.direction === 'higher' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {getDirectionLabel(type.direction)}
        </span>
      </td>
      <td className="px-3 py-3 text-center text-xs font-semibold text-slate-500">
        {type.min_value != null || type.max_value != null ? `${type.min_value ?? '~'} ~ ${type.max_value ?? '~'}` : '-'}
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
          type.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {type.is_active ? '활성' : '비활성'}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <button type="button" aria-label={`${type.name} 수정`} onClick={() => onEdit(type)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`${type.name} ${type.is_active ? '비활성화' : '활성화'}`}
          onClick={() => onToggleActive(type)}
          className={`rounded-md p-2 ${type.is_active ? 'text-emerald-600 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
          title={type.is_active ? '비활성화' : '활성화'}
        >
          {type.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
        </button>
      </td>
    </tr>
  );
}

function InputField({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      />
    </label>
  );
}
