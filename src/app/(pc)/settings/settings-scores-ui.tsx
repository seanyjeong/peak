import { Calculator, Check, ChevronDown, ChevronUp, Edit2, RefreshCw, Save, Trash2, X } from 'lucide-react';
import type { RecordType, ScoreForm, ScoreRange, ScoreTable } from './settings-model';
import { formatRangeValue, getDirectionLabel } from './settings-model';

export function ScoreTablesPanel({
  currentTable,
  editingRanges,
  expandedScoreTable,
  loadingRanges,
  onCancelForm,
  onCancelRange,
  onCreate,
  onDelete,
  onEditRange,
  onFormChange,
  onRangeChange,
  onSaveRange,
  onShowForm,
  onToggleTable,
  savingRange,
  scoreForm,
  scoreRanges,
  scoreTables,
  selectedTypeForScore,
  setSelectedTypeForScore,
  showForm,
  typesWithoutScore,
}: {
  currentTable: ScoreTable | null;
  editingRanges: Record<number, ScoreRange>;
  expandedScoreTable: number | null;
  loadingRanges: boolean;
  onCancelForm: () => void;
  onCancelRange: (rangeId: number) => void;
  onCreate: () => void;
  onDelete: (tableId: number) => void;
  onEditRange: (range: ScoreRange) => void;
  onFormChange: (form: ScoreForm) => void;
  onRangeChange: (rangeId: number, field: keyof ScoreRange, value: number) => void;
  onSaveRange: (rangeId: number) => void;
  onShowForm: () => void;
  onToggleTable: (tableId: number) => void;
  savingRange: number | null;
  scoreForm: ScoreForm;
  scoreRanges: ScoreRange[];
  scoreTables: ScoreTable[];
  selectedTypeForScore: number | null;
  setSelectedTypeForScore: (typeId: number | null) => void;
  showForm: boolean;
  typesWithoutScore: RecordType[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">배점표</h2>
          <p className="mt-1 text-sm text-slate-500">자동 생성 후 학생별 상황에 맞게 구간을 직접 수정할 수 있습니다.</p>
        </div>
        {typesWithoutScore.length > 0 && (
          <button
            type="button"
            onClick={onShowForm}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            <Calculator className="h-4 w-4" />
            배점표 생성
          </button>
        )}
      </div>

      {showForm && (
        <ScoreFormCard
          onCancel={onCancelForm}
          onChange={onFormChange}
          onCreate={onCreate}
          scoreForm={scoreForm}
          selectedTypeForScore={selectedTypeForScore}
          setSelectedTypeForScore={setSelectedTypeForScore}
          typesWithoutScore={typesWithoutScore}
        />
      )}

      {scoreTables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-950">
          <Calculator className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">생성된 배점표가 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">종목을 먼저 만든 뒤 배점표를 생성하세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scoreTables.map((table) => (
            <ScoreTableCard
              key={table.id}
              currentTable={currentTable}
              editingRanges={editingRanges}
              expanded={expandedScoreTable === table.id}
              loadingRanges={loadingRanges}
              onCancelRange={onCancelRange}
              onDelete={onDelete}
              onEditRange={onEditRange}
              onRangeChange={onRangeChange}
              onSaveRange={onSaveRange}
              onToggle={onToggleTable}
              savingRange={savingRange}
              scoreRanges={scoreRanges}
              table={table}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreFormCard({
  onCancel,
  onChange,
  onCreate,
  scoreForm,
  selectedTypeForScore,
  setSelectedTypeForScore,
  typesWithoutScore,
}: {
  onCancel: () => void;
  onChange: (form: ScoreForm) => void;
  onCreate: () => void;
  scoreForm: ScoreForm;
  selectedTypeForScore: number | null;
  setSelectedTypeForScore: (typeId: number | null) => void;
  typesWithoutScore: RecordType[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-950 dark:text-white">배점표 생성</h3>
        <button type="button" onClick={onCancel} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        종목
        <select
          value={selectedTypeForScore ?? ''}
          onChange={(event) => setSelectedTypeForScore(event.target.value ? Number(event.target.value) : null)}
          className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        >
          <option value="">선택하세요</option>
          {typesWithoutScore.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} · {type.unit} · {getDirectionLabel(type.direction)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <NumberField label="만점 점수" value={scoreForm.max_score} onChange={(value) => onChange({ ...scoreForm, max_score: value })} />
        <NumberField label="최소 점수" value={scoreForm.min_score} onChange={(value) => onChange({ ...scoreForm, min_score: value })} />
        <NumberField label="급간 점수" min={1} value={scoreForm.score_step} onChange={(value) => onChange({ ...scoreForm, score_step: value })} />
        <NumberField label="1감점당 단위" step="0.01" value={scoreForm.value_step} onChange={(value) => onChange({ ...scoreForm, value_step: value })} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          소수점 자리수
          <select
            value={scoreForm.decimal_places}
            onChange={(event) => onChange({ ...scoreForm, decimal_places: Number(event.target.value) })}
            className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            <option value={0}>정수</option>
            <option value={1}>소수점 1자리</option>
            <option value={2}>소수점 2자리</option>
          </select>
        </label>
        <NumberField label="남자 만점 기록" step="0.01" value={scoreForm.male_perfect} onChange={(value) => onChange({ ...scoreForm, male_perfect: value })} />
        <NumberField label="여자 만점 기록" step="0.01" value={scoreForm.female_perfect} onChange={(value) => onChange({ ...scoreForm, female_perfect: value })} />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
          취소
        </button>
        <button type="button" onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          <Save className="h-4 w-4" />
          생성
        </button>
      </div>
    </section>
  );
}

function ScoreTableCard({
  currentTable,
  editingRanges,
  expanded,
  loadingRanges,
  onCancelRange,
  onDelete,
  onEditRange,
  onRangeChange,
  onSaveRange,
  onToggle,
  savingRange,
  scoreRanges,
  table,
}: {
  currentTable: ScoreTable | null;
  editingRanges: Record<number, ScoreRange>;
  expanded: boolean;
  loadingRanges: boolean;
  onCancelRange: (rangeId: number) => void;
  onDelete: (tableId: number) => void;
  onEditRange: (range: ScoreRange) => void;
  onRangeChange: (rangeId: number, field: keyof ScoreRange, value: number) => void;
  onSaveRange: (rangeId: number) => void;
  onToggle: (tableId: number) => void;
  savingRange: number | null;
  scoreRanges: ScoreRange[];
  table: ScoreTable;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900">
        <button type="button" onClick={() => onToggle(table.id)} className="min-w-0 flex-1 text-left">
        <div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-white">{table.record_type_name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <ScoreChip label={`만점 ${table.max_score}점`} />
            <ScoreChip label={`최소 ${table.min_score}점`} />
            <ScoreChip label={`${table.score_step}점 간격`} />
            <ScoreChip label={`남 ${table.male_perfect}${table.unit}`} tone="blue" />
            <ScoreChip label={`여 ${table.female_perfect}${table.unit}`} tone="rose" />
          </div>
        </div>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`${table.record_type_name} 배점표 삭제`}
            onClick={() => onDelete(table.id)}
            className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" aria-label={`${table.record_type_name} 배점표 ${expanded ? '접기' : '열기'}`} onClick={() => onToggle(table.id)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {loadingRanges ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <ScoreRangeTable
              decimalPlaces={currentTable?.decimal_places ?? table.decimal_places ?? 0}
              editingRanges={editingRanges}
              onCancelRange={onCancelRange}
              onEditRange={onEditRange}
              onRangeChange={onRangeChange}
              onSaveRange={onSaveRange}
              ranges={scoreRanges}
              savingRange={savingRange}
              unit={table.unit}
            />
          )}
        </div>
      )}
    </article>
  );
}

function ScoreRangeTable({
  decimalPlaces,
  editingRanges,
  onCancelRange,
  onEditRange,
  onRangeChange,
  onSaveRange,
  ranges,
  savingRange,
  unit,
}: {
  decimalPlaces: number;
  editingRanges: Record<number, ScoreRange>;
  onCancelRange: (rangeId: number) => void;
  onEditRange: (range: ScoreRange) => void;
  onRangeChange: (rangeId: number, field: keyof ScoreRange, value: number) => void;
  onSaveRange: (rangeId: number) => void;
  ranges: ScoreRange[];
  savingRange: number | null;
  unit: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <th className="px-4 py-3 text-center font-bold">배점</th>
            <th className="px-3 py-3 text-center font-bold text-blue-700">남자 최소</th>
            <th className="px-3 py-3 text-center font-bold text-blue-700">남자 최대</th>
            <th className="px-3 py-3 text-center font-bold text-rose-700">여자 최소</th>
            <th className="px-3 py-3 text-center font-bold text-rose-700">여자 최대</th>
            <th className="px-4 py-3 text-center font-bold">수정</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {ranges.map((range) => (
            <ScoreRangeRow
              key={range.id}
              decimalPlaces={decimalPlaces}
              editingRange={editingRanges[range.id]}
              onCancelRange={onCancelRange}
              onEditRange={onEditRange}
              onRangeChange={onRangeChange}
              onSaveRange={onSaveRange}
              range={range}
              saving={savingRange === range.id}
              unit={unit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreRangeRow({
  decimalPlaces,
  editingRange,
  onCancelRange,
  onEditRange,
  onRangeChange,
  onSaveRange,
  range,
  saving,
  unit,
}: {
  decimalPlaces: number;
  editingRange?: ScoreRange;
  onCancelRange: (rangeId: number) => void;
  onEditRange: (range: ScoreRange) => void;
  onRangeChange: (rangeId: number, field: keyof ScoreRange, value: number) => void;
  onSaveRange: (rangeId: number) => void;
  range: ScoreRange;
  saving: boolean;
  unit: string;
}) {
  const editData = editingRange ?? range;
  const step = String(Math.pow(10, -decimalPlaces));

  return (
    <tr className={editingRange ? 'bg-amber-50 dark:bg-amber-950/20' : undefined}>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-lg bg-slate-950 px-3 font-bold text-white">
          {range.score}
        </span>
      </td>
      <RangeValueCell decimalPlaces={decimalPlaces} field="male_min" rangeId={range.id} unit={unit} value={editData.male_min} editing={Boolean(editingRange)} step={step} onChange={onRangeChange} />
      <RangeValueCell decimalPlaces={decimalPlaces} field="male_max" rangeId={range.id} unit={unit} value={editData.male_max} editing={Boolean(editingRange)} step={step} onChange={onRangeChange} />
      <RangeValueCell decimalPlaces={decimalPlaces} field="female_min" rangeId={range.id} unit={unit} value={editData.female_min} editing={Boolean(editingRange)} step={step} onChange={onRangeChange} />
      <RangeValueCell decimalPlaces={decimalPlaces} field="female_max" rangeId={range.id} unit={unit} value={editData.female_max} editing={Boolean(editingRange)} step={step} onChange={onRangeChange} />
      <td className="px-4 py-3 text-center">
        {editingRange ? (
          <div className="flex justify-center gap-1">
            <button type="button" aria-label={`${range.score}점 구간 저장`} onClick={() => onSaveRange(range.id)} disabled={saving} className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button type="button" aria-label={`${range.score}점 수정 취소`} onClick={() => onCancelRange(range.id)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" aria-label={`${range.score}점 구간 수정`} onClick={() => onEditRange(range)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

function RangeValueCell({
  decimalPlaces,
  editing,
  field,
  onChange,
  rangeId,
  step,
  unit,
  value,
}: {
  decimalPlaces: number;
  editing: boolean;
  field: keyof ScoreRange;
  onChange: (rangeId: number, field: keyof ScoreRange, value: number) => void;
  rangeId: number;
  step: string;
  unit: string;
  value: number;
}) {
  return (
    <td className="px-3 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
      {editing ? (
        <input
          type="number"
          step={step}
          value={value >= 9999 ? '' : value}
          placeholder="이상"
          onChange={(event) => onChange(rangeId, field, event.target.value ? Number(event.target.value) : 9999.99)}
          className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm outline-none focus:border-slate-950"
        />
      ) : (
        <span>{formatRangeValue(value, decimalPlaces)} {formatRangeValue(value, decimalPlaces) === '-' ? '' : unit}</span>
      )}
    </td>
  );
}

function NumberField({
  label,
  min,
  onChange,
  step = '1',
  value,
}: {
  label: string;
  min?: number;
  onChange: (value: number) => void;
  step?: string;
  value: number;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      />
    </label>
  );
}

function ScoreChip({ label, tone = 'slate' }: { label: string; tone?: 'blue' | 'rose' | 'slate' }) {
  const className = {
    blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];

  return <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${className}`}>{label}</span>;
}
