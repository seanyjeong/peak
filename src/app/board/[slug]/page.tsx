'use client';

import { useState, useEffect, use, useCallback } from 'react';

interface RankingItem {
  rank: number;
  name: string;
  school?: string;
  grade?: string;
  total: number;
}

interface EventRecord {
  rank: number;
  name: string;
  school?: string;
  gender: 'M' | 'F';
  value: number;
  score: number;
}

interface EventData {
  id: number;
  name: string;
  shortName?: string;
  unit: string;
  records: EventRecord[];
}

interface BoardData {
  academy: { name: string; slug: string };
  test: { name: string; month: string } | null;
  ranking: { male: RankingItem[]; female: RankingItem[] };
  events: EventData[];
}

type ViewMode = 'ranking' | 'event';

// 3D 카드 컴포넌트
function Card3D({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div
      className={`
        relative backdrop-blur-xl bg-white/10
        border border-white/20 rounded-2xl
        shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        transform-gpu transition-all duration-300
        hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)]
        ${className}
      `}
      style={{
        animationDelay: `${delay}ms`,
        transform: 'perspective(1000px) rotateX(2deg)',
      }}
    >
      {/* 글래스 하이라이트 */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/30 to-transparent rotate-12" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// 순위 행 (종합순위용)
function RankRow({ item, index }: { item: RankingItem; index: number }) {
  const isTop3 = item.rank <= 3;
  const rankColors = ['from-amber-400 to-yellow-500', 'from-slate-300 to-slate-400', 'from-orange-400 to-amber-500'];

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl transition-all duration-500
        ${isTop3 ? 'bg-white/15' : 'bg-white/5'}
        hover:bg-white/20
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* 순위 */}
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg
        ${isTop3
          ? `bg-gradient-to-br ${rankColors[item.rank - 1]} text-white shadow-lg`
          : 'bg-white/10 text-white/60'
        }
      `}>
        {item.rank}
      </div>

      {/* 이름 & 학교 */}
      <div className="flex-1 min-w-0">
        <div className={`font-bold truncate ${isTop3 ? 'text-white text-lg' : 'text-white/90'}`}>
          {item.name}
        </div>
        {item.school && (
          <div className="text-xs text-white/50 truncate">{item.school}</div>
        )}
      </div>

      {/* 점수 */}
      <div className={`
        text-right font-black
        ${isTop3 ? 'text-2xl text-white' : 'text-xl text-white/80'}
      `}>
        {item.total}
        <span className="text-xs font-normal text-white/40 ml-1">점</span>
      </div>
    </div>
  );
}

// 종목별 순위 행
function EventRow({ record, index, unit }: { record: EventRecord; index: number; unit: string }) {
  const isTop3 = record.rank <= 3;
  const rankColors = ['from-amber-400 to-yellow-500', 'from-slate-300 to-slate-400', 'from-orange-400 to-amber-500'];

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl transition-all
        ${isTop3 ? 'bg-white/15' : 'bg-white/5'}
      `}
    >
      {/* 순위 */}
      <div className={`
        w-9 h-9 rounded-lg flex items-center justify-center font-black
        ${isTop3
          ? `bg-gradient-to-br ${rankColors[record.rank - 1]} text-white shadow-lg`
          : 'bg-white/10 text-white/60'
        }
      `}>
        {record.rank}
      </div>

      {/* 이름 & 학교 */}
      <div className="flex-1 min-w-0">
        <div className={`font-bold truncate ${isTop3 ? 'text-white' : 'text-white/90'}`}>
          {record.name}
        </div>
        {record.school && (
          <div className="text-xs text-white/50 truncate">{record.school}</div>
        )}
      </div>

      {/* 기록 & 점수 */}
      <div className="text-right">
        <div className={`font-black ${isTop3 ? 'text-xl text-white' : 'text-lg text-white/80'}`}>
          {record.value}<span className="text-xs font-normal text-white/40 ml-0.5">{unit}</span>
        </div>
        <div className="text-xs text-white/50">{record.score}점</div>
      </div>
    </div>
  );
}

