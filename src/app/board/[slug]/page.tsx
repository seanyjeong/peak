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

type ViewMode = 'ranking-male' | 'ranking-female' | 'event-male' | 'event-female';

// 스플릿 플랩 글자 컴포넌트
function SplitFlapChar({ char, delay = 0 }: { char: string; delay?: number }) {
  const [currentChar, setCurrentChar] = useState(' ');
  const [isFlipping, setIsFlipping] = useState(false);
  const chars = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  useEffect(() => {
    let iteration = 0;
    const maxIterations = 6 + Math.floor(Math.random() * 4);

    const timer = setTimeout(() => {
      const flipInterval = setInterval(() => {
        setIsFlipping(true);

        setTimeout(() => {
          if (iteration < maxIterations) {
            setCurrentChar(chars[Math.floor(Math.random() * chars.length)]);
            iteration++;
          } else {
            setCurrentChar(char);
            clearInterval(flipInterval);
          }
          setIsFlipping(false);
        }, 40);
      }, 60);

      return () => clearInterval(flipInterval);
    }, delay);

    return () => clearTimeout(timer);
  }, [char, delay]);

  return (
    <span
      className={`
        inline-flex items-center justify-center
        w-[0.85em] h-[1.3em] mx-[1px]
        bg-[#1a1a1a] text-[#f0e6d3] rounded-[2px]
        font-mono font-bold
        shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.3)]
        transition-transform duration-[40ms]
        ${isFlipping ? 'scale-y-0' : 'scale-y-100'}
      `}
      style={{ transformOrigin: 'center center' }}
    >
      {currentChar}
    </span>
  );
}

// 스플릿 플랩 텍스트
function SplitFlapText({ text, className = '', baseDelay = 0 }: { text: string; className?: string; baseDelay?: number }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {text.split('').map((char, i) => (
        <SplitFlapChar key={`${text}-${i}-${char}`} char={char} delay={baseDelay + i * 30} />
      ))}
    </span>
  );
}

// 숫자 플랩 (점수/기록용)
function NumberFlap({ value, unit = '', className = '' }: { value: number | string; unit?: string; className?: string }) {
  const displayValue = String(value);
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="inline-flex">
        {displayValue.split('').map((char, i) => (
          <SplitFlapChar key={`${value}-${i}`} char={char} delay={i * 50} />
        ))}
      </span>
      {unit && <span className="ml-1 text-[0.5em] opacity-60">{unit}</span>}
    </span>
  );
}

// 순위 배지
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ffd700] via-[#ffec80] to-[#daa520] flex items-center justify-center shadow-lg">
        <span className="text-2xl font-black text-[#1a1a1a]">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#c0c0c0] via-[#e8e8e8] to-[#a0a0a0] flex items-center justify-center shadow-lg">
        <span className="text-2xl font-black text-[#1a1a1a]">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#cd7f32] via-[#daa06d] to-[#8b4513] flex items-center justify-center shadow-lg">
        <span className="text-2xl font-black text-white">3</span>
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-full bg-[#2a2a2a] flex items-center justify-center">
      <span className="text-2xl font-bold text-[#f0e6d3]">{rank}</span>
    </div>
  );
}

// 종합순위 행
function OverallRankRow({ item, index, gender }: { item: RankingItem; index: number; gender: 'male' | 'female' }) {
  const accentColor = gender === 'male' ? '#3b82f6' : '#ec4899';
  const baseDelay = index * 100;

  return (
    <div
      className="flex items-center gap-4 py-3 px-4 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-100"
      style={{
        animationDelay: `${index * 50}ms`,
        borderLeft: `4px solid ${accentColor}`
      }}
    >
      <RankBadge rank={item.rank} />

      <div className="flex-1 min-w-0">
        <div className="text-2xl">
          <SplitFlapText text={item.name} baseDelay={baseDelay} />
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          {item.school && <SplitFlapText text={item.school} className="text-base" baseDelay={baseDelay + 100} />}
          {item.grade && <span className="opacity-60">· {item.grade}</span>}
        </div>
      </div>

      <div className="text-right">
        <div className="text-3xl font-black" style={{ color: accentColor }}>
          <NumberFlap value={item.total} />
        </div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">TOTAL</div>
      </div>
    </div>
  );
}

