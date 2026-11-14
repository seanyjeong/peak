const { getKstDateString } = require('../../../backend/utils/kst-date');

describe('KST 기준 오늘 날짜', () => {
  it('한국 시간 새벽(00~09시)에도 UTC 전날이 아니라 한국 날짜를 낸다', () => {
    // 2026-11-14 01:41 KST = 2026-11-13 16:41 UTC
    expect(getKstDateString(new Date('2026-11-13T16:41:00Z'))).toBe('2026-11-14');
  });

  it('한국 시간 자정 직전은 그날 날짜다', () => {
    // 2026-11-14 23:59 KST = 2026-11-14 14:59 UTC
    expect(getKstDateString(new Date('2026-11-14T14:59:00Z'))).toBe('2026-11-14');
  });

  it('월말 새벽에 다음 달 1일을 낸다', () => {
    // 2026-12-01 00:30 KST = 2026-11-30 15:30 UTC
    expect(getKstDateString(new Date('2026-11-30T15:30:00Z'))).toBe('2026-12-01');
  });
});
