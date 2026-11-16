import { fireEvent, render, screen } from '@testing-library/react';
import { BoardScreen } from '@/app/board/[slug]/board-ui';
import type { BoardRow } from '@/app/board/[slug]/board-model';

const rows = (prefix: string, count: number): BoardRow[] => Array.from({ length: count }, (_, index) => ({
  rank: index + 1,
  name: `${prefix}${index + 1}`,
  school: '가람고',
  main: 500 - index * 10,
  unit: '점',
}));

function renderBoard(theme: number, overrides: Partial<React.ComponentProps<typeof BoardScreen>> = {}) {
  return render(
    <BoardScreen
      theme={theme}
      academyName="시험학원"
      testName="11월 월말테스트"
      chips={[{ key: 'ranking', label: '종합순위', active: true }]}
      clock="14:30"
      columnLabel="종합 TOP 10"
      male={rows('남', 12)}
      female={rows('여', 2)}
      {...overrides}
    />,
  );
}

describe('BoardScreen', () => {
  it.each([1, 2, 3, 5])('테마 %i 은 남녀 각각 10명까지 한 줄씩 그린다', (theme) => {
    const { container } = renderBoard(theme);

    expect(container.querySelector(`.pb-board.pb-t${theme}`)).not.toBeNull();
    expect(container.querySelectorAll('.pb-m .pb-row')).toHaveLength(10);
    expect(container.querySelectorAll('.pb-f .pb-row')).toHaveLength(2);
    expect(screen.queryByText('남11')).toBeNull();
    expect(container.querySelector('.pb-pod')).toBeNull();
  });

  it('시상대 테마는 1~3등을 시상대(2-1-3 자리)에, 4~10등을 아래 목록에 그린다', () => {
    const { container } = renderBoard(4);

    const podium = Array.from(container.querySelectorAll('.pb-m .pb-pd-who b')).map((node) => node.textContent);
    expect(podium).toEqual(['남2', '남1', '남3']);
    expect(Array.from(container.querySelectorAll('.pb-m .pb-row .pb-nm b')).map((node) => node.textContent))
      .toEqual(['남4', '남5', '남6', '남7', '남8', '남9', '남10']);
    // 2명뿐인 여자 쪽은 3등 자리를 비워 둔다
    expect(Array.from(container.querySelectorAll('.pb-f .pb-pd-who b')).map((node) => node.textContent)).toEqual(['여2', '여1']);
  });

  it('종목별은 기록·단위와 그 점수를 같이 보이고, 머리줄 칸을 누르면 화면을 바꾼다', () => {
    const onClick = jest.fn();
    renderBoard(1, {
      chips: [{ key: 'ranking', label: '종합순위', active: false, onClick }, { key: 'event-1', label: '제멀', active: true }],
      columnLabel: '제자리멀리뛰기 TOP 10 · cm',
      male: [{ rank: 1, name: '김도윤', school: '가람고', main: 285, unit: 'cm', sub: '100점' }],
      female: [],
    });

    expect(screen.getByText('285')).toBeInTheDocument();
    expect(screen.getByText('100점')).toBeInTheDocument();
    expect(screen.getByText('기록 없음')).toBeInTheDocument();
    // jsdom 은 칸 크기가 0 이라 판이 아직 숨김 상태다 → 글자로 찾는다
    fireEvent.click(screen.getByText('종합순위'));
    expect(onClick).toHaveBeenCalled();
  });

  it('기록이 하나도 없으면 안내 문구만 보인다', () => {
    renderBoard(3, { noData: true });
    expect(screen.getByText('아직 기록이 없습니다')).toBeInTheDocument();
  });
});