// 종목별 순위 행
function EventRankRow({
  record,
  index,
  unit,
  gender
}: {
  record: EventRecord;
  index: number;
  unit: string;
  gender: 'male' | 'female';
}) {
  const accentColor = gender === 'male' ? '#3b82f6' : '#ec4899';
  const baseDelay = index * 80;

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-100"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <RankBadge rank={record.rank} />

      <div className="flex-1 min-w-0">
        <div className="text-xl">
          <SplitFlapText text={record.name} baseDelay={baseDelay} />
        </div>
        {record.school && (
          <div className="text-sm text-gray-500 mt-0.5">
            <SplitFlapText text={record.school} className="text-sm" baseDelay={baseDelay + 80} />
          </div>
        )}
      </div>

      <div className="text-right flex items-center gap-4">
        <div>
          <div className="text-2xl font-black text-[#1a1a1a]">
            <NumberFlap value={record.value} unit={unit} />
          </div>
          <div className="text-xs text-gray-400">기록</div>
        </div>
        <div className="w-px h-10 bg-gray-200" />
        <div>
          <div className="text-2xl font-black" style={{ color: accentColor }}>
            <NumberFlap value={record.score} />
          </div>
          <div className="text-xs text-gray-400">점수</div>
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
  const [viewMode, setViewMode] = useState<ViewMode>('ranking-male');
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [key, setKey] = useState(0); // 애니메이션 리셋용

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

  // 자동 순환: 종합(남) → 종합(여) → 종목(남) → 종목(여) → 다음종목...
  useEffect(() => {
    if (!data) return;

    const interval = setInterval(() => {
      setViewMode(prev => {
        let next: ViewMode;

        if (prev === 'ranking-male') {
          next = 'ranking-female';
        } else if (prev === 'ranking-female') {
          next = 'event-male';
        } else if (prev === 'event-male') {
          next = 'event-female';
        } else {
          // event-female 다음: 다음 종목으로 이동 후 ranking-male
          setCurrentEventIndex(i => {
            const nextIndex = (i + 1) % (data.events.length || 1);
            return nextIndex;
          });
          next = 'ranking-male';
        }

        setKey(k => k + 1); // 애니메이션 리셋
        return next;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [data]);

  const handleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  // 현재 표시할 데이터
  const currentEvent = data?.events?.[currentEventIndex];
  const currentGender = viewMode.includes('male') ? 'male' : 'female';
  const isEventView = viewMode.startsWith('event');

  // 종목별 남/여 분리
  const getEventRecordsByGender = (records: EventRecord[], gender: 'male' | 'female') => {
    return records
      .filter(r => (gender === 'male' ? r.gender === 'M' : r.gender === 'F'))
      .slice(0, 10)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f1eb]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-[#1a1a1a]/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-[#1a1a1a] rounded-full animate-spin" />
          </div>
          <p className="text-2xl text-[#1a1a1a]/60 font-mono tracking-[0.3em]">LOADING</p>
        </div>
      </div>
    );
  }

  if (error || !data?.test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f1eb]">
        <div className="text-center px-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#1a1a1a]/10 flex items-center justify-center">
            <svg className="w-12 h-12 text-[#1a1a1a]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-3">{data?.academy?.name}</h1>
          <p className="text-xl text-[#1a1a1a]/50">{error || '진행 중인 테스트가 없습니다'}</p>
        </div>
      </div>
    );
  }

  const hasNoData =
    (isEventView && currentEvent && getEventRecordsByGender(currentEvent.records, currentGender).length === 0) ||
    (!isEventView && data.ranking[currentGender].length === 0);

  return (
    <div className="h-screen overflow-hidden bg-[#f5f1eb] text-[#1a1a1a]">
      {/* 배경 패턴 */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      <div className="relative z-10 h-full flex flex-col p-6">
        {/* 헤더 */}
        <header className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">{data.academy.name}</h1>
              <p className="text-lg text-[#1a1a1a]/60 mt-1">{data.test.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-[#1a1a1a]/70">LIVE</span>
                <span className="text-sm text-[#1a1a1a]/40">{lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button
                onClick={handleFullscreen}
                className="px-4 py-2 bg-[#1a1a1a] text-white rounded-full text-sm font-medium hover:bg-[#333] transition-colors"
              >
                전체화면
              </button>
            </div>
          </div>

          {/* 모드 인디케이터 */}
          <div className="flex items-center gap-3 mt-4">
            {['ranking-male', 'ranking-female', 'event-male', 'event-female'].map((mode) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode as ViewMode); setKey(k => k + 1); }}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${viewMode === mode
                    ? mode.includes('male')
                      ? 'bg-blue-500 text-white'
                      : 'bg-pink-500 text-white'
                    : 'bg-white/60 text-[#1a1a1a]/60 hover:bg-white'
                  }
                `}
              >
                {mode === 'ranking-male' && '종합 남자'}
                {mode === 'ranking-female' && '종합 여자'}
                {mode === 'event-male' && '종목 남자'}
                {mode === 'event-female' && '종목 여자'}
              </button>
            ))}

            {isEventView && data.events.length > 1 && (
              <>
                <div className="w-px h-6 bg-[#1a1a1a]/20 mx-2" />
                {data.events.map((e, idx) => (
                  <button
                    key={e.id}
                    onClick={() => { setCurrentEventIndex(idx); setKey(k => k + 1); }}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-all
                      ${idx === currentEventIndex
                        ? 'bg-[#1a1a1a] text-white'
                        : 'bg-white/60 text-[#1a1a1a]/60 hover:bg-white'
                      }
                    `}
                  >
                    {e.shortName || e.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </header>

        {/* 타이틀 바 */}
        <div
          className={`
            flex-shrink-0 py-3 px-6 rounded-t-xl text-white font-bold text-xl
            ${currentGender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}
          `}
        >
          <div className="flex items-center justify-between">
            <span>
              {isEventView
                ? `${currentEvent?.shortName || currentEvent?.name} · ${currentGender === 'male' ? '남자' : '여자'}`
                : `종합순위 · ${currentGender === 'male' ? '남자' : '여자'}`
              }
            </span>
            {isEventView && currentEvent && (
              <span className="text-white/80 font-normal">단위: {currentEvent.unit}</span>
            )}
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div
          key={key}
          className="flex-1 bg-white/40 backdrop-blur rounded-b-xl p-4 overflow-hidden"
        >
          {hasNoData ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a1a]/5 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#1a1a1a]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xl text-[#1a1a1a]/40">아직 기록이 없습니다</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col gap-2">
              {isEventView && currentEvent ? (
                // 종목별 순위
                getEventRecordsByGender(currentEvent.records, currentGender).map((record, idx) => (
                  <EventRankRow
                    key={`${record.name}-${idx}`}
                    record={record}
                    index={idx}
                    unit={currentEvent.unit}
                    gender={currentGender}
                  />
                ))
              ) : (
                // 종합 순위
                data.ranking[currentGender].slice(0, 10).map((item, idx) => (
                  <OverallRankRow
                    key={`${item.name}-${idx}`}
                    item={item}
                    index={idx}
                    gender={currentGender}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 글로벌 스타일 */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');

        * {
          font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>
    </div>
  );
}
