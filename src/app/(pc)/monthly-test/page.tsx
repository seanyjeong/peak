'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, Link2, Monitor, Plus, RefreshCw, Settings2, Trash2, Trophy, Users } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { getMonthlyErrorMessage } from './[testId]/monthly-detail-model';
import { BoardSettingsModal, type SlugCheckState } from './board-settings-modal';

interface MonthlyTest {
  id: number;
  test_month: string;
  test_name: string;
  status: 'draft' | 'active' | 'completed';
  notes: string | null;
  session_count: number;
  participant_count: number;
  created_at: string;
}

interface RecordType {
  id: number;
  name: string;
  short_name: string;
  unit: string;
  direction: 'higher' | 'lower';
  is_active: boolean;
}

const STATUS_STYLE = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
};

const STATUS_LABEL = {
  draft: '준비중',
  active: '진행중',
  completed: '완료',
};

export default function MonthlyTestListPage() {
  const router = useRouter();
  const toast = useToast();
  const [tests, setTests] = useState<MonthlyTest[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSlugModal, setShowSlugModal] = useState(false);
  const [newTestMonth, setNewTestMonth] = useState(currentMonth);
  const [newTestName, setNewTestName] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [currentSlug, setCurrentSlug] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [hasBoardPin, setHasBoardPin] = useState(false);
  const [boardPinInput, setBoardPinInput] = useState('');
  const [clearBoardPin, setClearBoardPin] = useState(false);
  const [slugCheck, setSlugCheck] = useState<SlugCheckState>({ status: 'idle', message: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [testsRes, typesRes, settingsRes] = await Promise.all([
        apiClient.get('/monthly-tests'),
        apiClient.get('/record-types'),
        apiClient.get('/settings'),
      ]);
      setTests(testsRes.data.tests || []);
      setRecordTypes((typesRes.data.recordTypes || []).filter((type: RecordType) => type.is_active));
      const slug = settingsRes.data.settings?.slug || '';
      setCurrentSlug(slug);
      setSlugInput(slug);
      setHasBoardPin(Boolean(settingsRes.data.settings?.has_board_pin));
    } catch {
      toast.error('월말테스트 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createTest = async () => {
    if (!newTestMonth || selectedTypes.length === 0) {
      toast.error('테스트 월과 측정 종목을 선택해주세요.');
      return;
    }

    try {
      setCreating(true);
      await apiClient.post('/monthly-tests', {
        test_month: newTestMonth,
        test_name: newTestName || defaultTestName(newTestMonth),
        record_type_ids: selectedTypes,
      });
      setShowCreateModal(false);
      setNewTestName('');
      setSelectedTypes([]);
      toast.success('월말테스트를 만들었습니다.');
      await fetchData();
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '월말테스트를 만들지 못했습니다.'));
    } finally {
      setCreating(false);
    }
  };

  const deleteTest = async (test: MonthlyTest) => {
    if (!window.confirm(`${test.test_name}을 삭제할까요? 세션과 참가자 정보도 함께 삭제됩니다.`)) return;
    try {
      await apiClient.delete(`/monthly-tests/${test.id}`);
      toast.success('월말테스트를 삭제했습니다.');
      await fetchData();
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '월말테스트를 삭제하지 못했습니다.'));
    }
  };

  const setSanitizedSlugInput = (value: string) => {
    setSlugInput(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setSlugCheck({ status: 'idle', message: '' });
  };

  const checkBoardSlug = async () => {
    const slug = slugInput.trim();
    if (!slug) {
      setSlugCheck({ status: 'invalid', message: '전광판 주소를 입력해주세요.' });
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugCheck({ status: 'invalid', message: '전광판 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.' });
      return;
    }

    try {
      setSlugCheck({ status: 'checking', message: '전광판 주소를 확인하고 있습니다.' });
      const res = await apiClient.get(`/settings/check-slug/${slug}`);
      setSlugCheck({
        status: res.data.available ? 'available' : 'taken',
        message: res.data.message,
      });
    } catch (error) {
      setSlugCheck({
        status: 'error',
        message: getMonthlyErrorMessage(error, '전광판 주소를 확인하지 못했습니다.'),
      });
    }
  };

  const saveBoardSettings = async () => {
    const slug = slugInput.trim();
    if (!slug) {
      toast.error('전광판 주소를 입력해주세요.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error('전광판 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }
    if (slugCheck.status === 'taken') {
      toast.error('이미 다른 학원에서 사용 중인 전광판 주소입니다.');
      return;
    }
    if (!clearBoardPin && boardPinInput && !/^\d{4,12}$/.test(boardPinInput)) {
      toast.error('PIN은 숫자 4~12자리로 입력해주세요.');
      return;
    }

    try {
      setSavingSlug(true);
      if (slug !== currentSlug) {
        await apiClient.put('/monthly-tests/academy/slug', { slug });
      }
      if (clearBoardPin) {
        await apiClient.patch('/settings/board-pin', { clear_board_pin: true });
        setHasBoardPin(false);
      } else if (boardPinInput) {
        await apiClient.patch('/settings/board-pin', { board_pin: boardPinInput });
        setHasBoardPin(true);
      }
      setCurrentSlug(slug);
      setShowSlugModal(false);
      setBoardPinInput('');
      setClearBoardPin(false);
      setSlugCheck({ status: 'idle', message: '' });
      toast.success('전광판 설정을 저장했습니다.');
    } catch (error) {
      toast.error(getMonthlyErrorMessage(error, '전광판 설정을 저장하지 못했습니다.'));
    } finally {
      setSavingSlug(false);
    }
  };

  const copyBoardUrl = async () => {
    if (!currentSlug) {
      toast.error('전광판 주소를 먼저 설정해주세요.');
      setShowSlugModal(true);
      return;
    }
    const url = `${window.location.origin}/board/${currentSlug}`;
    await navigator.clipboard.writeText(url);
    toast.success('전광판 주소를 복사했습니다.');
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-emerald-700">MONTHLY TEST</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-slate-950">월말테스트</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">측정 회차, 세션, 전광판 주소를 관리합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton icon={Settings2} label="전광판 설정" onClick={() => setShowSlugModal(true)} />
          <ActionButton icon={Copy} label="URL 복사" onClick={copyBoardUrl} />
          {currentSlug && <ActionButton icon={Monitor} label="전광판 보기" onClick={() => window.open(`/board/${currentSlug}`, '_blank')} />}
          <button type="button" onClick={() => setShowCreateModal(true)} className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800">
            <Plus className="size-4" />
            새 테스트
          </button>
          <button type="button" onClick={fetchData} disabled={loading} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-3">
        <Metric icon={Trophy} label="테스트" value={`${tests.length}개`} />
        <Metric icon={Users} label="총 참가자" value={`${tests.reduce((sum, test) => sum + test.participant_count, 0)}명`} />
        <Metric icon={Link2} label="전광판" value={currentSlug || '미설정'} />
      </section>

      {loading && <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">불러오는 중입니다.</div>}
      {!loading && tests.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <Trophy className="mx-auto size-10 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600">등록된 월말테스트가 없습니다.</p>
          <button type="button" onClick={() => setShowCreateModal(true)} className="mt-4 h-10 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">첫 테스트 만들기</button>
        </div>
      )}
      {!loading && tests.length > 0 && (
        <div className="grid gap-3">
          {tests.map((test) => (
            <article key={test.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <button type="button" onClick={() => router.push(`/monthly-test/${test.id}`)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-950">{test.test_name}</h2>
                    <span className={`rounded-md px-2 py-1 text-xs font-black ${STATUS_STYLE[test.status]}`}>{STATUS_LABEL[test.status]}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
                    <span>{test.test_month}</span>
                    <span>세션 {test.session_count}개</span>
                    <span>참가자 {test.participant_count}명</span>
                    <span>생성 {new Date(test.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => router.push(`/monthly-test/${test.id}`)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="열기">
                    <ExternalLink className="size-4" />
                  </button>
                  <button type="button" onClick={() => deleteTest(test)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" title="삭제">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <CreateTestModal
        creating={creating}
        month={newTestMonth}
        name={newTestName}
        onClose={() => setShowCreateModal(false)}
        onCreate={createTest}
        onMonthChange={setNewTestMonth}
        onNameChange={setNewTestName}
        onToggleType={(typeId) => setSelectedTypes((current) => current.includes(typeId) ? current.filter((id) => id !== typeId) : [...current, typeId])}
        open={showCreateModal}
        recordTypes={recordTypes}
        selectedTypes={selectedTypes}
      />

      <BoardSettingsModal
        clearBoardPin={clearBoardPin}
        currentSlug={currentSlug}
        hasBoardPin={hasBoardPin}
        onCheckSlug={checkBoardSlug}
        onClearBoardPinChange={setClearBoardPin}
        onClose={() => setShowSlugModal(false)}
        onPinChange={setBoardPinInput}
        onSave={saveBoardSettings}
        open={showSlugModal}
        pinInput={boardPinInput}
        saving={savingSlug}
        slugCheck={slugCheck}
        slugInput={slugInput}
        setSlugInput={setSanitizedSlugInput}
      />
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Settings2; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-5" /></span>
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CreateTestModal({
  creating,
  month,
  name,
  onClose,
  onCreate,
  onMonthChange,
  onNameChange,
  onToggleType,
  open,
  recordTypes,
  selectedTypes,
}: {
  creating: boolean;
  month: string;
  name: string;
  onClose: () => void;
  onCreate: () => void;
  onMonthChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onToggleType: (id: number) => void;
  open: boolean;
  recordTypes: RecordType[];
  selectedTypes: number[];
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title="새 월말테스트">
      <div className="space-y-4">
        <label className="block text-sm font-bold text-slate-700">테스트 월
          <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-slate-900" />
        </label>
        <label className="block text-sm font-bold text-slate-700">테스트 이름
          <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={defaultTestName(month)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-slate-900" />
        </label>
        <div>
          <p className="mb-2 text-sm font-bold text-slate-700">측정 종목</p>
          <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
            {recordTypes.map((type) => (
              <button key={type.id} type="button" onClick={() => onToggleType(type.id)} className={`rounded-lg border p-3 text-left text-sm font-bold ${selectedTypes.includes(type.id) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                {type.name}
                <span className="ml-1 text-slate-400">({type.unit})</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">취소</button>
          <button type="button" onClick={onCreate} disabled={creating || selectedTypes.length === 0} className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">
            {creating ? '생성 중' : '생성'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function defaultTestName(monthValue: string) {
  const [year, month] = monthValue.split('-');
  return `${year}. ${Number(month)}월 실기 테스트`;
}
