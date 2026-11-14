'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Download, Edit3, FileBarChart, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import apiClient from '@/lib/api/client';
import {
  AllRecordType,
  formatSessionDate,
  getMonthlyErrorMessage,
  MonthlyTest,
  STATUS_LABELS,
  TestStatus,
  TimeSlot,
  TIME_SLOT_LABELS,
} from './monthly-detail-model';
import { PageHeader, StatTile, chipClass, toolbarButtonClass } from '@/components/ui/page';

export default function MonthlyTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [addingSession, setAddingSession] = useState(false);
  const [allRecordTypes, setAllRecordTypes] = useState<AllRecordType[]>([]);
  const [editConflicts, setEditConflicts] = useState<Set<string>>(new Set());
  const [editName, setEditName] = useState('');
  const [editSelectedTypes, setEditSelectedTypes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionSlot, setNewSessionSlot] = useState<TimeSlot>('morning');
  const [saving, setSaving] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [test, setTest] = useState<MonthlyTest | null>(null);

  useEffect(() => {
    fetchTest();
    fetchRecordTypes();
  }, [testId]);

  const selectedTypes = useMemo(
    () => editSelectedTypes.map((id) => allRecordTypes.find((type) => type.id === id)).filter((type): type is AllRecordType => Boolean(type)),
    [allRecordTypes, editSelectedTypes],
  );

  async function fetchRecordTypes() {
    try {
      const res = await apiClient.get('/record-types');
      setAllRecordTypes((res.data.recordTypes || []).filter((type: AllRecordType) => type.is_active));
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '측정 종목을 불러오지 못했습니다.'));
    }
  }

  async function fetchTest() {
    try {
      setLoading(true);
      const res = await apiClient.get(`/monthly-tests/${testId}`);
      setTest(res.data.test);
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '월말테스트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchConflicts() {
    try {
      const res = await apiClient.get(`/monthly-tests/${testId}/conflicts`);
      const next = new Set<string>();
      (res.data.conflicts || []).forEach((conflict: { record_type_id_1: number; record_type_id_2: number }) => {
        next.add(makeConflictKey(conflict.record_type_id_1, conflict.record_type_id_2));
      });
      setEditConflicts(next);
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '충돌 종목 설정을 불러오지 못했습니다.'));
    }
  }

  async function handleAddSession() {
    if (!newSessionDate) return toast.error('날짜를 선택해주세요.');
    try {
      setAddingSession(true);
      await apiClient.post(`/monthly-tests/${testId}/sessions`, {
        test_date: newSessionDate,
        time_slot: newSessionSlot,
      });
      toast.success('세션을 추가했습니다.');
      setNewSessionDate('');
      setShowSessionForm(false);
      await fetchTest();
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '세션을 추가하지 못했습니다.'));
    } finally {
      setAddingSession(false);
    }
  }

  async function handleDeleteSession(sessionId: number) {
    if (!window.confirm('이 세션을 삭제할까요?')) return;
    try {
      await apiClient.delete(`/test-sessions/${sessionId}`);
      toast.success('세션을 삭제했습니다.');
      await fetchTest();
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '세션을 삭제하지 못했습니다.'));
    }
  }

  async function handleStatusChange(status: TestStatus) {
    if (!test || test.status === status) return;
    try {
      await apiClient.put(`/monthly-tests/${testId}`, {
        test_name: test.test_name,
        status,
        notes: test.notes,
      });
      toast.success('상태를 변경했습니다.');
      await fetchTest();
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '상태를 변경하지 못했습니다.'));
    }
  }

  async function openSettingsPanel() {
    if (!test) return;
    setEditName(test.test_name);
    setEditSelectedTypes(test.record_types.map((type) => type.record_type_id));
    await fetchConflicts();
    setShowSettingsPanel((prev) => !prev);
  }

  async function handleSaveEdit() {
    if (!test) return;
    if (!editName.trim()) return toast.error('테스트 이름을 입력해주세요.');
    if (editSelectedTypes.length === 0) return toast.error('최소 1개 이상의 종목을 선택해주세요.');

    try {
      setSaving(true);
      await apiClient.put(`/monthly-tests/${testId}`, {
        test_name: editName.trim(),
        status: test.status,
        notes: test.notes,
        record_type_ids: editSelectedTypes,
      });
      await apiClient.put(`/monthly-tests/${testId}/conflicts`, {
        conflicts: Array.from(editConflicts)
          .map((key) => key.split('-').map(Number))
          .filter(([id1, id2]) => editSelectedTypes.includes(id1) && editSelectedTypes.includes(id2))
          .map(([record_type_id_1, record_type_id_2]) => ({ record_type_id_1, record_type_id_2 })),
      });
      toast.success('테스트 설정을 저장했습니다.');
      setShowSettingsPanel(false);
      await fetchTest();
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '테스트 설정을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    if (!test) return;
    try {
      const response = await apiClient.get(`/monthly-tests/${testId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${test.test_month}_${test.test_name || '월말테스트'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '엑셀 파일을 저장하지 못했습니다.'));
    }
  }

  const toggleEditType = (typeId: number) => {
    setEditSelectedTypes((prev) => (
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    ));
  };

  const toggleConflict = (id1: number, id2: number) => {
    const key = makeConflictKey(id1, id2);
    setEditConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!test) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="rounded-2xl bg-card p-6 text-center">
          <p className="text-sm font-semibold text-secondary-foreground">월말테스트를 찾지 못했습니다.</p>
          <button type="button" onClick={() => router.push('/monthly-test')} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            목록으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => router.push('/monthly-test')} className={`${toolbarButtonClass()} mt-2.5 w-10 px-0`} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader
          className="min-w-0 flex-1"
          title={test.test_name}
          description={test.test_month}
          actions={(
            <>
              <button type="button" onClick={() => router.push(`/monthly-test/${testId}/rankings`)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-card px-3.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-card/70 hover:text-foreground disabled:opacity-50">
                <FileBarChart className="h-4 w-4" />
                전체 순위
              </button>
              <button type="button" onClick={handleExportExcel} className={toolbarButtonClass()}>
                <Download className="h-4 w-4" />
                엑셀 저장
              </button>
              {test.status === 'draft' && (
                <button type="button" onClick={openSettingsPanel} className={toolbarButtonClass()}>
                  <Edit3 className="h-4 w-4" />
                  테스트 설정
                </button>
              )}
              <button type="button" onClick={() => setShowSessionForm((prev) => !prev)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                세션 추가
              </button>
            </>
          )}
        />
      </div>

      <section className="grid grid-cols-3 gap-3">
        <StatTile label="세션" value={`${test.sessions.length}개`} />
        <StatTile label="참가자" value={`${test.sessions.reduce((sum, session) => sum + session.participant_count, 0)}명`} />
        <StatTile label="편성 조" value={`${test.sessions.reduce((sum, session) => sum + session.group_count, 0)}개`} />
      </section>

      <section className="rounded-2xl bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold text-muted-foreground">상태</span>
          {(['draft', 'active', 'completed'] as TestStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              aria-pressed={test.status === status}
              className={chipClass(test.status === status, 'card')}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {test.record_types.map((type) => (
            <span key={type.record_type_id} className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
              {type.name} · {type.unit}
            </span>
          ))}
        </div>
      </section>

      {showSessionForm && (
        <section className="grid gap-3 rounded-2xl bg-card p-4 md:grid-cols-[1fr_200px_auto]">
          <input
            type="date"
            value={newSessionDate}
            onChange={(event) => setNewSessionDate(event.target.value)}
            className="h-11 rounded-xl border border-transparent bg-muted px-3 text-sm outline-none focus:border-primary"
          />
          <select
            value={newSessionSlot}
            onChange={(event) => setNewSessionSlot(event.target.value as TimeSlot)}
            className="h-11 rounded-xl border border-transparent bg-muted px-3 text-sm outline-none focus:border-primary"
          >
            {Object.entries(TIME_SLOT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" onClick={handleAddSession} disabled={addingSession} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <CalendarPlus className="h-4 w-4" />
            {addingSession ? '추가 중' : '추가'}
          </button>
        </section>
      )}

      {showSettingsPanel && (
        <section className="space-y-4 rounded-2xl bg-card p-5">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <label className="text-sm font-bold text-secondary-foreground">
              테스트 이름
              <input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-transparent px-3 text-sm outline-none focus:border-primary bg-muted" />
            </label>
            <div>
              <p className="text-sm font-bold text-secondary-foreground">측정 종목</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {allRecordTypes.map((type) => {
                  const selected = editSelectedTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => toggleEditType(type.id)}
                      aria-pressed={selected}
                      className={chipClass(selected, 'card')}
                    >
                      {type.short_name || type.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedTypes.length >= 2 && (
            <div>
              <p className="text-sm font-bold text-secondary-foreground">충돌 종목</p>
              <p className="mt-1 text-xs text-muted-foreground">같은 장소나 장비를 쓰는 종목을 표시하면 조 편성 스케줄에서 겹치지 않게 처리합니다.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {selectedTypes.flatMap((left, leftIndex) => (
                  selectedTypes.slice(leftIndex + 1).map((right) => {
                    const key = makeConflictKey(left.id, right.id);
                    const active = editConflicts.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleConflict(left.id, right.id)}
                        aria-pressed={active}
                        className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-destructive-soft text-destructive' : 'bg-muted text-secondary-foreground hover:bg-border'}`}
                      >
                        {left.short_name || left.name} / {right.short_name || right.name}
                      </button>
                    );
                  })
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowSettingsPanel(false)} className="h-10 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70">
              취소
            </button>
            <button type="button" onClick={handleSaveEdit} disabled={saving} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? '저장 중' : '저장'}
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="px-1 text-[17px] font-bold tracking-tight text-foreground">세션 목록</h2>
        {test.sessions.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center text-sm font-semibold text-muted-foreground">
            등록된 세션이 없습니다.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {test.sessions.map((session) => (
              <article key={session.id} className="rounded-2xl bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{formatSessionDate(session.test_date)}</h3>
                    <span className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-secondary-foreground">{TIME_SLOT_LABELS[session.time_slot]}</span>
                  </div>
                  <button type="button" onClick={() => handleDeleteSession(session.id)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive-soft hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <span className="rounded-xl bg-muted px-3 py-2 font-semibold text-secondary-foreground"><Users className="mr-1 inline h-4 w-4" /> {session.participant_count}명</span>
                  <span className="rounded-xl bg-muted px-3 py-2 font-semibold text-secondary-foreground">조 {session.group_count}개</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => router.push(`/monthly-test/${testId}/${session.id}`)} className="h-10 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70">
                    조 편성
                  </button>
                  <button type="button" onClick={() => router.push(`/monthly-test/${testId}/${session.id}/records`)} className="h-10 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    기록 측정
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function makeConflictKey(id1: number, id2: number): string {
  const [smaller, larger] = id1 < id2 ? [id1, id2] : [id2, id1];
  return `${smaller}-${larger}`;
}
