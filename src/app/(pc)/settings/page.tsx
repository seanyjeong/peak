'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, RefreshCw, ChevronDown, ChevronUp, Calculator, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import apiClient from '@/lib/api/client';

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'types' | 'scores'>('types');
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [scoreTables, setScoreTables] = useState<ScoreTable[]>([]);
  const [loading, setLoading] = useState(true);

  // 종목 관리 상태
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<RecordType | null>(null);
  const [typeForm, setTypeForm] = useState<{ name: string; unit: string; direction: 'higher' | 'lower' }>({ name: '', unit: '', direction: 'higher' });

  // 배점표 관리 상태
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

  // 종목 저장
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

  const toggleTypeActive = async (type: RecordType) => {
    const newStatus = !type.is_active;
    const action = newStatus ? '활성화' : '비활성화';
    if (!confirm(`"${type.name}" 종목을 ${action}하시겠습니까?`)) return;
    try {
      await apiClient.put(`/record-types/${type.id}`, {
        name: type.name,
        unit: type.unit,
        direction: type.direction,
        is_active: newStatus,
        display_order: type.display_order
      });
      fetchData();
    } catch (error) {
      console.error('Failed to toggle type:', error);
    }
  };

  const startEditType = (type: RecordType) => {
    setEditingType(type);
    setTypeForm({ name: type.name, unit: type.unit, direction: type.direction });
    setShowTypeForm(true);
  };

  // 배점표 생성
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

  // 배점표 상세 보기
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

  // 개별 구간 수정
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

  // 배점표 없는 종목
  const typesWithoutScore = recordTypes.filter(
    t => t.is_active && !scoreTables.some(s => s.record_type_id === t.id)
  );

  // 숫자 포맷팅
  const formatValue = (value: number | string | null | undefined, decimalPlaces: number = 0) => {
    if (value == null || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    if (numValue >= 9999) return '이상';
    if (numValue <= 0) return '이하';
    return numValue.toFixed(decimalPlaces);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">실기측정설정</h1>
          <p className="text-slate-500 mt-1">종목 및 배점표 관리</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('types')}
          className={`px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'types'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          측정 종목
        </button>
        <button
          onClick={() => setActiveTab('scores')}
          className={`px-6 py-3 rounded-lg font-medium transition ${
            activeTab === 'scores'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          배점표
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl shadow-sm">
          <RefreshCw size={32} className="animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'types' ? (
        /* 종목 관리 탭 */
        <div className="space-y-4">
          {/* Add Button */}
          <button
            onClick={() => {
              setEditingType(null);
              setTypeForm({ name: '', unit: '', direction: 'higher' });
              setShowTypeForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
          >
            <Plus size={18} />
            <span>종목 추가</span>
          </button>

          {/* Type Form */}
          {showTypeForm && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">
                  {editingType ? '종목 수정' : '새 종목 추가'}
                </h3>
                <button onClick={() => setShowTypeForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">종목명</label>
                  <input
                    type="text"
                    value={typeForm.name}
                    onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
                    placeholder="제자리멀리뛰기"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">단위</label>
                  <input
                    type="text"
                    value={typeForm.unit}
                    onChange={e => setTypeForm({ ...typeForm, unit: e.target.value })}
                    placeholder="cm, m, 초"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">방향</label>
                  <select
                    value={typeForm.direction}
                    onChange={e => setTypeForm({ ...typeForm, direction: e.target.value as 'higher' | 'lower' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="higher">높을수록 좋음 ↑</option>
                    <option value="lower">낮을수록 좋음 ↓</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowTypeForm(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  onClick={saveType}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  <Save size={16} />
                  저장
                </button>
              </div>
            </div>
          )}

          {/* Types List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">종목명</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">단위</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">방향</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">상태</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recordTypes.map(type => (
                  <tr key={type.id} className={type.is_active ? '' : 'opacity-50'}>
                    <td className="py-3 px-4 font-medium text-slate-800">{type.name}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{type.unit}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        type.direction === 'higher'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {type.direction === 'higher' ? '높을수록↑' : '낮을수록↓'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        type.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {type.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => startEditType(type)}
                        className="p-2 text-slate-400 hover:text-orange-500"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => toggleTypeActive(type)}
                        className={`p-2 ${type.is_active ? 'text-green-500 hover:text-red-500' : 'text-slate-400 hover:text-green-500'}`}
                        title={type.is_active ? '비활성화' : '활성화'}
                      >
                        {type.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 배점표 관리 탭 */
        <div className="space-y-4">
          {/* Add Button */}
          {typesWithoutScore.length > 0 && (
            <button
              onClick={() => setShowScoreForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <Calculator size={18} />
              <span>배점표 생성</span>
            </button>
          )}

          {/* Score Form */}
          {showScoreForm && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">배점표 생성</h3>
                <button onClick={() => setShowScoreForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {/* 종목 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">종목 선택</label>
                <select
                  value={selectedTypeForScore || ''}
                  onChange={e => setSelectedTypeForScore(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">선택하세요</option>
                  {typesWithoutScore.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.unit}, {t.direction === 'higher' ? '높을수록↑' : '낮을수록↓'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">만점 점수</label>
                  <input
                    type="number"
                    value={scoreForm.max_score}
                    onChange={e => setScoreForm({ ...scoreForm, max_score: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">최소 점수</label>
                  <input
                    type="number"
                    value={scoreForm.min_score}
                    onChange={e => setScoreForm({ ...scoreForm, min_score: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">급간 점수</label>
                  <input
                    type="number"
                    min="1"
                    value={scoreForm.score_step}
                    onChange={e => setScoreForm({ ...scoreForm, score_step: Number(e.target.value) })}
                    placeholder="2점씩"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">1감점당 단위</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scoreForm.value_step}
                    onChange={e => setScoreForm({ ...scoreForm, value_step: Number(e.target.value) })}
                    placeholder="5cm, 0.1초"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">소수점 자리수</label>
                  <select
                    value={scoreForm.decimal_places}
                    onChange={e => setScoreForm({ ...scoreForm, decimal_places: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value={0}>정수 (0자리)</option>
                    <option value={1}>소수점 1자리 (0.1)</option>
                    <option value={2}>소수점 2자리 (0.01)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">남자 만점 기록</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scoreForm.male_perfect}
                    onChange={e => setScoreForm({ ...scoreForm, male_perfect: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">여자 만점 기록</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scoreForm.female_perfect}
                    onChange={e => setScoreForm({ ...scoreForm, female_perfect: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowScoreForm(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  onClick={createScoreTable}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  <Calculator size={16} />
                  배점표 생성
                </button>
              </div>
            </div>
          )}

          {/* Score Tables List */}
          {scoreTables.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Calculator size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">생성된 배점표가 없습니다.</p>
              <p className="text-slate-400 text-sm mt-1">배점표 생성 버튼을 눌러 만들어보세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scoreTables.map(table => (
                <div key={table.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Header */}
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleScoreTable(table.id)}
                  >
                    <div>
                      <h3 className="font-semibold text-slate-800 text-lg">{table.record_type_name}</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                          만점 {table.max_score}점
                        </span>
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                          최소 {table.min_score}점
                        </span>
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                          {table.score_step}점 간격
                        </span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">
                          남 {table.male_perfect}{table.unit}
                        </span>
                        <span className="text-xs px-2 py-1 bg-pink-100 text-pink-600 rounded">
                          여 {table.female_perfect}{table.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteScoreTable(table.id); }}
                        className="p-2 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                      {expandedScoreTable === table.id ? (
                        <ChevronUp size={20} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={20} className="text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
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
                              <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
                                <th className="py-3 px-4 text-center font-bold text-slate-700 border-b-2 border-slate-200 w-20">
                                  배점
                                </th>
                                <th colSpan={2} className="py-3 px-4 text-center font-bold text-blue-600 border-b-2 border-blue-200 bg-blue-50/50">
                                  남자 기록 ({table.unit})
                                </th>
                                <th colSpan={2} className="py-3 px-4 text-center font-bold text-pink-600 border-b-2 border-pink-200 bg-pink-50/50">
                                  여자 기록 ({table.unit})
                                </th>
                                <th className="py-3 px-4 text-center font-bold text-slate-700 border-b-2 border-slate-200 w-24">
                                  수정
                                </th>
                              </tr>
                              <tr className="bg-slate-50 text-xs">
                                <th className="py-2 px-4 text-slate-500"></th>
                                <th className="py-2 px-4 text-blue-500">최소</th>
                                <th className="py-2 px-4 text-blue-500">최대</th>
                                <th className="py-2 px-4 text-pink-500">최소</th>
                                <th className="py-2 px-4 text-pink-500">최대</th>
                                <th className="py-2 px-4"></th>
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
                                    className={`border-b border-slate-100 ${
                                      isFirst ? 'bg-orange-50' : isLast ? 'bg-slate-50' : 'hover:bg-slate-50'
                                    } ${isEditing ? 'bg-yellow-50' : ''}`}
                                  >
                                    <td className="py-3 px-4 text-center">
                                      <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold ${
                                        isFirst
                                          ? 'bg-orange-500 text-white'
                                          : isLast
                                            ? 'bg-slate-300 text-slate-700'
                                            : 'bg-slate-200 text-slate-700'
                                      }`}>
                                        {range.score}
                                      </span>
                                    </td>

                                    {/* 남자 최소 */}
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
                                        <span className={range.male_min <= 0 ? 'text-slate-400' : ''}>
                                          {formatValue(range.male_min, decimalPlaces)}
                                        </span>
                                      )}
                                    </td>

                                    {/* 남자 최대 */}
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
                                        <span className={range.male_max >= 9999 ? 'text-slate-400' : ''}>
                                          {formatValue(range.male_max, decimalPlaces)}
                                        </span>
                                      )}
                                    </td>

                                    {/* 여자 최소 */}
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
                                        <span className={range.female_min <= 0 ? 'text-slate-400' : ''}>
                                          {formatValue(range.female_min, decimalPlaces)}
                                        </span>
                                      )}
                                    </td>

                                    {/* 여자 최대 */}
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
                                        <span className={range.female_max >= 9999 ? 'text-slate-400' : ''}>
                                          {formatValue(range.female_max, decimalPlaces)}
                                        </span>
                                      )}
                                    </td>

                                    {/* 수정 버튼 */}
                                    <td className="py-3 px-4 text-center">
                                      {isEditing ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            onClick={() => saveRange(range.id)}
                                            disabled={savingRange === range.id}
                                            className="p-1.5 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
                                          >
                                            {savingRange === range.id ? (
                                              <RefreshCw size={16} className="animate-spin" />
                                            ) : (
                                              <Check size={16} />
                                            )}
                                          </button>
                                          <button
                                            onClick={() => cancelEditRange(range.id)}
                                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                                          >
                                            <X size={16} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditRange(range)}
                                          className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded"
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
