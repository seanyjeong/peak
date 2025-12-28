'use client';

import { useState, useEffect, use } from 'react';

interface RankingItem {
  rank: number;
  name: string;
  school?: string;
  total: number;
}

interface EventRecord {
  rank: number;
  name: string;
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

// 공항 플립보드 스타일 글자 (한 글자씩 플립)
function FlipChar({ char, delay = 0 }: { char: string; delay?: number }) {
  const [displayChar, setDisplayChar] = useState(' ');
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789가나다라마바사아자차카타파하';
    let iterations = 0;
    const maxIterations = 8 + Math.floor(Math.random() * 5);

    const flipInterval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        if (iterations < maxIterations) {
          setDisplayChar(chars[Math.floor(Math.random() * chars.length)]);
          iterations++;
        } else {
          setDisplayChar(char);
          clearInterval(flipInterval);
        }
        setIsFlipping(false);
      }, 50);
    }, 80);

    return () => clearInterval(flipInterval);
  }, [char]);

  return (
    <span className={`
      inline-block w-[1.2em] h-[1.8em] mx-[1px] rounded-sm
      bg-gradient-to-b from-slate-800 via-slate-900 to-slate-800
      border border-slate-600 text-center leading-[1.8em]
      shadow-inner transition-transform duration-75
      ${isFlipping ? 'scale-y-0' : 'scale-y-100'}
    `}>
      {displayChar}
    </span>
  );
}

