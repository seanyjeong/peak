const {
  boardPinRequiredPayload,
  createBoardAccessToken,
  hashBoardPin,
  validateBoardPin,
  validateBoardSlug,
  verifyBoardAccessToken,
  verifyBoardPin,
} = require('../../../backend/utils/board-access');
const {
  serializePeakSettings,
  toBoardAcademy,
} = require('../../../backend/utils/peak-settings');

describe('Peak board access utilities', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-board-pin';
  });

  it('validates board slugs with Korean plain-language messages', () => {
    expect(validateBoardSlug('academy-2')).toEqual({ valid: true, slug: 'academy-2' });
    expect(validateBoardSlug('')).toEqual({
      valid: false,
      message: '전광판 주소를 입력해주세요.',
    });
    expect(validateBoardSlug('academy_2')).toEqual({
      valid: false,
      message: '전광판 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.',
    });
  });

  it('accepts only numeric 4 to 12 digit board PIN values', () => {
    expect(validateBoardPin('1234')).toEqual({ valid: true, pin: '1234' });
    expect(validateBoardPin('123')).toEqual({
      valid: false,
      message: 'PIN은 숫자 4~12자리로 입력해주세요.',
    });
    expect(validateBoardPin('12ab')).toEqual({
      valid: false,
      message: 'PIN은 숫자 4~12자리로 입력해주세요.',
    });
  });

  it('hashes PIN values and verifies them without storing plaintext', async () => {
    const hash = await hashBoardPin('9876');

    expect(hash).not.toBe('9876');
    await expect(verifyBoardPin('9876', hash)).resolves.toBe(true);
    await expect(verifyBoardPin('1111', hash)).resolves.toBe(false);
  });

  it('creates board access tokens scoped to academy and slug', () => {
    const academy = { id: 7, slug: 'ilsanmax' };
    const token = createBoardAccessToken(academy);

    expect(verifyBoardAccessToken(token, academy)).toBe(true);
    expect(verifyBoardAccessToken(token, { id: 8, slug: 'ilsanmax' })).toBe(false);
    expect(verifyBoardAccessToken(token, { id: 7, slug: 'other' })).toBe(false);
  });

  it('does not expose board pin hashes in serialized settings', () => {
    const settings = serializePeakSettings({
      academy_id: 7,
      slug: 'ilsanmax',
      academy_name: '일산맥스',
      board_pin_hash: 'secret-hash',
    }, 7);

    expect(settings).toMatchObject({
      academy_id: 7,
      slug: 'ilsanmax',
      academy_name: '일산맥스',
      has_board_pin: true,
    });
    expect(settings.board_pin_hash).toBeUndefined();
  });

  it('returns only public academy fields when PIN is required', () => {
    const academy = toBoardAcademy({
      academy_id: 7,
      slug: 'ilsanmax',
      academy_name: '일산맥스',
      board_pin_hash: 'secret-hash',
    });

    expect(boardPinRequiredPayload(academy)).toEqual({
      success: false,
      requiresPin: true,
      academy: { name: '일산맥스', slug: 'ilsanmax' },
      message: '전광판 PIN을 입력해주세요.',
    });
  });
});
