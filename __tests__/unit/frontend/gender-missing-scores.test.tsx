import { Suspense } from 'react';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import apiClient from '@/lib/api/client';
import { useRecords } from '@/features/records/hooks/useRecords';
import { StudentRecordCard } from '@/components/records/StudentRecordCard';
import { GenderBadge } from '@/components/ui/Badge';
import { getRecordPercentage } from '@/app/(pc)/students/[id]/student-profile-model';
import RankingsPage from '@/app/(pc)/monthly-test/[testId]/rankings/page';

// 성별이 비어 있는 학생은 점수를 내지 않고 "성별 입력 필요"로 보인다 (운영 QA Q03).
// 남/여 학생의 점수는 고치기 전과 같아야 한다.
jest.mock('@/lib/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/lib/api/auth', () => ({
  authAPI: { getCurrentUser: () => ({ id: 1, name: '원장', role: 'owner', academyId: 2 }) },
}));

const mockedGet = apiClient.get as jest.Mock;

// 230 → 남 90, 여 100 / 파울(0) → 기본점수 40
const RANGES = [
  { score: 100, male_min: 250, male_max: 999, female_min: 220, female_max: 999 },
  { score: 90, male_min: 220, male_max: 249.99, female_min: 190, female_max: 219.99 },
  { score: 80, male_min: 0, male_max: 219.99, female_min: 0, female_max: 189.99 },
];

describe('기록 측정 배점 (useRecords.calculateScore)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockImplementation((url: string) => {
      if (url === '/record-types') {
        return Promise.resolve({ data: { recordTypes: [{ id: 1, name: '제자리멀리뛰기', unit: 'cm', direction: 'higher', is_active: true, min_value: null, max_value: null }] } });
      }
      if (url.startsWith('/assignments')) return Promise.resolve({ data: { slots: {}, branches: [] } });
      if (url === '/score-tables/by-type/1') {
        return Promise.resolve({ data: { scoreTable: { id: 10, decimal_places: 0, min_score: 40 }, ranges: RANGES } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('남/여는 고치기 전과 같은 점수, 성별이 없으면 파울까지 점수 없음', async () => {
    const { result } = renderHook(() => useRecords());
    await waitFor(() => expect(result.current.scoreTablesCache[1]).toBeDefined());

    expect(result.current.calculateScore(230, 'M', 1)).toBe(90);
    expect(result.current.calculateScore(230, 'F', 1)).toBe(100);
    expect(result.current.calculateScore(200, 'M', 1)).toBe(80);
    expect(result.current.calculateScore(200, 'F', 1)).toBe(90);
    expect(result.current.calculateScore(0, 'M', 1)).toBe(40);
    expect(result.current.calculateScore(0, 'F', 1)).toBe(40);

    expect(result.current.calculateScore(230, null, 1)).toBeNull();
    expect(result.current.calculateScore(0, null, 1)).toBeNull();
  });
});

describe('기록 측정 학생 카드 성별 표시', () => {
  function renderCard(gender: 'M' | 'F' | null) {
    return render(
      <StudentRecordCard
        student={{ id: 1, student_id: 1, student_name: '학생', gender }}
        recordTypes={[]}
        inputs={{}}
        isExpanded={false}
        isSaved={false}
        onToggle={() => {}}
        onInputChange={() => {}}
        onInputBlur={() => {}}
        getDecimalPlaces={() => 0}
      />,
    );
  }

  it('남/여는 그대로, 성별이 없으면 여로 보이지 않고 성별 입력이 필요하다고 보인다', () => {
    renderCard('M');
    expect(screen.getByText('남')).toHaveClass('bg-primary-soft');
    renderCard('F');
    expect(screen.getByText('여')).toHaveClass('bg-pink-500/15');
    renderCard(null);
    expect(screen.getByText('성별?')).toHaveClass('bg-muted');
  });

  it('성별 배지도 같은 규칙', () => {
    render(<GenderBadge gender={null} />);
    expect(screen.getByText('성별?')).toHaveClass('bg-muted');
  });
});

describe('학생 상세 기록 비교 (getRecordPercentage)', () => {
  const recordTypes = [{ id: 1, name: '제자리멀리뛰기', short_name: '제멀', unit: 'cm', direction: 'higher' as const }];
  const scoreTables = { 1: { id: 10, record_type_id: 1, male_perfect: 300, female_perfect: 260, max_score: 100 } };
  const student = (gender: 'M' | 'F' | null) => ({ id: 1, name: '학생', gender, school: '', grade: '', status: 'active' });

  it('남/여는 고치기 전과 같은 비율, 성별이 없으면 비교하지 않는다', () => {
    expect(getRecordPercentage({ recordTypes, scoreTables, student: student('M'), typeId: 1, value: 270 })).toBe(90);
    expect(getRecordPercentage({ recordTypes, scoreTables, student: student('F'), typeId: 1, value: 234 })).toBe(90);
    expect(getRecordPercentage({ recordTypes, scoreTables, student: student(null), typeId: 1, value: 270 })).toBe(0);
  });
});

describe('월말 전체 순위 화면', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        test: { id: 7, test_name: '11월 월말', test_month: '2026-11', status: 'active' },
        record_types: [{ id: 1, record_type_id: 1, name: '제자리멀리뛰기', short_name: '제멀', unit: 'cm', direction: 'higher' }],
        branches: [],
        participants: [
          { student_id: 103, name: '성별없음', gender: null, participant_type: 'enrolled', records: { 1: 300 }, scores: { 1: null }, total_score: null, scored_count: 0 },
          { student_id: 101, name: '남학생', gender: 'M', participant_type: 'enrolled', records: { 1: 230 }, scores: { 1: 90 }, total_score: 90, scored_count: 1 },
          { student_id: 102, name: '여학생', gender: 'F', participant_type: 'enrolled', records: { 1: 230 }, scores: { 1: 100 }, total_score: 100, scored_count: 1 },
          { student_id: 104, name: '기록없는남', gender: 'M', participant_type: 'enrolled', records: {}, scores: { 1: null }, total_score: 0, scored_count: 0 },
        ],
      },
    });
  });

  it('남/여는 총점 순서 그대로, 성별 없는 학생은 총점 미산정으로 맨 아래·순위 없음', async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <RankingsPage params={Promise.resolve({ testId: '7' })} />
        </Suspense>,
      );
    });

    const names = await screen.findAllByText(/^(남학생|여학생|성별없음|기록없는남)$/);
    expect(names.map(node => node.textContent)).toEqual(['여학생', '남학생', '기록없는남', '성별없음']);

    const missingRow = names[3].parentElement as HTMLElement;
    expect(within(missingRow).getByText('성별?')).toBeInTheDocument();
    expect(within(missingRow).getByText('성별 입력 필요')).toBeInTheDocument();
    expect(missingRow.firstElementChild?.textContent).toBe('-');
    // 기록이 없는 남학생은 고치기 전처럼 0점으로 3위(아이콘)를 받는다
    const zeroRow = names[2].parentElement as HTMLElement;
    expect(within(zeroRow).getByText('0')).toBeInTheDocument();
    expect(zeroRow.firstElementChild?.querySelector('svg')).not.toBeNull();
  });
});
