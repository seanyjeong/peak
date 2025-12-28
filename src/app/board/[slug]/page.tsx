'use client';

import { useState, useEffect, use, useRef } from 'react';

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
  short_name?: string;
  unit: string;
  direction: 'higher' | 'lower';
  records: EventRecord[];
}

interface BoardData {
  academy: {
    name: string;
    slug: string;
  };
  test: {
    id: number;
    month: string;
    name: string;
    status: string;
  } | null;
  ranking: {
    male: RankingItem[];
    female: RankingItem[];
  };
  events: EventData[];
}

// 플립 애니메이션 텍스트 컴포넌트 (공항 보드 스타일)
function FlipText({ text, className = '' }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState(text);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (text !== displayText) {
      setIsFlipping(true);
      setTimeout(() => {
        setDisplayText(text);
        setIsFlipping(false);
      }, 300);
    }
  }, [text, displayText]);

  return (
    <span className={`inline-block transition-all duration-300 ${isFlipping ? 'flip-out' : 'flip-in'} ${className}`}>
      {displayText}
    </span>
  );
}

// 3D 카드 (TOP 3용 - 큰 카드)
function TopThreeCard({ item, rank, gender }: { item: RankingItem; rank: number; gender: 'male' | 'female' }) {
  const colors = {
    1: 'from-yellow-400 via-yellow-300 to-amber-500',
    2: 'from-slate-300 via-gray-200 to-slate-400',
    3: 'from-orange-400 via-amber-300 to-orange-500'
  };

  const glowColors = {
    1: 'shadow-yellow-500/50',
    2: 'shadow-slate-400/50',
    3: 'shadow-orange-500/50'
  };

  const medals = {
    1: '🥇',
    2: '🥈',
    3: '🥉'
  };

  const bgColor = gender === 'male' ? 'bg-blue-900/30' : 'bg-pink-900/30';
  const borderColor = gender === 'male' ? 'border-blue-500/50' : 'border-pink-500/50';

  return (
    <div
      className={`relative perspective-1000 transform hover:scale-105 transition-all duration-500`}
      style={{ animationDelay: `${rank * 0.2}s` }}
    >
      <div className={`
        card-3d ${bgColor} backdrop-blur-sm rounded-2xl border-2 ${borderColor}
        p-6 min-w-[200px] shadow-2xl ${glowColors[rank as keyof typeof glowColors]}
      `}>
        {/* 메달 & 순위 */}
        <div className="absolute -top-4 -left-4 text-5xl animate-bounce-slow">
          {medals[rank as keyof typeof medals]}
        </div>

        {/* 순위 배지 */}
        <div className={`
          absolute -top-3 -right-3 w-12 h-12 rounded-full
          bg-gradient-to-br ${colors[rank as keyof typeof colors]}
          flex items-center justify-center text-2xl font-black text-white
          shadow-lg ${glowColors[rank as keyof typeof glowColors]}
        `}>
          {rank}
        </div>

        {/* 컨텐츠 */}
        <div className="text-center pt-4">
          <div className={`text-3xl font-bold mb-2 ${rank === 1 ? 'text-yellow-400' : 'text-white'}`}>
            <FlipText text={item.name} />
          </div>
          {item.school && (
            <div className="text-sm text-slate-400 mb-3">{item.school}</div>
          )}
          <div className={`
            text-4xl font-black
            bg-gradient-to-r ${colors[rank as keyof typeof colors]} bg-clip-text text-transparent
          `}>
            <FlipText text={String(item.total)} />
            <span className="text-lg text-slate-400 ml-1">점</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 순위 행 (4위 이하용) - 공항 보드 스타일
function RankingRow({ item, isNew = false }: { item: RankingItem; isNew?: boolean }) {
  return (
    <div className={`
      flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50
      ${isNew ? 'animate-slide-in' : ''}
    `}>
      {/* 순위 */}
      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl font-bold">
        {item.rank}
      </div>

      {/* 이름 (플립 효과) */}
      <div className="flex-1">
        <div className="flip-board-container">
          {item.name.split('').map((char, i) => (
            <span
              key={i}
              className="inline-block bg-slate-900 px-1 mx-0.5 rounded text-xl font-mono"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <FlipText text={char} />
            </span>
          ))}
        </div>
        {item.school && (
          <div className="text-xs text-slate-500 mt-1">{item.school}</div>
        )}
      </div>

      {/* 점수 */}
      <div className="text-right">
        <div className="flip-board-container">
          {String(item.total).split('').map((char, i) => (
            <span
              key={i}
              className="inline-block bg-gradient-to-b from-yellow-500 to-amber-600 text-black px-2 mx-0.5 rounded text-2xl font-mono font-bold"
            >
              <FlipText text={char} />
            </span>
          ))}
        </div>
        <div className="text-xs text-slate-500">점</div>
      </div>
    </div>
  );
}

// 종목별 순위 (공항 보드 스타일)
function EventBoard({ event, isActive }: { event: EventData; isActive: boolean }) {
  return (
    <div className={`
      transition-all duration-500 transform
      ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute'}
    `}>
      {/* 종목명 */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-500/50" />
        <h2 className="text-3xl font-bold text-emerald-400 px-4">
          {event.short_name || event.name}
          <span className="text-lg text-slate-500 ml-2">({event.unit})</span>
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-500/50" />
      </div>

      {/* TOP 3 */}
      <div className="flex justify-center gap-8 mb-6">
        {event.records.slice(0, 3).map((record, idx) => (
          <div
            key={record.rank}
            className={`
              transform transition-all duration-500 hover:scale-110
              ${idx === 0 ? 'scale-110 z-10' : 'scale-100'}
            `}
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700/50 min-w-[150px]">
              <div className="text-center">
                <span className="text-4xl">{['🥇', '🥈', '🥉'][idx]}</span>
                <div className={`text-2xl font-bold mt-2 ${idx === 0 ? 'text-yellow-400' : 'text-white'}`}>
                  {record.name}
                </div>
                <span className={`
                  inline-block px-2 py-0.5 rounded-full text-xs mt-1
                  ${record.gender === 'M' ? 'bg-blue-500/30 text-blue-300' : 'bg-pink-500/30 text-pink-300'}
                `}>
                  {record.gender === 'M' ? '남' : '여'}
                </span>
                <div className="mt-2">
                  <span className={`text-3xl font-black ${idx === 0 ? 'text-yellow-400' : 'text-white'}`}>
                    {record.value}
                  </span>
                  <span className="text-slate-400 ml-1">{event.unit}</span>
                </div>
                <div className="text-sm text-emerald-400 mt-1">{record.score}점</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4위 이하 */}
      <div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto">
        {event.records.slice(3, 10).map((record) => (
          <div
            key={record.rank}
            className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg border border-slate-700/30"
          >
            <span className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center font-bold">
              {record.rank}
            </span>
            <span className="flex-1 font-medium truncate">{record.name}</span>
            <span className={`
              px-1.5 py-0.5 rounded text-xs
              ${record.gender === 'M' ? 'bg-blue-500/30 text-blue-300' : 'bg-pink-500/30 text-pink-300'}
            `}>
              {record.gender === 'M' ? '남' : '여'}
            </span>
            <span className="font-bold text-emerald-400">{record.value}</span>
          </div>
        ))}
      </div>
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
  const [activeTab, setActiveTab] = useState<'male' | 'female' | 'event'>('male');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [slug]);

  // 탭 자동 전환 (15초)
  useEffect(() => {
    const tabs: Array<'male' | 'female' | 'event'> = ['male', 'female', 'event'];
    const interval = setInterval(() => {
      setActiveTab(prev => {
        const currentIdx = tabs.indexOf(prev);
        return tabs[(currentIdx + 1) % tabs.length];
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // 종목 자동 전환 (10초)
  useEffect(() => {
    if (!data?.events?.length || activeTab !== 'event') return;
    const interval = setInterval(() => {
      setCurrentEventIndex(prev => (prev + 1) % data.events.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [data?.events?.length, activeTab]);

  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/peak';
      const res = await fetch(`${apiUrl}/public/board/${slug}`);
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
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-ping"></div>
            <div className="absolute inset-2 border-4 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-2xl text-slate-400 font-mono">LOADING...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="text-6xl mb-6">📊</div>
          <h1 className="text-3xl font-bold text-slate-400 mb-4">{data?.academy?.name}</h1>
          <p className="text-xl text-slate-500">{error || '진행 중인 테스트가 없습니다.'}</p>
        </div>
      </div>
    );
  }

  const currentEvent = data.events[currentEventIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* 배경 효과 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 p-6 h-screen flex flex-col">
        {/* 헤더 */}
        <header className="text-center mb-6">
          <h1 className="text-5xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {data.academy.name}
          </h1>
          <h2 className="text-3xl font-bold text-white/80 mt-2">
            {data.test.name}
          </h2>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              LIVE
            </span>
            <span>업데이트: {lastUpdated.toLocaleTimeString()}</span>
            <button
              onClick={handleFullscreen}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              전체화면
            </button>
          </div>
        </header>

        {/* 탭 */}
        <div className="flex justify-center gap-4 mb-6">
          {[
            { key: 'male', label: '종합순위 (남)', color: 'blue' },
            { key: 'female', label: '종합순위 (여)', color: 'pink' },
            { key: 'event', label: '종목별 순위', color: 'emerald' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`
                px-6 py-3 rounded-xl font-bold text-lg transition-all duration-300
                ${activeTab === tab.key
                  ? `bg-${tab.color}-500/20 border-2 border-${tab.color}-500 text-${tab.color}-400 scale-105`
                  : 'bg-slate-800/50 border-2 border-slate-700/50 text-slate-400 hover:border-slate-600'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 overflow-hidden">
          {/* 종합순위 - 남자 */}
          {activeTab === 'male' && (
            <div className="h-full flex flex-col animate-fade-in">
              <h2 className="text-3xl font-bold text-blue-400 text-center mb-6">🏆 종합순위 (남자)</h2>

              {/* TOP 3 */}
              <div className="flex justify-center items-end gap-8 mb-8">
                {[1, 0, 2].map(idx => {
                  const item = data.ranking.male[idx];
                  if (!item) return null;
                  return (
                    <TopThreeCard
                      key={item.rank}
                      item={item}
                      rank={item.rank}
                      gender="male"
                    />
                  );
                })}
              </div>

              {/* 4위 이하 */}
              <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
                {data.ranking.male.slice(3, 10).map(item => (
                  <RankingRow key={item.rank} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* 종합순위 - 여자 */}
          {activeTab === 'female' && (
            <div className="h-full flex flex-col animate-fade-in">
              <h2 className="text-3xl font-bold text-pink-400 text-center mb-6">🏆 종합순위 (여자)</h2>

              {/* TOP 3 */}
              <div className="flex justify-center items-end gap-8 mb-8">
                {[1, 0, 2].map(idx => {
                  const item = data.ranking.female[idx];
                  if (!item) return null;
                  return (
                    <TopThreeCard
                      key={item.rank}
                      item={item}
                      rank={item.rank}
                      gender="female"
                    />
                  );
                })}
              </div>

              {/* 4위 이하 */}
              <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
                {data.ranking.female.slice(3, 10).map(item => (
                  <RankingRow key={item.rank} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* 종목별 순위 */}
          {activeTab === 'event' && (
            <div className="h-full animate-fade-in relative">
              {/* 종목 인디케이터 */}
              <div className="flex justify-center gap-2 mb-4">
                {data.events.map((e, idx) => (
                  <button
                    key={e.id}
                    onClick={() => setCurrentEventIndex(idx)}
                    className={`
                      px-3 py-1 rounded-full text-sm transition-all
                      ${idx === currentEventIndex
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }
                    `}
                  >
                    {e.short_name || e.name}
                  </button>
                ))}
              </div>

              {data.events.map((event, idx) => (
                <EventBoard
                  key={event.id}
                  event={event}
                  isActive={idx === currentEventIndex}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 스타일 */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out;
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .flip-out {
          transform: rotateX(-90deg);
          opacity: 0;
        }
        .flip-in {
          transform: rotateX(0deg);
          opacity: 1;
        }

        .card-3d {
          transform-style: preserve-3d;
          transform: perspective(1000px) rotateX(5deg);
          transition: transform 0.3s ease;
        }
        .card-3d:hover {
          transform: perspective(1000px) rotateX(0deg) translateY(-5px);
        }

        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
}
