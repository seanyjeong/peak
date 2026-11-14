const { validateScoreRange } = require('../../../backend/utils/score-ranges');

// 정수 종목(소수 0자리) 높을수록 좋음 예: 50점 5~5, 40점 6~6 ... 같은 모양의 구간
const others = [
  { id: 2, score: 40, male_min: '6.00', male_max: '6.00', female_min: '6.00', female_max: '6.00' },
  { id: 3, score: 60, male_min: '4.00', male_max: '4.00', female_min: '4.00', female_max: '4.00' },
];

describe('validateScoreRange (D14)', () => {
  it('blocks values finer than the score table decimal places', () => {
    expect(validateScoreRange({
      range: { male_min: 5, male_max: 5.5, female_min: 5, female_max: 5 },
      others,
      decimalPlaces: 0,
    })).toBe('남자 최대 값은 정수로 입력해주세요. 이 배점표는 소수점을 쓰지 않습니다.');
  });

  it('blocks ranges overlapping another score range', () => {
    expect(validateScoreRange({
      range: { male_min: 5, male_max: 6, female_min: 5, female_max: 5 },
      others,
      decimalPlaces: 0,
    })).toBe('남자 구간이 40점 구간과 겹칩니다.');
  });

  it('blocks min greater than max', () => {
    expect(validateScoreRange({
      range: { male_min: 5, male_max: 5, female_min: 5.2, female_max: 5.1 },
      others: [],
      decimalPlaces: 1,
    })).toBe('여자 최소값이 최대값보다 큽니다.');
  });

  it('accepts a valid range and the open-ended 9999.99 bound', () => {
    expect(validateScoreRange({
      range: { male_min: 5, male_max: 5, female_min: 7, female_max: 9999.99 },
      others: [],
      decimalPlaces: 0,
    })).toBeNull();
    expect(validateScoreRange({
      range: { male_min: '5.25', male_max: '5.75', female_min: 5, female_max: 5 },
      others,
      decimalPlaces: 2,
    })).toBeNull();
  });
});
