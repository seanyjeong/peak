'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, ListChecks, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import apiClient from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import {
  type AcademyFeaturePermissions,
  type FeaturePermissions,
  getMyFeaturePermissions,
  permissionsAPI,
} from '@/lib/api/permissions';
import {
  DEFAULT_SCORE_FORM,
  DEFAULT_TYPE_FORM,
  getSettingsErrorMessage,
  RecordType,
  ScoreForm,
  ScoreRange,
  ScoreTable,
  SettingsTab,
  toNullableNumber,
  TypeForm,
} from './settings-model';
import { SettingsAccessDenied } from './settings-access-denied';
import { PermissionsPanel } from './settings-permissions-ui';
import { ScoreTablesPanel } from './settings-scores-ui';
import { TabButton } from './settings-tab-button';
import { RecordTypesPanel } from './settings-types-ui';

const DEFAULT_ACADEMY_PERMISSIONS: AcademyFeaturePermissions = {
  analyticsReport: false,
  measurementSettingsManage: false,
};

export default function SettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('types');
  const [academyPermissions, setAcademyPermissions] = useState<AcademyFeaturePermissions>(DEFAULT_ACADEMY_PERMISSIONS);
  const [currentTable, setCurrentTable] = useState<ScoreTable | null>(null);
  const [editingRanges, setEditingRanges] = useState<Record<number, ScoreRange>>({});
  const [editingType, setEditingType] = useState<RecordType | null>(null);
  const [expandedScoreTable, setExpandedScoreTable] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRanges, setLoadingRanges] = useState(false);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [savingRange, setSavingRange] = useState<number | null>(null);
  const [scoreForm, setScoreForm] = useState<ScoreForm>(DEFAULT_SCORE_FORM);
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [scoreTables, setScoreTables] = useState<ScoreTable[]>([]);
  const [selectedTypeForScore, setSelectedTypeForScore] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<FeaturePermissions | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState<TypeForm>(DEFAULT_TYPE_FORM);

  const typesWithoutScore = useMemo(
    () => recordTypes.filter((type) => type.is_active && !scoreTables.some((table) => table.record_type_id === type.id)),
    [recordTypes, scoreTables],
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [typesRes, tablesRes] = await Promise.all([
        apiClient.get('/record-types'),
        apiClient.get('/score-tables'),
      ]);
      setRecordTypes(typesRes.data.recordTypes || []);
      setScoreTables(tablesRes.data.scoreTables || []);
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, '설정 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initializeSettings() {
      const user = authAPI.getCurrentUser();
      if (!user) {
        setPermissions({
          analyticsReport: false,
          measurementSettingsManage: false,
          canManagePermissions: false,
        });
        setLoading(false);
        return;
      }

      const effectivePermissions = await getMyFeaturePermissions(user);
      if (!mounted) return;
      setPermissions(effectivePermissions);

      if (!effectivePermissions.measurementSettingsManage) {
        setLoading(false);
        return;
      }

      await fetchData();

      if (effectivePermissions.canManagePermissions) {
        try {
          const academyPermissionData = await permissionsAPI.getAcademy();
          if (mounted) setAcademyPermissions(academyPermissionData);
        } catch (error) {
          toast.error(getSettingsErrorMessage(error, '권한 설정을 불러오지 못했습니다.'));
        }
      }
    }

    initializeSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const resetTypeForm = () => {
    setEditingType(null);
    setTypeForm(DEFAULT_TYPE_FORM);
    setShowTypeForm(false);
  };

  const saveType = async () => {
    if (!typeForm.name.trim()) return toast.error('종목명을 입력해주세요.');
    if (!typeForm.unit.trim()) return toast.error('단위를 입력해주세요.');

    const payload = {
      name: typeForm.name.trim(),
      unit: typeForm.unit.trim(),
      direction: typeForm.direction,
      min_value: toNullableNumber(typeForm.min_value),
      max_value: toNullableNumber(typeForm.max_value),
    };

    try {
      if (editingType) {
        await apiClient.put(`/record-types/${editingType.id}`, {
          ...payload,
          display_order: editingType.display_order,
          is_active: editingType.is_active,
        });
      } else {
        await apiClient.post('/record-types', payload);
      }
      toast.success(editingType ? '종목을 수정했습니다.' : '종목을 추가했습니다.');
      resetTypeForm();
      await fetchData();
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, '종목을 저장하지 못했습니다.'));
    }
  };

  const startEditType = (type: RecordType) => {
    setEditingType(type);
    setTypeForm({
      name: type.name,
      unit: type.unit,
      direction: type.direction,
      min_value: type.min_value != null ? String(type.min_value) : '',
      max_value: type.max_value != null ? String(type.max_value) : '',
    });
    setShowTypeForm(true);
  };

  const toggleTypeActive = async (type: RecordType) => {
    const nextStatus = !type.is_active;
    if (!window.confirm(`${type.name} 종목을 ${nextStatus ? '활성화' : '비활성화'}할까요?`)) return;

    try {
      await apiClient.put(`/record-types/${type.id}`, {
        name: type.name,
        unit: type.unit,
        direction: type.direction,
        is_active: nextStatus,
        display_order: type.display_order,
        min_value: type.min_value,
        max_value: type.max_value,
      });
      toast.success(nextStatus ? '종목을 활성화했습니다.' : '종목을 비활성화했습니다.');
      await fetchData();
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, '종목 상태를 바꾸지 못했습니다.'));
    }
  };

  const createScoreTable = async () => {
    if (!selectedTypeForScore) return toast.error('종목을 선택해주세요.');
    if (!scoreForm.score_step || scoreForm.score_step < 1) return toast.error('급간 점수는 1 이상이어야 합니다.');

    try {
      await apiClient.post('/score-tables', {
        record_type_id: selectedTypeForScore,
        ...scoreForm,
      });
      toast.success('배점표를 생성했습니다.');
      setShowScoreForm(false);
      setSelectedTypeForScore(null);
      setScoreForm(DEFAULT_SCORE_FORM);
      await fetchData();
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, '배점표를 생성하지 못했습니다.'));
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
      toast.error(getSettingsErrorMessage(error, '배점표 상세를 불러오지 못했습니다.'));
    } finally {
      setLoadingRanges(false);
    }
  };

  const deleteScoreTable = async (tableId: number) => {
    if (!window.confirm('이 배점표를 삭제할까요?')) return;

    try {
      await apiClient.delete(`/score-tables/${tableId}`);
      toast.success('배점표를 삭제했습니다.');
      if (expandedScoreTable === tableId) {
        setExpandedScoreTable(null);
        setScoreRanges([]);
        setCurrentTable(null);
      }
      await fetchData();
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, '배점표를 삭제하지 못했습니다.'));
    }
  };

  const startEditRange = (range: ScoreRange) => {
    setEditingRanges((prev) => ({ ...prev, [range.id]: { ...range } }));
  };

  const cancelEditRange = (rangeId: number) => {
    setEditingRanges((prev) => {
      const next = { ...prev };
      delete next[rangeId];
      return next;
    });
  };

  const updateEditingRange = (rangeId: number, field: keyof ScoreRange, value: number) => {
    setEditingRanges((prev) => ({
      ...prev,
      [rangeId]: { ...prev[rangeId], [field]: value },
    }));
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
        female_max: range.female_max,
      });
      setScoreRanges((prev) => prev.map((item) => (item.id === rangeId ? range : item)));
      cancelEditRange(rangeId);
      toast.success('구간을 저장했습니다.');
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, '구간을 저장하지 못했습니다.'));
    } finally {
      setSavingRange(null);
    }
  };

  const togglePermission = (key: keyof AcademyFeaturePermissions) => {
    setAcademyPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const savePermissions = async () => {
    try {
      setSavingPermissions(true);
      const saved = await permissionsAPI.updateAcademy(academyPermissions);
      setAcademyPermissions(saved);
      toast.success('권한 설정을 저장했습니다.');
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, '권한 설정을 저장하지 못했습니다.'));
    } finally {
      setSavingPermissions(false);
    }
  };

  if (!loading && permissions && !permissions.measurementSettingsManage) {
    return <SettingsAccessDenied />;
  }

  const canManagePermissions = permissions?.canManagePermissions ?? false;

  return (
    <main className="max-w-[1440px] space-y-6 px-6 py-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-orange-700">MEASUREMENT SETTINGS</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">실기 측정 설정</h1>
          <p className="mt-1 text-sm text-slate-500">측정 종목과 배점표를 한곳에서 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </header>

      <div className={`grid gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:inline-grid ${canManagePermissions ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <TabButton active={activeTab === 'types'} icon={<ListChecks className="h-4 w-4" />} label="측정 종목" onClick={() => setActiveTab('types')} />
        <TabButton active={activeTab === 'scores'} icon={<Calculator className="h-4 w-4" />} label="배점표" onClick={() => setActiveTab('scores')} />
        {canManagePermissions && (
          <TabButton active={activeTab === 'permissions'} icon={<ShieldCheck className="h-4 w-4" />} label="권한" onClick={() => setActiveTab('permissions')} />
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'permissions' && canManagePermissions ? (
        <PermissionsPanel
          permissions={academyPermissions}
          saving={savingPermissions}
          onSave={savePermissions}
          onToggle={togglePermission}
        />
      ) : activeTab === 'types' ? (
        <RecordTypesPanel
          editingType={editingType}
          onAdd={() => {
            setEditingType(null);
            setTypeForm(DEFAULT_TYPE_FORM);
            setShowTypeForm(true);
          }}
          onCancel={resetTypeForm}
          onEdit={startEditType}
          onFormChange={setTypeForm}
          onSave={saveType}
          onToggleActive={toggleTypeActive}
          recordTypes={recordTypes}
          showForm={showTypeForm}
          typeForm={typeForm}
        />
      ) : (
        <ScoreTablesPanel
          currentTable={currentTable}
          editingRanges={editingRanges}
          expandedScoreTable={expandedScoreTable}
          loadingRanges={loadingRanges}
          onCancelForm={() => setShowScoreForm(false)}
          onCancelRange={cancelEditRange}
          onCreate={createScoreTable}
          onDelete={deleteScoreTable}
          onEditRange={startEditRange}
          onFormChange={setScoreForm}
          onRangeChange={updateEditingRange}
          onSaveRange={saveRange}
          onShowForm={() => setShowScoreForm(true)}
          onToggleTable={toggleScoreTable}
          savingRange={savingRange}
          scoreForm={scoreForm}
          scoreRanges={scoreRanges}
          scoreTables={scoreTables}
          selectedTypeForScore={selectedTypeForScore}
          setSelectedTypeForScore={setSelectedTypeForScore}
          showForm={showScoreForm}
          typesWithoutScore={typesWithoutScore}
        />
      )}
    </main>
  );
}
