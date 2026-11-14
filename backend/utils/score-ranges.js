// 배점 구간 수정 검증. 화면 src/app/(pc)/settings/settings-model.ts validateScoreRange 와 같은 규칙.
// - 네 경계값은 0 이상 숫자, 최소 ≤ 최대
// - 배점표 소수 자리(decimal_places)보다 잘게 쪼갠 값은 받지 않는다(정수 종목에 5.5 등). 9999.99 는 '이상' 표시용 끝값이라 예외
// - 같은 배점표의 다른 구간과 남·여 각각 겹치지 않아야 한다
const OPEN_MAX = 9999.99;
const FIELDS = [
  ['male_min', '남자 최소'],
  ['male_max', '남자 최대'],
  ['female_min', '여자 최소'],
  ['female_max', '여자 최대'],
];

function hasAllowedPrecision(value, decimalPlaces) {
  if (value === OPEN_MAX) return true;
  const factor = Math.pow(10, decimalPlaces);
  return Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}

function overlaps(aMin, aMax, bMin, bMax) {
  return aMin <= bMax && aMax >= bMin;
}

function validateScoreRange({ range, others = [], decimalPlaces = 0 }) {
  const values = {};
  for (const [field, label] of FIELDS) {
    const value = Number(range[field]);
    if (range[field] === null || range[field] === undefined || range[field] === '' || !Number.isFinite(value)) {
      return `${label} 값을 숫자로 입력해주세요.`;
    }
    if (value < 0 || value > OPEN_MAX) {
      return `${label} 값은 0 이상이어야 합니다.`;
    }
    if (!hasAllowedPrecision(value, decimalPlaces)) {
      return decimalPlaces === 0
        ? `${label} 값은 정수로 입력해주세요. 이 배점표는 소수점을 쓰지 않습니다.`
        : `${label} 값은 소수점 ${decimalPlaces}자리까지 입력해주세요.`;
    }
    values[field] = value;
  }

  if (values.male_min > values.male_max) return '남자 최소값이 최대값보다 큽니다.';
  if (values.female_min > values.female_max) return '여자 최소값이 최대값보다 큽니다.';

  for (const other of others) {
    if (overlaps(values.male_min, values.male_max, Number(other.male_min), Number(other.male_max))) {
      return `남자 구간이 ${other.score}점 구간과 겹칩니다.`;
    }
    if (overlaps(values.female_min, values.female_max, Number(other.female_min), Number(other.female_max))) {
      return `여자 구간이 ${other.score}점 구간과 겹칩니다.`;
    }
  }

  return null;
}

module.exports = { OPEN_MAX, validateScoreRange };
