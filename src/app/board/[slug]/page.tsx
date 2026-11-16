'use client';

import { FormEvent, useState, useEffect, use, useCallback } from 'react';
import {
  fetchBoardJson,
  isPinRequiredResponse,
  storeBoardToken,
  submitBoardPin,
} from './board-access';
import { normalizeBoardTheme, type BoardData, type BoardRow, type EventRecord, type ViewMode } from './board-model';
import { BoardPinGate } from './board-pin-gate';
import { BoardScreen, type BoardChip } from './board-ui';

type BoardResponse = BoardData & { success?: boolean; message?: string };

export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  // 지점별 전광판: 주소의 ?branch=<번호> 로도 고정할 수 있다. null = 학원 전체
  const [branchId, setBranchId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    return Number(new URLSearchParams(window.location.search).get('branch')) || null;
  });
  // 테마 미리보기: 주소의 ?theme=<1~5> 가 있으면 저장된 테마 대신 그 테마로 보여 준다
  const [previewTheme] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const value = new URLSearchParams(window.location.search).get('theme');
    return value ? normalizeBoardTheme(value) : null;
  });
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinAcademyName, setPinAcademyName] = useState('');

  const fetchData = useCallback(async (token?: string) => {
    try {
      const json = await fetchBoardJson<BoardResponse>(`/public/${slug}${branchId ? `?branch=${branchId}` : ''}`, slug, token);

      if (isPinRequiredResponse(json)) {
        setPinRequired(true);
        setPinAcademyName(json.academy?.name || '');
        setError(null);
        return;
      }

      if (json.success === false) {
        setError(json.message || '데이터를 불러올 수 없습니다.');
        return;
      }

      setData(json);
      setLastUpdated(new Date());
      setError(null);
      setPinRequired(false);
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [branchId, slug]);

  const handleBranchChange = (nextBranchId: number | null) => {
    setBranchId(nextBranchId);
    const search = new URLSearchParams(window.location.search);
    if (nextBranchId) search.set('branch', String(nextBranchId));
    else search.delete('branch');
    const query = search.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (!pinRequired) void fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData, pinRequired]);

  useEffect(() => {
    if (data?.academy?.name && data?.test?.name) {
      document.title = `${data.academy.name} - ${data.test.name}`;
    }
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const hasRankings = data.ranking.male.length > 0 || data.ranking.female.length > 0;
    const eventsWithRecords = data.events.filter(e => e.records.length > 0);
    if (!hasRankings && eventsWithRecords.length === 0) return;

    const interval = setInterval(() => {
      if (viewMode === 'ranking') {
        if (eventsWithRecords.length > 0) {
          setViewMode('event');
          setCurrentEventIndex(0);
        }
      } else {
        const nextIndex = currentEventIndex + 1;
        if (nextIndex >= eventsWithRecords.length) {
          if (hasRankings) setViewMode('ranking');
          else setCurrentEventIndex(0);
        } else {
          setCurrentEventIndex(nextIndex);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [data, viewMode, currentEventIndex]);

  // 지점·전체화면 버튼은 마우스를 움직일 때만 3초 동안 보인다(TV 화면에는 순위만)
  useEffect(() => {
    let timer = window.setTimeout(() => setControlsVisible(false), 3000);
    const show = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsVisible(false), 3000);
    };
    window.addEventListener('mousemove', show);
    window.addEventListener('touchstart', show);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', show);
      window.removeEventListener('touchstart', show);
    };
  }, []);

  const handleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const handlePinSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pinInput.length < 4) {
      setPinError('PIN은 숫자 4자리 이상으로 입력해주세요.');
      return;
    }

    try {
      setPinSubmitting(true);
      const result = await submitBoardPin(slug, pinInput);
      if (!result.boardToken) {
        setPinError('PIN 확인에 실패했습니다. 다시 입력해주세요.');
        return;
      }
      storeBoardToken(slug, result.boardToken);
      setPinError(null);
      setPinRequired(false);
      setPinInput('');
      await fetchData(result.boardToken);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'PIN을 확인하지 못했습니다.');
    } finally {
      setPinSubmitting(false);
    }
  };

  const getEventRecordsByGender = (records: EventRecord[], gender: 'M' | 'F') => {
    return records.filter(r => r.gender === gender).slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
  };

  const eventsWithRecords = data?.events.filter(e => e.records.length > 0) || [];
  const currentEvent = eventsWithRecords[currentEventIndex];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101114]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-pink-500 animate-spin" style={{ padding: '3px' }}>
              <div className="w-full h-full rounded-full bg-[#101114]" />
            </div>
          </div>
          <p className="text-xl text-white/40 tracking-widest">LOADING</p>
        </div>
      </div>
    );
  }

  if (pinRequired) {
    return (
      <BoardPinGate
        academyName={pinAcademyName}
        error={pinError}
        onPinChange={setPinInput}
        onSubmit={handlePinSubmit}
        pin={pinInput}
        submitting={pinSubmitting}
      />
    );
  }

  if (error || !data?.test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101114]">
        <div className="text-center px-8">
          <div className="text-6xl mb-6">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-3">{data?.academy?.name}</h1>
          <p className="text-xl text-white/50">{error || '진행 중인 테스트가 없습니다'}</p>
        </div>
      </div>
    );
  }

  const hasRankings = data.ranking.male.length > 0 || data.ranking.female.length > 0;
  const hasNoData = !hasRankings && eventsWithRecords.length === 0;
  const theme = previewTheme ?? normalizeBoardTheme(data.academy.theme);
  const showEvent = viewMode === 'event' && Boolean(currentEvent);

  const toRankingRows = (items: BoardData['ranking']['male']): BoardRow[] => items.slice(0, 10).map((item) => ({
    rank: item.rank, name: item.name, school: item.school, main: item.total, unit: '점',
  }));
  const toEventRows = (gender: 'M' | 'F'): BoardRow[] => (currentEvent ? getEventRecordsByGender(currentEvent.records, gender) : []).map((record) => ({
    rank: record.rank, name: record.name, school: record.school, main: record.value, unit: currentEvent?.unit || '', sub: `${record.score}점`,
  }));

  const chips: BoardChip[] = [
    ...(hasRankings ? [{ key: 'ranking', label: '종합순위', active: viewMode === 'ranking', onClick: () => setViewMode('ranking') }] : []),
    ...eventsWithRecords.map((event, index) => ({
      key: `event-${event.id}`,
      label: event.shortName || event.name,
      active: viewMode === 'event' && index === currentEventIndex,
      onClick: () => { setViewMode('event'); setCurrentEventIndex(index); },
    })),
  ];

  return (
    <div className="relative h-screen overflow-hidden" style={{ cursor: controlsVisible ? 'auto' : 'none' }}>
      <BoardScreen
        theme={theme}
        academyName={data.academy.name}
        testName={data.test.name}
        chips={chips}
        clock={lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
        columnLabel={showEvent ? `${currentEvent?.name} TOP 10 · ${currentEvent?.unit}` : '종합 TOP 10'}
        male={showEvent ? toEventRows('M') : toRankingRows(data.ranking.male)}
        female={showEvent ? toEventRows('F') : toRankingRows(data.ranking.female)}
        noData={hasNoData}
        viewKey={`view-${viewMode}-${currentEventIndex}`}
        className="h-full w-full"
      />
      <div
        className={`fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl bg-black/70 p-2 text-white shadow-lg backdrop-blur transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        {data.branches && data.branches.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="지점">
            {[{ id: null, name: '전체' }, ...data.branches].map((branch) => (
              <button
                key={branch.id ?? 'all'}
                type="button"
                onClick={() => handleBranchChange(branch.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${branchId === branch.id ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'}`}
              >
                {branch.name}
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-white/20" />
          </div>
        ) : null}
        <button type="button" onClick={handleFullscreen} className="rounded-xl px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10">
          전체화면
        </button>
      </div>
    </div>
  );
}
