'use client';

import { useState, useEffect, use, useCallback } from 'react';
import type { BoardData, EventRecord, ViewMode } from './board-model';
import { Card3D, EventRow3D, GenderColumn, RankRow3D, SportyBackground } from './board-ui';

export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/peak';
      const res = await fetch(`${apiUrl}/public/${slug}`);
      const json = await res.json();

      if (!json.success) {
        setError(json.message || '데이터를 불러올 수 없습니다.');
        return;
      }

      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const handleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const getEventRecordsByGender = (records: EventRecord[], gender: 'M' | 'F') => {
    return records.filter(r => r.gender === gender).slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
  };

  const eventsWithRecords = data?.events.filter(e => e.records.length > 0) || [];
  const currentEvent = eventsWithRecords[currentEventIndex];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a12]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-pink-500 animate-spin" style={{ padding: '3px' }}>
              <div className="w-full h-full rounded-full bg-[#0a0a12]" />
            </div>
          </div>
          <p className="text-xl text-white/40 tracking-widest">LOADING</p>
        </div>
      </div>
    );
  }

  if (error || !data?.test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a12]">
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

  return (
    <div className="h-screen overflow-hidden text-white">
      <SportyBackground />
      <div className="relative z-10 h-full flex flex-col p-4">
        <header className="flex-shrink-0 mb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{data.academy.name}</h1>
              <p className="text-base text-white/40">{data.test.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl rounded-full border border-white/10">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-white/60">LIVE</span>
                <span className="text-sm text-white/30">{lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button onClick={handleFullscreen} className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-sm font-medium transition-all border border-white/10">
                전체화면
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {hasRankings && <ModeButton active={viewMode === 'ranking'} onClick={() => setViewMode('ranking')} label="종합순위" />}
            {eventsWithRecords.length > 0 && (
              <>
                <ModeButton active={viewMode === 'event'} onClick={() => setViewMode('event')} label="종목별" />
                {viewMode === 'event' && (
                  <>
                    <div className="w-px h-6 bg-white/20 mx-1" />
                    {eventsWithRecords.map((event, idx) => (
                      <button
                        key={event.id}
                        onClick={() => setCurrentEventIndex(idx)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${idx === currentEventIndex ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                      >
                        {event.shortName || event.name}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </header>

        <div className="flex-shrink-0 mb-2">
          <Card3D glowColor="rgba(139, 92, 246, 0.3)">
            <div className="py-2 px-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{viewMode === 'ranking' ? '종합순위' : currentEvent?.shortName || currentEvent?.name}</h2>
              {viewMode === 'event' && currentEvent && <span className="text-white/50 text-sm">단위: {currentEvent.unit}</span>}
            </div>
          </Card3D>
        </div>

        <div className="flex-1 overflow-hidden">
          {hasNoData ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🏋️</div>
                <p className="text-xl text-white/40">아직 기록이 없습니다</p>
              </div>
            </div>
          ) : (
            <div key={`view-${viewMode}-${currentEventIndex}`} className="h-full flex gap-6">
              <RankingColumn
                color="blue"
                currentEvent={currentEvent}
                gender="M"
                getEventRecordsByGender={getEventRecordsByGender}
                ranking={data.ranking.male}
                viewMode={viewMode}
              />
              <RankingColumn
                color="pink"
                currentEvent={currentEvent}
                gender="F"
                getEventRecordsByGender={getEventRecordsByGender}
                ranking={data.ranking.female}
                viewMode={viewMode}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
    >
      {label}
    </button>
  );
}

function RankingColumn({
  color,
  currentEvent,
  gender,
  getEventRecordsByGender,
  ranking,
  viewMode,
}: {
  color: 'blue' | 'pink';
  currentEvent: BoardData['events'][number] | undefined;
  gender: 'M' | 'F';
  getEventRecordsByGender: (records: EventRecord[], gender: 'M' | 'F') => EventRecord[];
  ranking: BoardData['ranking']['male'];
  viewMode: ViewMode;
}) {
  const title = gender === 'M' ? '남자' : '여자';

  return (
    <GenderColumn title={title} color={color}>
      {viewMode === 'ranking' ? (
        ranking.length > 0 ? (
          ranking.slice(0, 10).map((item, idx, arr) => (
            <RankRow3D key={`${gender}-${idx}`} item={item} index={idx} total={arr.length} glowColor={gender === 'M' ? '#3b82f6' : '#ec4899'} />
          ))
        ) : <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>
      ) : currentEvent ? (
        <EventRecords
          gender={gender}
          records={getEventRecordsByGender(currentEvent.records, gender)}
          unit={currentEvent.unit}
        />
      ) : null}
    </GenderColumn>
  );
}

function EventRecords({ gender, records, unit }: { gender: 'M' | 'F'; records: EventRecord[]; unit: string }) {
  if (records.length === 0) return <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>;
  return records.map((record, idx) => (
    <EventRow3D
      key={`${gender}-${idx}`}
      record={record}
      index={idx}
      total={records.length}
      unit={unit}
      glowColor={gender === 'M' ? '#3b82f6' : '#ec4899'}
    />
  ));
}
