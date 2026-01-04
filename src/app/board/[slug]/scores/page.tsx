'use client';

import { useState, useEffect, use } from 'react';

interface ScoreRange {
  score: number;
  male: { min: number; max: number };
  female: { min: number; max: number };
}

interface ScoreTable {
  id: number;
  recordType: {
    id: number;
    name: string;
    shortName?: string;
    unit: string;
    direction: 'higher' | 'lower';
  };
  maxScore: number;
  minScore: number;
  scoreStep: number;
  decimalPlaces: number;
  malePerfect: number;
  femalePerfect: number;
  ranges: ScoreRange[];
}

interface ScoreData {
  academy: { name: string; slug: string };
  scoreTables: ScoreTable[];
}

export default function ScoresPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/peak';
        const res = await fetch(`${apiUrl}/public/${slug}/scores`);
        const json = await res.json();

        if (!json.success) {
          setError(json.message || '데이터를 불러올 수 없습니다.');
          return;
        }

        setData(json);
        if (json.scoreTables.length > 0) {
          setSelectedTable(json.scoreTables[0].id);
        }
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  useEffect(() => {
    if (data?.academy?.name) {
      document.title = `${data.academy.name} - 배점표`;
    }
  }, [data]);

  const formatValue = (value: number, decimalPlaces: number) => {
    return value.toFixed(decimalPlaces);
  };

  const currentTable = data?.scoreTables.find(t => t.id === selectedTable);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-pink-500 animate-spin" style={{ padding: '3px' }}>
              <div className="w-full h-full rounded-full bg-slate-900" />
            </div>
          </div>
          <p className="text-lg text-white/40 tracking-widest">LOADING</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="text-center px-8">
          <div className="text-5xl mb-4">📊</div>
          <h1 className="text-2xl font-bold text-white mb-2">배점표</h1>
          <p className="text-lg text-white/50">{error || '배점표를 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-4 md:p-8">
      {/* 헤더 */}
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              {data.academy.name}
            </h1>
            <p className="text-white/50">실기 배점표</p>
          </div>
          <a
            href={`/board/${slug}`}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition border border-white/10"
          >
            전광판 보기
          </a>
        </div>
      </header>

      {/* 종목 선택 탭 */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-wrap gap-2">
          {data.scoreTables.map(table => (
            <button
              key={table.id}
              onClick={() => setSelectedTable(table.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                selectedTable === table.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              {table.recordType.shortName || table.recordType.name}
            </button>
          ))}
        </div>
      </div>

      {/* 배점표 */}
      {currentTable && (
        <div className="max-w-6xl mx-auto">
          {/* 종목 정보 */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold">{currentTable.recordType.name}</h2>
                <p className="text-white/50 text-sm">
                  단위: {currentTable.recordType.unit} |
                  {currentTable.recordType.direction === 'higher' ? ' 높을수록 좋음' : ' 낮을수록 좋음'}
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <div className="text-blue-400 font-bold text-lg">
                    {formatValue(currentTable.malePerfect, currentTable.decimalPlaces)}
                    <span className="text-xs ml-0.5">{currentTable.recordType.unit}</span>
                  </div>
                  <div className="text-white/40">남자 만점</div>
                </div>
                <div className="text-center">
                  <div className="text-pink-400 font-bold text-lg">
                    {formatValue(currentTable.femalePerfect, currentTable.decimalPlaces)}
                    <span className="text-xs ml-0.5">{currentTable.recordType.unit}</span>
                  </div>
                  <div className="text-white/40">여자 만점</div>
                </div>
              </div>
            </div>
          </div>

          {/* 점수표 */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-4 py-3 text-center font-bold text-white/80">점수</th>
                    <th className="px-4 py-3 text-center font-bold text-blue-400" colSpan={2}>남자</th>
                    <th className="px-4 py-3 text-center font-bold text-pink-400" colSpan={2}>여자</th>
                  </tr>
                  <tr className="bg-white/5 border-b border-white/10 text-xs text-white/50">
                    <th className="px-4 py-2"></th>
                    <th className="px-3 py-2 text-center">최소</th>
                    <th className="px-3 py-2 text-center">최대</th>
                    <th className="px-3 py-2 text-center">최소</th>
                    <th className="px-3 py-2 text-center">최대</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTable.ranges.map((range, idx) => {
                    const isTop = range.score === currentTable.maxScore;
                    const isHigher = currentTable.recordType.direction === 'higher';

                    // 만점 행: "이상" 또는 "이하"로 표시
                    if (isTop) {
                      return (
                        <tr
                          key={range.score}
                          className="border-b border-white/5 bg-gradient-to-r from-yellow-500/10 to-orange-500/10"
                        >
                          <td className="px-4 py-3 text-center font-bold text-yellow-400">
                            {range.score}
                            <span className="ml-1 text-xs">🏆</span>
                          </td>
                          <td colSpan={2} className="px-3 py-3 text-center text-blue-300 font-medium">
                            {formatValue(isHigher ? range.male.min : range.male.max, currentTable.decimalPlaces)}
                            <span className="text-blue-400/60 ml-1">{isHigher ? '이상' : '이하'}</span>
                          </td>
                          <td colSpan={2} className="px-3 py-3 text-center text-pink-300 font-medium">
                            {formatValue(isHigher ? range.female.min : range.female.max, currentTable.decimalPlaces)}
                            <span className="text-pink-400/60 ml-1">{isHigher ? '이상' : '이하'}</span>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={range.score}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-4 py-3 text-center font-bold text-white">
                          {range.score}
                        </td>
                        <td className="px-3 py-3 text-center text-blue-300">
                          {formatValue(range.male.min, currentTable.decimalPlaces)}
                        </td>
                        <td className="px-3 py-3 text-center text-blue-300">
                          {formatValue(range.male.max, currentTable.decimalPlaces)}
                        </td>
                        <td className="px-3 py-3 text-center text-pink-300">
                          {formatValue(range.female.min, currentTable.decimalPlaces)}
                        </td>
                        <td className="px-3 py-3 text-center text-pink-300">
                          {formatValue(range.female.max, currentTable.decimalPlaces)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 범례 */}
          <div className="mt-4 text-center text-white/40 text-xs">
            {currentTable.recordType.direction === 'higher'
              ? '기록이 높을수록 높은 점수를 받습니다.'
              : '기록이 낮을수록 높은 점수를 받습니다.'}
          </div>
        </div>
      )}
    </div>
  );
}
