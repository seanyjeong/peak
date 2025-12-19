'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, RefreshCw, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
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
  const [typeForm, setTypeForm] = useState({ name: '', unit: '', direction: 'higher' as const });

  // 배점표 관리 상태
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [selectedTypeForScore, setSelectedTypeForScore] = useState<number | null>(null);
  const [scoreForm, setScoreForm] = useState({
    max_score: 100,
    min_score: 50,
    score_step: 2,
    value_step: 5,
    male_perfect: 300,
    female_perfect: 250
  });
  const [expandedScoreTable, setExpandedScoreTable] = useState<number | null>(null);
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(false);

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

  // 배점표 생성
  const createScoreTable = async () => {
    if (!selectedTypeForScore) {
      alert('종목을 선택하세요.');
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
      return;
    }

    try {
      setLoadingRanges(true);
      setExpandedScoreTable(tableId);
      const res = await apiClient.get(`/score-tables/${tableId}`);
      setScoreRanges(res.data.ranges || []);
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

  // 배점표 없는 종목
  const typesWithoutScore = recordTypes.filter(
    t => t.is_active && !scoreTables.some(s => s.record_type_id === t.id)
  );

  const formatValue = (value: number, isMax: boolean) => {
    if (isMax && value >= 9999) return '이상';
    if (!isMax && value <= 0) return '이하';
    return value;
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">설정</h1>
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
                        onClick={() => deleteType(type.id)}
                        className="p-2 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
                      <h3 className="font-semibold text-slate-800">{table.record_type_name}</h3>
                      <p className="text-sm text-slate-500">
                        만점 {table.max_score}점 / 최소 {table.min_score}점 / {table.score_step}점 간격
                      </p>
                      <p className="text-sm text-slate-400">
                        남 {table.male_perfect}{table.unit} / 여 {table.female_perfect}{table.unit}
                      </p>
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

                  {/* Expanded Content - 배점표 */}
                  {expandedScoreTable === table.id && (
                    <div className="border-t border-slate-100 p-4">
                      {loadingRanges ? (
                        <div className="flex justify-center py-8">
                          <RefreshCw size={24} className="animate-spin text-slate-400" />
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="py-2 px-3 text-center font-medium text-slate-600">배점</th>
                                <th className="py-2 px-3 text-center font-medium text-blue-600">남자 기록</th>
                                <th className="py-2 px-3 text-center font-medium text-pink-600">여자 기록</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {scoreRanges.map((range, idx) => (
                                <tr key={range.id} className={idx === 0 ? 'bg-orange-50' : ''}>
                                  <td className="py-2 px-3 text-center font-bold text-slate-800">
                                    {range.score}점
                                  </td>
                                  <td className="py-2 px-3 text-center text-blue-700">
                                    {range.male_max >= 9999
                                      ? `${range.male_min}${table.unit} 이상`
                                      : range.male_min <= 0
                                        ? `${range.male_max}${table.unit} 이하`
                                        : `${range.male_min}~${range.male_max}${table.unit}`
                                    }
                                  </td>
                                  <td className="py-2 px-3 text-center text-pink-700">
                                    {range.female_max >= 9999
                                      ? `${range.female_min}${table.unit} 이상`
                                      : range.female_min <= 0
                                        ? `${range.female_max}${table.unit} 이하`
                                        : `${range.female_min}~${range.female_max}${table.unit}`
                                    }
                                  </td>
                                </tr>
                              ))}
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
