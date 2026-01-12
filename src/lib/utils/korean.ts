/**
 * 한글 초성 관련 유틸리티
 */

// 전체 초성 목록 (유니코드 순서)
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 표시용 초성 목록 (쌍자음 제외)
export const DISPLAY_CHOSUNG = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 쌍자음 → 기본 자음 매핑
const DOUBLE_TO_SINGLE: Record<string, string> = {
  'ㄲ': 'ㄱ',
  'ㄸ': 'ㄷ',
  'ㅃ': 'ㅂ',
  'ㅆ': 'ㅅ',
  'ㅉ': 'ㅈ',
};

/**
 * 문자열의 첫 글자에서 초성을 추출
 * @param name 이름 문자열
 * @returns 초성 (쌍자음은 기본 자음으로 정규화)
 */
export function getChosung(name: string): string {
  if (!name || name.length === 0) return 'ㄱ';

  const firstChar = name.charAt(0);
  const code = firstChar.charCodeAt(0);

  // 한글 범위 체크 (가 ~ 힣)
  if (code < 0xAC00 || code > 0xD7A3) {
    // 영문이면 대문자로 반환
    if (/[a-zA-Z]/.test(firstChar)) {
      return firstChar.toUpperCase();
    }
    // 그 외 문자는 기본값
    return 'ㄱ';
  }

  // 초성 인덱스 계산: (코드 - 0xAC00) / 588
  const chosungIndex = Math.floor((code - 0xAC00) / 588);
  const chosung = CHOSUNG_LIST[chosungIndex];

  // 쌍자음이면 기본 자음으로 변환
  return DOUBLE_TO_SINGLE[chosung] || chosung;
}

/**
 * 아이템 목록을 초성별로 그룹핑
 * @param items 그룹핑할 아이템 배열
 * @param getName 아이템에서 이름을 추출하는 함수
 * @returns 초성별로 그룹핑된 객체
 */
export function groupByChosung<T>(
  items: T[],
  getName: (item: T) => string
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of items) {
    const name = getName(item);
    const chosung = getChosung(name);

    if (!groups[chosung]) {
      groups[chosung] = [];
    }
    groups[chosung].push(item);
  }

  return groups;
}

/**
 * 그룹핑된 객체를 초성 순서대로 정렬된 배열로 변환
 * @param groups 초성별 그룹 객체
 * @returns [초성, 아이템[]] 튜플 배열 (초성 순서대로 정렬)
 */
export function getSortedGroups<T>(
  groups: Record<string, T[]>
): [string, T[]][] {
  const chosungOrder = [...DISPLAY_CHOSUNG, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  return Object.entries(groups).sort(([a], [b]) => {
    const indexA = chosungOrder.indexOf(a);
    const indexB = chosungOrder.indexOf(b);

    // 목록에 없는 문자는 맨 뒤로
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });
}
