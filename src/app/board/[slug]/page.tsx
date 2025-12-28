'use client';

import { useState, useEffect, use, useCallback, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

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

// 3D 움직이는 구체
function AnimatedSphere({ position, color, speed = 1, size = 1 }: { position: [number, number, number]; color: string; speed?: number; size?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.5;
      meshRef.current.position.x = position[0] + Math.cos(state.clock.elapsedTime * speed * 0.5) * 0.3;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <Sphere ref={meshRef} args={[size, 64, 64]} position={position}>
      <MeshDistortMaterial
        color={color}
        attach="material"
        distort={0.4}
        speed={2}
        roughness={0.2}
        metalness={0.8}
        emissive={color}
        emissiveIntensity={0.3}
      />
    </Sphere>
  );
}

// 3D 배경 씬
function Background3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[10, -10, 10]} intensity={0.5} color="#ec4899" />

      <Suspense fallback={null}>
        {/* 파란 구체 (남자) */}
        <AnimatedSphere position={[-4, 2, -5]} color="#3b82f6" speed={0.8} size={2} />
        <AnimatedSphere position={[-5, -1, -8]} color="#06b6d4" speed={0.6} size={1.5} />

        {/* 핑크 구체 (여자) */}
        <AnimatedSphere position={[4, 1, -5]} color="#ec4899" speed={0.7} size={2} />
        <AnimatedSphere position={[5, -2, -8]} color="#f43f5e" speed={0.9} size={1.5} />

        {/* 보라 구체 (중앙) */}
        <AnimatedSphere position={[0, 0, -10]} color="#8b5cf6" speed={0.5} size={3} />
      </Suspense>
    </Canvas>
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
        hover:bg-white/20 backdrop-blur-sm
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg
        ${isTop3
          ? `bg-gradient-to-br ${rankColors[item.rank - 1]} text-white shadow-lg`
          : 'bg-white/10 text-white/60'
        }
      `}>
        {item.rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`font-bold truncate ${isTop3 ? 'text-white text-lg' : 'text-white/90'}`}>
          {item.name}
        </div>
        {item.school && (
          <div className="text-xs text-white/50 truncate">{item.school}</div>
        )}
      </div>

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
        flex items-center gap-3 p-3 rounded-xl transition-all backdrop-blur-sm
        ${isTop3 ? 'bg-white/15' : 'bg-white/5'}
      `}
    >
      <div className={`
        w-9 h-9 rounded-lg flex items-center justify-center font-black
        ${isTop3
          ? `bg-gradient-to-br ${rankColors[record.rank - 1]} text-white shadow-lg`
          : 'bg-white/10 text-white/60'
        }
      `}>
        {record.rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`font-bold truncate ${isTop3 ? 'text-white' : 'text-white/90'}`}>
          {record.name}
        </div>
        {record.school && (
          <div className="text-xs text-white/50 truncate">{record.school}</div>
        )}
      </div>

      <div className="text-right">
        <div className={`font-black ${isTop3 ? 'text-xl text-white' : 'text-lg text-white/80'}`}>
          {record.value}<span className="text-xs font-normal text-white/40 ml-0.5">{unit}</span>
        </div>
        <div className="text-xs text-white/50">{record.score}점</div>
      </div>
    </div>
  );
}

// 성별 컬럼
function GenderColumn({
  title,
  color,
  children
}: {
  title: string;
  color: 'blue' | 'pink';
  children: React.ReactNode;
}) {
  const glowColors = {
    blue: '#3b82f6',
    pink: '#ec4899'
  };

  return (
    <div
      className="flex-1 flex flex-col rounded-3xl overflow-hidden relative backdrop-blur-xl"
      style={{
        background: `linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)`,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.1),
          0 25px 60px -20px ${glowColors[color]}50,
          inset 0 1px 0 rgba(255,255,255,0.15)
        `,
      }}
    >
      {/* 상단 글로우 라인 */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: glowColors[color], boxShadow: `0 0 20px ${glowColors[color]}` }}
      />

      {/* 헤더 */}
      <div className="relative flex-shrink-0 px-6 py-5 border-b border-white/10">
        <h3
          className="text-3xl font-black tracking-tight"
          style={{
            color: glowColors[color],
            textShadow: `0 0 40px ${glowColors[color]}`
          }}
        >
          {title}
        </h3>
      </div>

      {/* 컨텐츠 */}
      <div className="relative flex-1 p-4 overflow-hidden">
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

  // 브라우저 탭 타이틀 설정
  useEffect(() => {
    if (data?.academy?.name && data?.test?.name) {
      document.title = `${data.academy.name} - ${data.test.name}`;
    }
  }, [data]);

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
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-spin" style={{ padding: '3px' }}>
              <div className="w-full h-full rounded-full bg-[#050508]" />
            </div>
          </div>
          <p className="text-xl text-white/40 tracking-widest">LOADING</p>
        </div>
      </div>
    );
  }

  if (error || !data?.test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
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
    <div className="h-screen overflow-hidden bg-[#050508] text-white">
      {/* Three.js 3D 배경 */}
      <div className="fixed inset-0 z-0">
        <Background3D />
        {/* 오버레이 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050508]/50 to-[#050508]/80 pointer-events-none" />
      </div>

      <div className="relative z-10 h-full flex flex-col p-6">
        {/* 헤더 */}
        <header className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                {data.academy.name}
              </h1>
              <p className="text-lg text-white/40 mt-1">{data.test.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl rounded-full border border-white/10">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-white/60">LIVE</span>
                <span className="text-sm text-white/30">{lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button
                onClick={handleFullscreen}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-sm font-medium transition-all border border-white/10"
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
                  px-5 py-2.5 rounded-xl text-sm font-bold transition-all backdrop-blur-xl
                  ${viewMode === 'ranking'
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/10'
                  }
                `}
              >
                종합순위
              </button>
            )}
            {eventsWithRecords.length > 0 && (
              <>
                <button
                  onClick={() => setViewMode('event')}
                  className={`
                    px-5 py-2.5 rounded-xl text-sm font-bold transition-all backdrop-blur-xl
                    ${viewMode === 'event'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/10'
                    }
                  `}
                >
                  종목별
                </button>
                {viewMode === 'event' && (
                  <>
                    <div className="w-px h-6 bg-white/20 mx-1" />
                    {eventsWithRecords.map((e, idx) => (
                      <button
                        key={e.id}
                        onClick={() => setCurrentEventIndex(idx)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-all backdrop-blur-xl
                          ${idx === currentEventIndex
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/30'
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
          <div className="py-3 px-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {viewMode === 'ranking' ? '종합순위' : currentEvent?.shortName || currentEvent?.name}
              </h2>
              {viewMode === 'event' && currentEvent && (
                <span className="text-white/50">단위: {currentEvent.unit}</span>
              )}
            </div>
          </div>
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
              <GenderColumn title="남자" color="blue">
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
              <GenderColumn title="여자" color="pink">
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
    </div>
  );
}