// 플립보드 텍스트 (여러 글자)
function FlipText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex ${className}`}>
      {text.split('').map((char, i) => (
        <FlipChar key={`${text}-${i}`} char={char} delay={i * 50} />
      ))}
    </span>
  );
}

// 순위 행 (공항 보드 스타일)
function RankingRow({ item, index, gender }: { item: RankingItem; index: number; gender: 'male' | 'female' }) {
  const medalColors = ['text-yellow-400', 'text-slate-300', 'text-orange-400'];
  const medals = ['🥇', '🥈', '🥉'];
  const borderColor = gender === 'male' ? 'border-blue-500/30' : 'border-pink-500/30';
  const bgColor = gender === 'male' ? 'bg-blue-900/20' : 'bg-pink-900/20';

  return (
    <div
      className={`
        flex items-center gap-6 p-4 rounded-lg ${bgColor} border ${borderColor}
        backdrop-blur-sm transform transition-all duration-500
      `}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* 순위 */}
      <div className={`
        w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black
        ${item.rank <= 3
          ? `bg-gradient-to-br ${item.rank === 1 ? 'from-yellow-400 to-amber-600' : item.rank === 2 ? 'from-slate-300 to-slate-500' : 'from-orange-400 to-orange-600'} text-black`
          : 'bg-slate-700 text-white'
        }
      `}>
        {item.rank <= 3 ? medals[item.rank - 1] : item.rank}
      </div>

      {/* 이름 (플립보드 스타일) */}
      <div className="flex-1">
        <div className="text-3xl font-mono font-bold tracking-wider">
          <FlipText text={item.name} />
        </div>
        {item.school && (
          <div className="text-lg text-slate-400 mt-1">{item.school}</div>
        )}
      </div>

      {/* 점수 (플립보드 스타일) */}
      <div className="text-right">
        <div className="text-4xl font-mono font-black text-yellow-400 tracking-wider">
          <FlipText text={String(item.total)} />
        </div>
        <div className="text-lg text-slate-500">점</div>
      </div>
    </div>
  );
}

// 종목별 순위 (공항 보드 스타일)
function EventBoard({ event }: { event: EventData }) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="h-full flex flex-col">
      {/* 종목명 */}
      <div className="text-center mb-8">
        <h2 className="text-5xl font-black text-emerald-400">
          {event.shortName || event.name}
        </h2>
        <div className="text-2xl text-slate-400 mt-2">단위: {event.unit}</div>
      </div>

      {event.records.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-3xl text-slate-500">아직 기록이 없습니다</div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-4">
          {event.records.slice(0, 10).map((record, idx) => (
            <div
              key={record.rank}
              className={`
                flex items-center gap-4 p-4 rounded-xl
                bg-slate-800/60 border border-slate-700/50
                ${idx < 3 ? 'col-span-2' : ''}
              `}
            >
              {/* 순위 */}
              <div className={`
                w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black
                ${idx < 3
                  ? `bg-gradient-to-br ${idx === 0 ? 'from-yellow-400 to-amber-600' : idx === 1 ? 'from-slate-300 to-slate-500' : 'from-orange-400 to-orange-600'} text-black`
                  : 'bg-slate-700 text-white'
                }
              `}>
                {idx < 3 ? medals[idx] : record.rank}
              </div>

              {/* 이름 */}
              <div className="flex-1">
                <div className={`text-2xl font-bold ${idx === 0 ? 'text-yellow-400' : 'text-white'}`}>
                  {record.name}
                </div>
                <span className={`
                  inline-block px-2 py-0.5 rounded text-sm mt-1
                  ${record.gender === 'M' ? 'bg-blue-500/30 text-blue-300' : 'bg-pink-500/30 text-pink-300'}
                `}>
                  {record.gender === 'M' ? '남' : '여'}
                </span>
              </div>

              {/* 기록 */}
              <div className="text-right">
                <div className={`text-3xl font-black ${idx === 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {record.value}
                  <span className="text-lg text-slate-400 ml-1">{event.unit}</span>
                </div>
                <div className="text-sm text-slate-500">{record.score}점</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'ranking' | 'event'>('ranking');
  const [showMale, setShowMale] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [slug]);

  // 탭 자동 전환 (20초)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab(prev => prev === 'ranking' ? 'event' : 'ranking');
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // 종합순위 남/여 자동 전환 (10초)
  useEffect(() => {
    if (activeTab !== 'ranking') return;
    const interval = setInterval(() => {
      setShowMale(prev => !prev);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // 종목 자동 전환 (8초)
  useEffect(() => {
    if (!data?.events?.length || activeTab !== 'event') return;
    const interval = setInterval(() => {
      setCurrentEventIndex(prev => (prev + 1) % data.events.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [data?.events?.length, activeTab]);

  const fetchData = async () => {
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
    } catch (err) {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-8">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-ping"></div>
            <div className="absolute inset-4 border-4 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-4xl text-slate-400 font-mono tracking-widest">LOADING...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="text-9xl mb-8">📊</div>
          <h1 className="text-5xl font-bold text-slate-400 mb-6">{data?.academy?.name}</h1>
          <p className="text-3xl text-slate-500">{error || '진행 중인 테스트가 없습니다.'}</p>
        </div>
      </div>
    );
  }

  const currentEvent = data.events[currentEventIndex];
  const hasNoRankings = data.ranking.male.length === 0 && data.ranking.female.length === 0;
  const hasNoEvents = data.events.every(e => e.records.length === 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* 배경 효과 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="relative z-10 h-screen flex flex-col p-8">
        {/* 헤더 */}
        <header className="text-center mb-8 flex-shrink-0">
          <h1 className="text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {data.academy.name}
          </h1>
          <h2 className="text-4xl font-bold text-white/80 mt-3">
            {data.test.name}
          </h2>
          <div className="flex items-center justify-center gap-8 mt-4 text-xl text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              LIVE
            </span>
            <span>업데이트: {lastUpdated.toLocaleTimeString()}</span>
            <button
              onClick={handleFullscreen}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-lg"
            >
              전체화면
            </button>
          </div>
        </header>

        {/* 탭 버튼 */}
        <div className="flex justify-center gap-6 mb-8 flex-shrink-0">
          <button
            onClick={() => setActiveTab('ranking')}
            className={`
              px-10 py-4 rounded-2xl font-bold text-2xl transition-all duration-300
              ${activeTab === 'ranking'
                ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400 scale-105'
                : 'bg-slate-800/50 border-2 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }
            `}
          >
            🏆 종합순위
          </button>
          <button
            onClick={() => setActiveTab('event')}
            className={`
              px-10 py-4 rounded-2xl font-bold text-2xl transition-all duration-300
              ${activeTab === 'event'
                ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 scale-105'
                : 'bg-slate-800/50 border-2 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }
            `}
          >
            📋 종목별 순위
          </button>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 overflow-hidden">
          {/* 종합순위 */}
          {activeTab === 'ranking' && (
            <div className="h-full">
              {hasNoRankings ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-9xl mb-8">🏃</div>
                    <div className="text-4xl text-slate-400">아직 기록이 없습니다</div>
                    <div className="text-2xl text-slate-500 mt-4">테스트가 시작되면 순위가 표시됩니다</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 남/여 토글 */}
                  <div className="flex justify-center gap-4 mb-6">
                    <button
                      onClick={() => setShowMale(true)}
                      className={`
                        px-8 py-3 rounded-xl font-bold text-xl transition-all
                        ${showMale ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}
                      `}
                    >
                      👨 남자 ({data.ranking.male.length}명)
                    </button>
                    <button
                      onClick={() => setShowMale(false)}
                      className={`
                        px-8 py-3 rounded-xl font-bold text-xl transition-all
                        ${!showMale ? 'bg-pink-500 text-white' : 'bg-slate-700 text-slate-400'}
                      `}
                    >
                      👩 여자 ({data.ranking.female.length}명)
                    </button>
                  </div>

                  {/* 순위 목록 */}
                  <div className="grid grid-cols-2 gap-4 max-h-[calc(100%-60px)] overflow-auto px-4">
                    {(showMale ? data.ranking.male : data.ranking.female).map((item, idx) => (
                      <RankingRow
                        key={item.rank}
                        item={item}
                        index={idx}
                        gender={showMale ? 'male' : 'female'}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 종목별 순위 */}
          {activeTab === 'event' && (
            <div className="h-full">
              {data.events.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-4xl text-slate-400">등록된 종목이 없습니다</div>
                </div>
              ) : (
                <>
                  {/* 종목 인디케이터 */}
                  <div className="flex justify-center gap-3 mb-6">
                    {data.events.map((e, idx) => (
                      <button
                        key={e.id}
                        onClick={() => setCurrentEventIndex(idx)}
                        className={`
                          px-6 py-2 rounded-full text-xl font-bold transition-all
                          ${idx === currentEventIndex
                            ? 'bg-emerald-500 text-white scale-110'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }
                        `}
                      >
                        {e.shortName || e.name}
                      </button>
                    ))}
                  </div>

                  {/* 현재 종목 */}
                  {currentEvent && <EventBoard event={currentEvent} />}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 글로벌 스타일 */}
      <style jsx global>{`
        @keyframes flip-in {
          0% { transform: rotateX(-90deg); opacity: 0; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }

        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
    </div>
  );
}
