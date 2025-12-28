'use client';

import { useState, useEffect, use, useCallback, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Text3D, Center } from '@react-three/drei';
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

// 3D 덤벨
function Dumbbell({ position, rotation, scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.2;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* 바 */}
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 2, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* 왼쪽 웨이트 */}
      <mesh position={[-0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.25, 32]} />
        <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-1.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 32]} />
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* 오른쪽 웨이트 */}
      <mesh position={[0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.25, 32]} />
        <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[1.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 32]} />
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// 3D 메달
function Medal({ position, color, speed = 1 }: { position: [number, number, number]; color: string; speed?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * speed;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.2) * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <cylinderGeometry args={[0.4, 0.4, 0.08, 32]} />
      <meshStandardMaterial color={color} metalness={1} roughness={0.1} />
    </mesh>
  );
}

// 3D 트로피
function Trophy({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.6) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* 받침대 */}
      <mesh position={[0, -0.8, 0]}>
        <boxGeometry args={[0.6, 0.15, 0.6]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[0.4, 0.25, 0.4]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* 기둥 */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 0.5, 16]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 컵 */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.35, 0.2, 0.6, 32]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 손잡이 */}
      <mesh position={[-0.45, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.15, 0.04, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.45, 0.3, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.15, 0.04, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// 3D 배경 씬
function Background3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, 5, 5]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[5, -5, 5]} intensity={0.5} color="#ec4899" />

      <Suspense fallback={null}>
        {/* 트로피 (중앙 상단) */}
        <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
          <Trophy position={[0, 2.5, -3]} scale={1.2} />
        </Float>

        {/* 덤벨들 */}
        <Dumbbell position={[-4, 0, -4]} rotation={[0.3, 0.5, 0.2]} scale={0.8} />
        <Dumbbell position={[4, -1, -5]} rotation={[-0.2, -0.3, 0.1]} scale={0.6} />

        {/* 메달들 */}
        <Medal position={[-3, 2, -3]} color="#fbbf24" speed={0.8} />
        <Medal position={[3, 1.5, -4]} color="#9ca3af" speed={0.6} />
        <Medal position={[0, -2, -4]} color="#cd7f32" speed={0.7} />
      </Suspense>
    </Canvas>
  );
}