// 성별 컬럼 (남/녀)
function GenderColumn({
  title,
  icon,
  color,
  children
}: {
  title: string;
  icon: string;
  color: 'blue' | 'pink';
  children: React.ReactNode;
}) {
  const gradients = {
    blue: 'from-blue-500/20 to-cyan-500/20',
    pink: 'from-pink-500/20 to-rose-500/20'
  };
  const borderColors = {
    blue: 'border-blue-400/30',
    pink: 'border-pink-400/30'
  };
  const titleColors = {
    blue: 'from-blue-400 to-cyan-400',
    pink: 'from-pink-400 to-rose-400'
  };

  return (
    <div className={`flex-1 flex flex-col bg-gradient-to-b ${gradients[color]} rounded-3xl border ${borderColors[color]} backdrop-blur-xl overflow-hidden`}>
      {/* 헤더 */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <h3 className={`text-2xl font-black bg-gradient-to-r ${titleColors[color]} bg-clip-text text-transparent`}>
            {title}
          </h3>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full flex flex-col gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}

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

  // 자동 롤링 - 기록 있는 것만
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
          if (hasRankings) {
            setViewMode('ranking');
          } else {
            setCurrentEventIndex(0);
          }
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

  // 종목별 남/여 분리
  const getEventRecordsByGender = (records: EventRecord[], gender: 'M' | 'F') => {
    return records
      .filter(r => r.gender === gender)
      .slice(0, 10)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  };

  const eventsWithRecords = data?.events.filter(e => e.records.length > 0) || [];
  const currentEvent = eventsWithRecords[currentEventIndex];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-spin" style={{ padding: '3px' }}>
              <div className="w-full h-full rounded-full bg-[#0a0a0f]" />
            </div>
          </div>
          <p className="text-xl text-white/40 tracking-widest">LOADING</p>
        </div>
      </div>
    );
  }

  if (error || !data?.test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center px-8">
          <div className="text-6xl mb-6">📊</div>
          <h1 className="text-3xl font-bold text-white mb-3">{data?.academy?.name}</h1>
          <p className="text-xl text-white/50">{error || '진행 중인 테스트가 없습니다'}</p>
        </div>
      </div>
    );
  }

  const hasRankings = data.ranking.male.length > 0 || data.ranking.female.length > 0;
  const hasNoData = !hasRankings && eventsWithRecords.length === 0;

  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0f] text-white">
      {/* 3D 그라데이션 메시 배경 */}
      <div className="fixed inset-0 overflow-hidden">
        {/* 메인 그라데이션 오브 */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full opacity-30 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
            animation: 'float1 20s ease-in-out infinite'
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)',
            bottom: '-10%',
            right: '-5%',
            animation: 'float2 25s ease-in-out infinite'
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'float3 30s ease-in-out infinite'
          }}
        />
        {/* 노이즈 오버레이 */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }}
        />
      </div>

      <div className="relative z-10 h-full flex flex-col p-6">
        {/* 헤더 */}
        <header className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                {data.academy.name}
              </h1>
              <p className="text-lg text-white/40 mt-1">{data.test.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur rounded-full border border-white/10">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-white/60">LIVE</span>
                <span className="text-sm text-white/30">{lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button
                onClick={handleFullscreen}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-sm font-medium transition-all border border-white/10"
              >
                전체화면
              </button>
            </div>
          </div>

          {/* 모드 선택 */}
          <div className="flex items-center gap-3 mt-4">
            {hasRankings && (
              <button
                onClick={() => setViewMode('ranking')}
                className={`
                  px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                  ${viewMode === 'ranking'
                    ? 'bg-white/20 text-white border border-white/20'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                  }
                `}
              >
                🏆 종합순위
              </button>
            )}
            {eventsWithRecords.length > 0 && (
              <>
                <button
                  onClick={() => setViewMode('event')}
                  className={`
                    px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                    ${viewMode === 'event'
                      ? 'bg-white/20 text-white border border-white/20'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                    }
                  `}
                >
                  📋 종목별
                </button>
                {viewMode === 'event' && (
                  <>
                    <div className="w-px h-6 bg-white/20 mx-1" />
                    {eventsWithRecords.map((e, idx) => (
                      <button
                        key={e.id}
                        onClick={() => setCurrentEventIndex(idx)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-all
                          ${idx === currentEventIndex
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                            : 'bg-white/5 text-white/50 hover:bg-white/10'
                          }
                        `}
                      >
                        {e.shortName || e.name}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </header>

        {/* 타이틀 바 */}
        <div className="flex-shrink-0 mb-4">
          <Card3D className="py-3 px-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {viewMode === 'ranking' ? '🏆 종합순위' : `📋 ${currentEvent?.shortName || currentEvent?.name}`}
              </h2>
              {viewMode === 'event' && currentEvent && (
                <span className="text-white/50">단위: {currentEvent.unit}</span>
              )}
            </div>
          </Card3D>
        </div>

        {/* 메인 컨텐츠 - 남/여 2컬럼 */}
        <div className="flex-1 overflow-hidden">
          {hasNoData ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🏃</div>
                <p className="text-xl text-white/40">아직 기록이 없습니다</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex gap-4">
              {/* 남자 컬럼 */}
              <GenderColumn title="남자" icon="👨" color="blue">
                {viewMode === 'ranking' ? (
                  data.ranking.male.length > 0 ? (
                    data.ranking.male.slice(0, 10).map((item, idx) => (
                      <RankRow key={`m-${idx}`} item={item} index={idx} />
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>
                  )
                ) : currentEvent ? (
                  getEventRecordsByGender(currentEvent.records, 'M').length > 0 ? (
                    getEventRecordsByGender(currentEvent.records, 'M').map((record, idx) => (
                      <EventRow key={`m-${idx}`} record={record} index={idx} unit={currentEvent.unit} />
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>
                  )
                ) : null}
              </GenderColumn>

              {/* 여자 컬럼 */}
              <GenderColumn title="여자" icon="👩" color="pink">
                {viewMode === 'ranking' ? (
                  data.ranking.female.length > 0 ? (
                    data.ranking.female.slice(0, 10).map((item, idx) => (
                      <RankRow key={`f-${idx}`} item={item} index={idx} />
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>
                  )
                ) : currentEvent ? (
                  getEventRecordsByGender(currentEvent.records, 'F').length > 0 ? (
                    getEventRecordsByGender(currentEvent.records, 'F').map((record, idx) => (
                      <EventRow key={`f-${idx}`} record={record} index={idx} unit={currentEvent.unit} />
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>
                  )
                ) : null}
              </GenderColumn>
            </div>
          )}
        </div>
      </div>

      {/* 애니메이션 키프레임 */}
      <style jsx global>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 20px) scale(1.1); }
          66% { transform: translate(30px, -30px) scale(0.95); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  );
}
