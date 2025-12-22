'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, RefreshCw, ChevronDown, ChevronUp, Calculator, Check } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useOrientation } from '../layout';

interface RecordType {
  id: number;
  name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
  display_order: number;
}

interface ScoreTable {
  id: number;
  record_type_id: number;
  record_type_name: string;
  unit: string;
  direction: string;
  name: string;
  max_score: number;
  min_score: number;
  score_step: number;
  value_step: number;
  decimal_places: number;
  male_perfect: number;
  female_perfect: number;
}

interface ScoreRange {
  id: number;
  score_table_id: number;
  score: number;
  male_min: number;
  male_max: number;
  female_min: number;
  female_max: number;
}

export default function TabletSettingsPage() {
  const orientation = useOrientation();
  const [activeTab, setActiveTab] = useState<'types' | 'scores'>('types');
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [scoreTables, setScoreTables] = useState<ScoreTable[]>([]);
  const [loading, setLoading] = useState(true);

  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<RecordType | null>(null);
  const [typeForm, setTypeForm] = useState<{ name: string; unit: string; direction: 'higher' | 'lower' }>({
    name: '', unit: '', direction: 'higher'
  });

  const [showScoreForm, setShowScoreForm] = useState(false);
  const [selectedTypeForScore, setSelectedTypeForScore] = useState<number | null>(null);
  const [scoreForm, setScoreForm] = useState({
    max_score: 100,
    min_score: 50,
    score_step: 2,
    value_step: 5,
    decimal_places: 0,
    male_perfect: 300,
    female_perfect: 250
  });
  const [expandedScoreTable, setExpandedScoreTable] = useState<number | null>(null);
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(false);
  const [editingRanges, setEditingRanges] = useState<{ [key: number]: ScoreRange }>({});
  const [savingRange, setSavingRange] = useState<number | null>(null);
  const [currentTable, setCurrentTable] = useState<ScoreTable | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [typesRes, tablesRes] = await Promise.all([
        apiClient.get('/record-types'),
        apiClient.get('/score-tables')
      ]);
      setRecordTypes(typesRes.data.recordTypes || []);
      setScoreTables(tablesRes.data.scoreTables || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveType = async () => {
    try {
      if (editingType) {
        await apiClient.put(`/record-types/${editingType.id}`, {
          ...typeForm,
          is_active: editingType.is_active,
          display_order: editingType.display_order
        });
      } else {
        await apiClient.post('/record-types', typeForm);
      }
      setShowTypeForm(false);
      setEditingType(null);
      setTypeForm({ name: '', unit: '', direction: 'higher' });
      fetchData();
    } catch (error) {
      console.error('Failed to save type:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const deleteType = async (id: number) => {
    if (!confirm('이 종목을 비활성화하시겠습니까?')) return;
    try {
      await apiClient.delete(`/record-types/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete type:', error);
    }
  };

  const startEditType = (type: RecordType) => {
    setEditingType(type);
    setTypeForm({ name: type.name, unit: type.unit, direction: type.direction });
    setShowTypeForm(true);
  };

  const createScoreTable = async () => {
    if (!selectedTypeForScore) {
      alert('종목을 선택하세요.');
      return;
    }
    if (!scoreForm.score_step || scoreForm.score_step < 1) {
      alert('급간 점수는 1 이상이어야 합니다.');
      return;
    }
    try {
      await apiClient.post('/score-tables', {
        record_type_id: selectedTypeForScore,
        ...scoreForm
      });
      setShowScoreForm(false);
      setSelectedTypeForScore(null);
      fetchData();
      alert('배점표가 생성되었습니다!');
    } catch (error) {
      console.error('Failed to create score table:', error);
      alert('배점표 생성에 실패했습니다.');
    }
  };

  const toggleScoreTable = async (tableId: number) => {
    if (expandedScoreTable === tableId) {
      setExpandedScoreTable(null);
      setScoreRanges([]);
      setEditingRanges({});
      setCurrentTable(null);
      return;
    }

    try {
      setLoadingRanges(true);
      setExpandedScoreTable(tableId);
      const res = await apiClient.get(`/score-tables/${tableId}`);
      setScoreRanges(res.data.ranges || []);
      setCurrentTable(res.data.scoreTable || null);
      setEditingRanges({});
    } catch (error) {
      console.error('Failed to fetch ranges:', error);
    } finally {
      setLoadingRanges(false);
    }
  };

  const deleteScoreTable = async (id: number) => {
    if (!confirm('이 배점표를 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/score-tables/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete score table:', error);
    }
  };

  const startEditRange = (range: ScoreRange) => {
    setEditingRanges({ ...editingRanges, [range.id]: { ...range } });
  };

  const cancelEditRange = (rangeId: number) => {
    const newEditing = { ...editingRanges };
    delete newEditing[rangeId];
    setEditingRanges(newEditing);
  };

  const updateEditingRange = (rangeId: number, field: keyof ScoreRange, value: number) => {
    setEditingRanges({
      ...editingRanges,
      [rangeId]: { ...editingRanges[rangeId], [field]: value }
    });
  };

  const saveRange = async (rangeId: number) => {
    const range = editingRanges[rangeId];
    if (!range) return;

    try {
      setSavingRange(rangeId);
      await apiClient.put(`/score-tables/ranges/${rangeId}`, {
        male_min: range.male_min,
        male_max: range.male_max,
        female_min: range.female_min,
        female_max: range.female_max
      });

      setScoreRanges(scoreRanges.map(r => r.id === rangeId ? range : r));
      cancelEditRange(rangeId);
    } catch (error) {
      console.error('Failed to save range:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSavingRange(null);
    }
  };

  const typesWithoutScore = recordTypes.filter(
    t => t.is_active && !scoreTables.some(s => s.record_type_id === t.id)
  );

  const formatValue = (value: number | string | null | undefined, decimalPlaces: number = 0) => {
    if (value == null || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    if (numValue >= 9999) return '이상';
    if (numValue <= 0) return '이하';
    return numValue.toFixed(decimalPlaces);
  };

  return (
    <div className="tablet-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">실기측정설정</h1>
          <p className="text-slate-500 text-sm mt-1">종목 및 배점표 관리</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('types')}
          className={`px-6 py-3 rounded-xl font-medium transition ${
            activeTab === 'types'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          측정 종목
        </button>
        <button
          onClick={() => setActiveTab('scores')}
          className={`px-6 py-3 rounded-xl font-medium transition ${
            activeTab === 'scores'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          배점표
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl shadow-sm">
          <RefreshCw size={40} className="animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'types' ? (
        <div className="space-y-4">
          <button
            onClick={() => {
              setEditingType(null);
              setTypeForm({ name: '', unit: '', direction: 'higher' });
              setShowTypeForm(true);
            }}
            className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition"
          >
            <Plus size={18} />
            <span className="font-medium">종목 추가</span>
          </button>

          {/* Type Form Modal */}
          {showTypeForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-lg">
                    {editingType ? '종목 수정' : '새 종목 추가'}
                  </h3>
                  <button onClick={() => setShowTypeForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">종목명</label>
                    <input
                      type="text"
                      value={typeForm.name}
                      onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
                      placeholder="제자리멀리뛰기"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">단위</label>
                    <input
                      type="text"
                      value={typeForm.unit}
                      onChange={e => setTypeForm({ ...typeForm, unit: e.target.value })}
                      placeholder="cm, m, 초"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">방향</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTypeForm({ ...typeForm, direction: 'higher' })}
                        className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                          typeForm.direction === 'higher'
                            ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        높을수록 좋음 ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeForm({ ...typeForm, direction: 'lower' })}
                        className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                          typeForm.direction === 'lower'
                            ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        낮을수록 좋음 ↓
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                  <button onClick={() => setShowTypeForm(false)} className="px-6 py-3 text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                    취소
                  </button>
                  <button
                    onClick={saveType}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                  >
                    <Save size={18} />
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Types List */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className={`divide-y divide-slate-100 ${orientation === 'landscape' ? 'max-h-[calc(100vh-300px)] overflow-y-auto' : ''}`}>
              {recordTypes.map(type => (
                <div key={type.id} className={`p-4 flex items-center justify-between ${type.is_active ? '' : 'opacity-50'}`}>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-slate-800 text-lg">{type.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">{type.unit}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          type.direction === 'higher' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {type.direction === 'higher' ? '높을수록↑' : '낮을수록↓'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          type.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {type.is_active ? '활성' : '비활성'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEditType(type)} className="p-3 text-slate-400 hover:text-orange-500">
                      <Edit2 size={20} />
                    </button>
                    <button onClick={() => deleteType(type.id)} className="p-3 text-slate-400 hover:text-red-500">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {typesWithoutScore.length > 0 && (
            <button
              onClick={() => setShowScoreForm(true)}
              className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition"
            >
              <Calculator size={18} />
              <span className="font-medium">배점표 생성</span>
            </button>
          )}

          {/* Score Form Modal */}
          {showScoreForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-lg">배점표 생성</h3>
                  <button onClick={() => setShowScoreForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">종목 선택</label>
                    <select
                      value={selectedTypeForScore || ''}
                      onChange={e => setSelectedTypeForScore(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                    >
                      <option value="">선택하세요</option>
                      {typesWithoutScore.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.unit}, {t.direction === 'higher' ? '높을수록↑' : '낮을수록↓'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">만점 점수</label>
                      <input
                        type="number"
                        value={scoreForm.max_score}
                        onChange={e => setScoreForm({ ...scoreForm, max_score: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">최소 점수</label>
                      <input
                        type="number"
                        value={scoreForm.min_score}
                        onChange={e => setScoreForm({ ...scoreForm, min_score: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">급간 점수</label>
                      <input
                        type="number"
                        min="1"
                        value={scoreForm.score_step}
                        onChange={e => setScoreForm({ ...scoreForm, score_step: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">1감점당 단위</label>
                      <input
                        type="number"
                        step="0.01"
                        value={scoreForm.value_step}
                        onChange={e => setScoreForm({ ...scoreForm, value_step: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">소수점 자리수</label>
                    <div className="flex gap-2">
                      {[{ v: 0, l: '정수' }, { v: 1, l: '1자리' }, { v: 2, l: '2자리' }].map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setScoreForm({ ...scoreForm, decimal_places: opt.v })}
                          className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                            scoreForm.decimal_places === opt.v
                              ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-500'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">남자 만점 기록</label>
                      <input
                        type="number"
                        step="0.01"
                        value={scoreForm.male_perfect}
                        onChange={e => setScoreForm({ ...scoreForm, male_perfect: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">여자 만점 기록</label>
                      <input
                        type="number"
                        step="0.01"
                        value={scoreForm.female_perfect}
                        onChange={e => setScoreForm({ ...scoreForm, female_perfect: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 text-base"
                      />
                    </div>
                  </div>
                </div>
                <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                  <button onClick={() => setShowScoreForm(false)} className="px-6 py-3 text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                    취소
                  </button>
                  <button
                    onClick={createScoreTable}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                  >
                    <Calculator size={18} />
                    배점표 생성
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Score Tables List */}
          {scoreTables.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Calculator size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-lg">생성된 배점표가 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">배점표 생성 버튼을 눌러 만들어보세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scoreTables.map(table => (
                <div key={table.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleScoreTable(table.id)}
                  >
                    <div>
                      <h3 className="font-semibold text-slate-800 text-lg">{table.record_type_name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                          만점 {table.max_score}점
                        </span>
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                          최소 {table.min_score}점
                        </span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-lg">
                          남 {table.male_perfect}{table.unit}
                        </span>
                        <span className="text-xs px-2 py-1 bg-pink-100 text-pink-600 rounded-lg">
                          여 {table.female_perfect}{table.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteScoreTable(table.id); }}
                        className="p-2 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={20} />
                      </button>
                      {expandedScoreTable === table.id ? (
                        <ChevronUp size={24} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={24} className="text-slate-400" />
                      )}
                    </div>
                  </div>

                  {expandedScoreTable === table.id && (
                    <div className="border-t border-slate-100">
                      {loadingRanges ? (
                        <div className="flex justify-center py-8">
                          <RefreshCw size={24} className="animate-spin text-slate-400" />
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="py-3 px-4 text-center font-bold text-slate-700 border-b border-slate-200">배점</th>
                                <th colSpan={2} className="py-3 px-4 text-center font-bold text-blue-600 border-b border-blue-200 bg-blue-50/50">
                                  남자 ({table.unit})
                                </th>
                                <th colSpan={2} className="py-3 px-4 text-center font-bold text-pink-600 border-b border-pink-200 bg-pink-50/50">
                                  여자 ({table.unit})
                                </th>
                                <th className="py-3 px-4 text-center font-bold text-slate-700 border-b border-slate-200">수정</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scoreRanges.map((range, idx) => {
                                const isEditing = !!editingRanges[range.id];
                                const editData = editingRanges[range.id];
                                const decimalPlaces = currentTable?.decimal_places || 0;
                                const isFirst = idx === 0;
                                const isLast = idx === scoreRanges.length - 1;

                                return (
                                  <tr
                                    key={range.id}
                                    className={`border-b border-slate-100 ${isFirst ? 'bg-orange-50' : isLast ? 'bg-slate-50' : ''} ${isEditing ? 'bg-yellow-50' : ''}`}
                                  >
                                    <td className="py-3 px-4 text-center">
                                      <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold ${
                                        isFirst ? 'bg-orange-500 text-white' : isLast ? 'bg-slate-300 text-slate-700' : 'bg-slate-200 text-slate-700'
                                      }`}>
                                        {range.score}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-blue-700">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step={Math.pow(10, -decimalPlaces)}
                                          value={editData.male_min}
                                          onChange={e => updateEditingRange(range.id, 'male_min', Number(e.target.value))}
                                          className="w-20 px-2 py-1 border border-blue-300 rounded text-center text-sm"
                                        />
                                      ) : (
                                        formatValue(range.male_min, decimalPlaces)
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center text-blue-700">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step={Math.pow(10, -decimalPlaces)}
                                          value={editData.male_max >= 9999 ? '' : editData.male_max}
                                          onChange={e => updateEditingRange(range.id, 'male_max', e.target.value ? Number(e.target.value) : 9999.99)}
                                          placeholder="이상"
                                          className="w-20 px-2 py-1 border border-blue-300 rounded text-center text-sm"
                                        />
                                      ) : (
                                        formatValue(range.male_max, decimalPlaces)
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center text-pink-700">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step={Math.pow(10, -decimalPlaces)}
                                          value={editData.female_min}
                                          onChange={e => updateEditingRange(range.id, 'female_min', Number(e.target.value))}
                                          className="w-20 px-2 py-1 border border-pink-300 rounded text-center text-sm"
                                        />
                                      ) : (
                                        formatValue(range.female_min, decimalPlaces)
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center text-pink-700">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step={Math.pow(10, -decimalPlaces)}
                                          value={editData.female_max >= 9999 ? '' : editData.female_max}
                                          onChange={e => updateEditingRange(range.id, 'female_max', e.target.value ? Number(e.target.value) : 9999.99)}
                                          placeholder="이상"
                                          className="w-20 px-2 py-1 border border-pink-300 rounded text-center text-sm"
                                        />
                                      ) : (
                                        formatValue(range.female_max, decimalPlaces)
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {isEditing ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            onClick={() => saveRange(range.id)}
                                            disabled={savingRange === range.id}
                                            className="p-2 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
                                          >
                                            {savingRange === range.id ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                                          </button>
                                          <button
                                            onClick={() => cancelEditRange(range.id)}
                                            className="p-2 text-slate-400 hover:bg-slate-100 rounded"
                                          >
                                            <X size={16} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditRange(range)}
                                          className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded"
                                        >
                                          <Edit2 size={16} />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
