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
  academy: { name: string; slug: string };
  test: { name: string; month: string } | null;
  ranking: { male: RankingItem[]; female: RankingItem[] };
  events: EventData[];
}

export type ViewMode = 'ranking' | 'event';
