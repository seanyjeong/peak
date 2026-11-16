export interface RankingItem {
  rank: number;
  name: string;
  school?: string;
  grade?: string;
  total: number;
}

export interface EventRecord {
  rank: number;
  name: string;
  school?: string;
  gender: 'M' | 'F';
  value: number;
  score: number;
}

export interface EventData {
  id: number;
  name: string;
  shortName?: string;
  unit: string;
  records: EventRecord[];
}

export interface BoardData {
  academy: { name: string; slug: string; theme?: number };
  test: { name: string; month: string } | null;
  branches?: Array<{ id: number; name: string }>; // P-ACA 지점(지점을 쓰는 학원만)
  ranking: { male: RankingItem[]; female: RankingItem[] };
  events: EventData[];
}

export type ViewMode = 'ranking' | 'event';

// 전광판 테마. 번호는 서버 peak_settings.board_theme 와 같다.
export const BOARD_THEMES = [
  { id: 1, name: '스포츠 중계', description: 'TV 중계 화면처럼 기울어진 띠와 흰 판', swatch: ['#0b1736', '#ffffff', '#d6203f'] },
  { id: 2, name: '경기장 LED', description: '검은 바탕에 LED 글씨, 노랑·주황', swatch: ['#060606', '#ffb020', '#ff5b2e'] },
  { id: 3, name: '밝고 깔끔', description: '흰 카드에 아주 큰 글씨, 밝은 교실용', swatch: ['#f2f4f6', '#3182f6', '#f04452'] },
  { id: 4, name: '시상대', description: '1~3위를 시상대에, 4~10위는 아래 목록', swatch: ['#15173a', '#e8c25a', '#c9d1dc'] },
  { id: 5, name: '육상 트랙', description: '트랙 레인 한 줄에 한 명, 오른쪽 결승선', swatch: ['#b9452f', '#2f7a4c', '#ffffff'] },
] as const;

export const DEFAULT_BOARD_THEME = 1;

export function normalizeBoardTheme(value: unknown): number {
  const theme = Number(value);
  return BOARD_THEMES.some((item) => item.id === theme) ? theme : DEFAULT_BOARD_THEME;
}

// 전광판 한 줄: 종합순위는 총점, 종목별은 기록과 그 점수
export interface BoardRow {
  rank: number;
  name: string;
  school?: string;
  main: number;
  unit: string;
  sub?: string;
}
