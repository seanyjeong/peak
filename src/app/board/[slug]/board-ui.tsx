'use client';

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import './board-themes.css';
import { boardFontClassName } from './board-fonts';
import type { BoardRow } from './board-model';

const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 1080;

// 1920×1080 판을 담는 칸 크기에 맞춰 줄이거나 늘린다. 남는 곳은 테마 바탕색으로 채운다.
export function ScaledBoard({ theme, className = '', children }: { theme: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0, x: 0, y: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      const scale = Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT);
      setFit({ scale, x: (width - BOARD_WIDTH * scale) / 2, y: (height - BOARD_HEIGHT * scale) / 2 });
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`pb-fit pb-t${theme} ${boardFontClassName} ${className}`}>
      <div
        className={`pb-board pb-t${theme}`}
        style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`, visibility: fit.scale ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </div>
  );
}

export interface BoardChip {
  key: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}

export interface BoardScreenProps {
  theme: number;
  academyName: string;
  testName: string;
  chips: BoardChip[];
  clock: string;
  columnLabel: string;
  male: BoardRow[];
  female: BoardRow[];
  noData?: boolean;
  viewKey?: string;
  className?: string;
}

export function BoardScreen({ theme, academyName, testName, chips, clock, columnLabel, male, female, noData = false, viewKey, className }: BoardScreenProps) {
  const podium = theme === 4;
  return (
    <ScaledBoard theme={theme} className={className}>
      <header className="pb-hd">
        <div className="pb-hd-l">
          <div className="pb-acad">{academyName}</div>
          {testName ? <div className="pb-test">{testName}</div> : null}
        </div>
        <div className="pb-chips">
          {chips.map((chip) => chip.onClick ? (
            <button key={chip.key} type="button" className={`pb-chip${chip.active ? ' on' : ''}`} onClick={chip.onClick}>{chip.label}</button>
          ) : (
            <span key={chip.key} className={`pb-chip${chip.active ? ' on' : ''}`}>{chip.label}</span>
          ))}
        </div>
        <div className="pb-hd-r">
          <span className="pb-live">실시간</span>
          <span className="pb-clock">{clock}</span>
        </div>
      </header>
      <div key={viewKey} className="pb-cols">
        {noData ? (
          <div className="pb-nodata">아직 기록이 없습니다</div>
        ) : (
          <>
            <BoardColumn gender="m" label={columnLabel} rows={male} podium={podium} />
            <BoardColumn gender="f" label={columnLabel} rows={female} podium={podium} />
          </>
        )}
      </div>
    </ScaledBoard>
  );
}

function BoardColumn({ gender, label, rows, podium }: { gender: 'm' | 'f'; label: string; rows: BoardRow[]; podium: boolean }) {
  const head = <div className="pb-ch">{gender === 'm' ? '남자' : '여자'}<small>{label}</small></div>;
  if (rows.length === 0) {
    return <section className={`pb-col pb-${gender}`}>{head}<div className="pb-empty">기록 없음</div></section>;
  }
  const top10 = rows.slice(0, 10);
  const listRows = podium ? top10.slice(3) : top10;
  return (
    <section className={`pb-col pb-${gender}`}>
      {head}
      {podium ? <Podium rows={top10.slice(0, 3)} /> : null}
      <ol className="pb-list" style={{ gridTemplateRows: `repeat(${podium ? 7 : 10}, minmax(0, 1fr))` }}>
        {listRows.map((row, index) => (
          <li key={`${gender}-${index}`} className={`pb-row pb-r${row.rank}${row.rank <= 3 ? ' pb-top' : ''}`}>
            <span className="pb-rk">{row.rank}</span>
            <span className="pb-nm"><b>{row.name}</b>{row.school ? <small>{row.school}</small> : null}</span>
            <span className="pb-sc"><b>{row.main}</b><i>{row.unit}</i>{row.sub ? <em>{row.sub}</em> : null}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// 시상대: 가운데 1등, 왼쪽 2등, 오른쪽 3등 자리
function Podium({ rows }: { rows: BoardRow[] }) {
  return (
    <div className="pb-pod">
      {[1, 0, 2].map((place) => {
        const row = rows[place];
        if (!row) return <div key={place} />;
        return (
          <div key={place} className={`pb-pd pb-p${place + 1}`}>
            <div className="pb-pd-who"><b>{row.name}</b>{row.school ? <small>{row.school}</small> : null}</div>
            <div className="pb-pd-blk">
              <span className="pb-pd-rk">{row.rank}</span>
              <span className="pb-pd-sc">{row.main}<i>{row.unit}</i>{row.sub ? <em>{row.sub}</em> : null}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 테마 고르기 미리보기: 예시 자료로 그린 작은 전광판
const SAMPLE_MALE: BoardRow[] = [
  ['김도윤', '가람고', 562], ['이준서', '한빛고', 548], ['박시우', '누리고', 541], ['최하준', '새솔고', 529], ['정우진', '바름고', 517],
  ['강민재', '다온고', 506], ['윤지호', '솔빛고', 498], ['장현우', '하람고', 487], ['임건우', '미르고', 476], ['한서진', '온새고', 463],
].map(([name, school, total], index) => ({ rank: index + 1, name: String(name), school: String(school), main: Number(total), unit: '점' }));

const SAMPLE_FEMALE: BoardRow[] = [
  ['김서연', '한빛고', 518], ['이하은', '가람고', 505], ['박지민', '다온고', 497], ['최수아', '누리고', 486], ['정예린', '새솔고', 474],
  ['강다은', '바름고', 465], ['윤채원', '미르고', 452], ['장유나', '솔빛고', 441], ['임소율', '하람고', 430], ['한지아', '온새고', 418],
].map(([name, school, total], index) => ({ rank: index + 1, name: String(name), school: String(school), main: Number(total), unit: '점' }));

const SAMPLE_CHIPS: BoardChip[] = ['종합순위', '제멀', '메디신볼', '10m왕복', '좌전굴', '배근력']
  .map((label, index) => ({ key: label, label, active: index === 0 }));

export function BoardThemePreview({ theme, academyName, className }: { theme: number; academyName: string; className?: string }) {
  return (
    <BoardScreen
      theme={theme}
      academyName={academyName || '우리 학원'}
      testName="월말테스트 (예시)"
      chips={SAMPLE_CHIPS}
      clock="14:30"
      columnLabel="종합 TOP 10"
      male={SAMPLE_MALE}
      female={SAMPLE_FEMALE}
      className={className}
    />
  );
}
