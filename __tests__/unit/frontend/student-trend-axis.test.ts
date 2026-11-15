import type { getTickValuesFixedDomain as TickValues } from 'recharts/types/util/scale/getNiceTickValues';
import { getTrendAxis } from '@/app/(pc)/students/[id]/student-profile-model';

// 그래프(recharts)가 고정 범위에서 실제로 눈금을 만드는 함수
const { getTickValuesFixedDomain } = jest.requireActual<{ getTickValuesFixedDomain: typeof TickValues }>(
  'recharts/lib/util/scale/getNiceTickValues',
);

describe('학생 상세 기록 추이 축', () => {
  it('기록 1.12 하나의 축 범위에 소수 오차가 남지 않는다 (QA Q04)', () => {
    const axis = getTrendAxis([1.12], 2);

    expect(axis.domain).toEqual([0.12, 2.12]);
    expect(axis.decimalPlaces).toBe(2);
    // 그래프가 실제로 그리는 눈금 (고치기 전: 0.1200000000000001, 0.6200000000000001, …)
    expect(getTickValuesFixedDomain(axis.domain, 5, true)).toEqual([0.12, 0.62, 1.12, 1.62, 2.12]);
  });

  it('배점표 소수 자리보다 잘게 저장된 기록이 있으면 그 자리까지 보인다', () => {
    expect(getTrendAxis([7.25, 7.5], 1).decimalPlaces).toBe(2);
    expect(getTrendAxis([250, 252], 0)).toEqual({ domain: [249, 253], decimalPlaces: 0 });
    // 정수 종목은 소수 눈금을 끄므로(allowDecimals) 249.5 같은 눈금이 '250'으로 겹쳐 보이지 않는다.
    expect(getTickValuesFixedDomain(getTrendAxis([250], 0).domain, 5, false)).toEqual([249, 250, 251]);
  });

  it('배점표가 없으면 기록의 소수 자리를 쓰고, 기록이 없으면 0~100', () => {
    expect(getTrendAxis([1.12])).toEqual({ domain: [0.12, 2.12], decimalPlaces: 2 });
    expect(getTrendAxis([])).toEqual({ domain: [0, 100], decimalPlaces: 0 });
  });
});