// 3D 카드 등장 애니메이션 컴포넌트
function Card3D({
  children,
  className = '',
  glowColor = '#3b82f6',
  index = 0,
  total = 10,
  isTop3 = false
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  index?: number;
  total?: number;
  isTop3?: boolean;
}) {
  // 10위(index 9)부터 1위(index 0)까지 순서대로 등장
  // 역순 delay: 10위가 먼저, 1위가 마지막
  // TOP3는 더 긴 간격으로 웅장하게
  const baseDelay = (total - 1 - index) * 0.18; // 180ms 간격 (더 느리게)
  const top3ExtraDelay = isTop3 ? 0.3 : 0; // TOP3는 추가 딜레이
  const delay = baseDelay + top3ExtraDelay;

  // TOP3는 더 극적인 애니메이션
  const animationDuration = isTop3 ? '1s' : '0.7s';

  return (
    <div
      className={`relative ${className}`}
      style={{
        animation: `${isTop3 ? 'cardFlipInTop3' : 'cardFlipIn'} ${animationDuration} cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s both`,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 글로우 효과 */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-50 blur-xl transition-opacity"
        style={{ background: glowColor }}
      />

      {/* TOP3 스파크 효과 */}
      {isTop3 && (
        <>
          {/* 스파크 파티클들 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ animation: `sparkBurst 0.8s ease-out ${delay + 0.3}s both` }}
          >
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: glowColor,
                  boxShadow: `0 0 10px 3px ${glowColor}`,
                  left: '50%',
                  top: '50%',
                  animation: `sparkParticle 0.6s ease-out ${delay + 0.3 + i * 0.05}s both`,
                  ['--angle' as any]: `${i * 45}deg`,
                }}
              />
            ))}
          </div>
          {/* 중앙 플래시 */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${glowColor}80 0%, transparent 70%)`,
              animation: `flashBurst 0.5s ease-out ${delay + 0.2}s both`,
            }}
          />
        </>
      )}

      {/* 카드 본체 */}
      <div
        className="relative bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl rounded-xl border border-white/20 overflow-hidden hover:scale-[1.02] transition-transform duration-200"
        style={{
          boxShadow: isTop3
            ? `0 0 30px ${glowColor}60, 0 20px 40px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`
            : `0 20px 40px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`,
        }}
      >
        {/* 상단 하이라이트 */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        {children}
      </div>

      {/* CSS keyframes */}
      <style jsx>{`
        @keyframes cardFlipIn {
          0% {
            opacity: 0;
            transform: perspective(1000px) translateY(-100px) rotateX(90deg) scale(0.7);
          }
          60% {
            opacity: 1;
            transform: perspective(1000px) translateY(8px) rotateX(-8deg) scale(1.02);
          }
          80% {
            transform: perspective(1000px) translateY(-3px) rotateX(3deg) scale(1);
          }
          100% {
            opacity: 1;
            transform: perspective(1000px) translateY(0) rotateX(0) scale(1);
          }
        }

        @keyframes cardFlipInTop3 {
          0% {
            opacity: 0;
            transform: perspective(1000px) translateY(-150px) rotateX(180deg) scale(0.5);
            filter: brightness(3);
          }
          40% {
            opacity: 1;
            transform: perspective(1000px) translateY(20px) rotateX(-15deg) scale(1.1);
            filter: brightness(2);
          }
          60% {
            transform: perspective(1000px) translateY(-10px) rotateX(10deg) scale(1.05);
            filter: brightness(1.5);
          }
          80% {
            transform: perspective(1000px) translateY(5px) rotateX(-3deg) scale(1.02);
            filter: brightness(1.2);
          }
          100% {
            opacity: 1;
            transform: perspective(1000px) translateY(0) rotateX(0) scale(1);
            filter: brightness(1);
          }
        }

        @keyframes sparkParticle {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(80px) scale(0);
          }
        }

        @keyframes flashBurst {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(1.5);
          }
        }
      `}</style>
    </div>
  );
}

// 3D 순위 행
function RankRow3D({ item, index, total, glowColor }: { item: RankingItem; index: number; total: number; glowColor: string }) {
  const isTop3 = item.rank <= 3;
  const rankColors = ['#fbbf24', '#9ca3af', '#cd7f32'];
  const rankBg = isTop3 ? rankColors[item.rank - 1] : 'rgba(255,255,255,0.1)';

  return (
    <Card3D glowColor={isTop3 ? rankColors[item.rank - 1] : glowColor + '20'} className="mb-2" index={index} total={total} isTop3={isTop3}>
      <div className="flex items-center gap-4 p-4">
        {/* 순위 */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg"
          style={{
            background: isTop3
              ? `linear-gradient(135deg, ${rankBg}, ${rankBg}cc)`
              : 'rgba(255,255,255,0.1)',
            color: isTop3 ? '#000' : '#fff',
            boxShadow: isTop3 ? `0 4px 15px ${rankBg}60` : 'none',
          }}
        >
          {item.rank}
        </div>

        {/* 이름 & 학교 */}
        <div className="flex-1 min-w-0">
          <div className={`font-bold truncate ${isTop3 ? 'text-white text-xl' : 'text-white/90 text-lg'}`}>
            {item.name}
          </div>
          {item.school && (
            <div className="text-sm text-white/50 truncate">{item.school}</div>
          )}
        </div>

        {/* 점수 */}
        <div
          className="text-right font-black text-2xl"
          style={{ color: isTop3 ? rankBg : '#fff' }}
        >
          {item.total}
          <span className="text-sm font-normal text-white/40 ml-1">점</span>
        </div>
      </div>
    </Card3D>
  );
}

// 3D 종목별 순위 행
function EventRow3D({ record, index, total, unit, glowColor }: { record: EventRecord; index: number; total: number; unit: string; glowColor: string }) {
  const isTop3 = record.rank <= 3;
  const rankColors = ['#fbbf24', '#9ca3af', '#cd7f32'];
  const rankBg = isTop3 ? rankColors[record.rank - 1] : 'rgba(255,255,255,0.1)';

  return (
    <Card3D glowColor={isTop3 ? rankColors[record.rank - 1] : glowColor + '20'} className="mb-2" index={index} total={total} isTop3={isTop3}>
      <div className="flex items-center gap-3 p-3">
        {/* 순위 */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg"
          style={{
            background: isTop3
              ? `linear-gradient(135deg, ${rankBg}, ${rankBg}cc)`
              : 'rgba(255,255,255,0.1)',
            color: isTop3 ? '#000' : '#fff',
            boxShadow: isTop3 ? `0 4px 15px ${rankBg}60` : 'none',
          }}
        >
          {record.rank}
        </div>

        {/* 이름 & 학교 */}
        <div className="flex-1 min-w-0">
          <div className={`font-bold truncate ${isTop3 ? 'text-white text-lg' : 'text-white/90'}`}>
            {record.name}
          </div>
          {record.school && (
            <div className="text-xs text-white/50 truncate">{record.school}</div>
          )}
        </div>

        {/* 기록 & 점수 */}
        <div className="text-right">
          <div className="font-black text-xl text-white">
            {record.value}
            <span className="text-xs font-normal text-white/40 ml-0.5">{unit}</span>
          </div>
          <div className="text-xs" style={{ color: isTop3 ? rankBg : 'rgba(255,255,255,0.5)' }}>
            {record.score}점
          </div>
        </div>
      </div>
    </Card3D>
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
  const colors = {
    blue: { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)' },
    pink: { main: '#ec4899', glow: 'rgba(236, 72, 153, 0.3)' }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 헤더 */}
      <div
        className="flex-shrink-0 py-4 px-6 rounded-t-2xl border-b border-white/10"
        style={{
          background: `linear-gradient(135deg, ${colors[color].glow}, transparent)`,
        }}
      >
        <h3
          className="text-3xl font-black"
          style={{
            color: colors[color].main,
            textShadow: `0 0 30px ${colors[color].main}`,
          }}
        >
          {title}
        </h3>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 p-3 overflow-y-auto">
        {children}
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
    <div className="h-screen overflow-hidden bg-[#0a0a12] text-white">
      {/* Three.js 3D 배경 */}
      <div className="fixed inset-0 z-0 opacity-60">
        <Background3D />
      </div>
      {/* 그라데이션 오버레이 */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0a12]/60 via-[#0a0a12]/80 to-[#0a0a12] pointer-events-none" />

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
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  viewMode === 'ranking'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                종합순위
              </button>
            )}
            {eventsWithRecords.length > 0 && (
              <>
                <button
                  onClick={() => setViewMode('event')}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    viewMode === 'event'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
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
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          idx === currentEventIndex
                            ? 'bg-white/20 text-white'
                            : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
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
          <Card3D glowColor="rgba(139, 92, 246, 0.3)">
            <div className="py-3 px-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {viewMode === 'ranking' ? '종합순위' : currentEvent?.shortName || currentEvent?.name}
              </h2>
              {viewMode === 'event' && currentEvent && (
                <span className="text-white/50">단위: {currentEvent.unit}</span>
              )}
            </div>
          </Card3D>
        </div>

        {/* 메인 컨텐츠 */}
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
              <GenderColumn title="남자" color="blue">
                {viewMode === 'ranking' ? (
                  data.ranking.male.length > 0 ? (
                    data.ranking.male.slice(0, 10).map((item, idx, arr) => (
                      <RankRow3D key={`m-${idx}`} item={item} index={idx} total={arr.length} glowColor="#3b82f6" />
                    ))
                  ) : <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>
                ) : currentEvent ? (
                  (() => {
                    const maleRecords = getEventRecordsByGender(currentEvent.records, 'M');
                    return maleRecords.length > 0 ? (
                      maleRecords.map((record, idx) => (
                        <EventRow3D key={`m-${idx}`} record={record} index={idx} total={maleRecords.length} unit={currentEvent.unit} glowColor="#3b82f6" />
                      ))
                    ) : <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>;
                  })()
                ) : null}
              </GenderColumn>

              <GenderColumn title="여자" color="pink">
                {viewMode === 'ranking' ? (
                  data.ranking.female.length > 0 ? (
                    data.ranking.female.slice(0, 10).map((item, idx, arr) => (
                      <RankRow3D key={`f-${idx}`} item={item} index={idx} total={arr.length} glowColor="#ec4899" />
                    ))
                  ) : <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>
                ) : currentEvent ? (
                  (() => {
                    const femaleRecords = getEventRecordsByGender(currentEvent.records, 'F');
                    return femaleRecords.length > 0 ? (
                      femaleRecords.map((record, idx) => (
                        <EventRow3D key={`f-${idx}`} record={record} index={idx} total={femaleRecords.length} unit={currentEvent.unit} glowColor="#ec4899" />
                      ))
                    ) : <div className="flex-1 flex items-center justify-center text-white/30">기록 없음</div>;
                  })()
                ) : null}
              </GenderColumn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
