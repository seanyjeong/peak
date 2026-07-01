import {
  clearStoredBoardToken,
  fetchBoardJson,
  getStoredBoardToken,
  storeBoardToken,
  submitBoardPin,
} from '@/app/board/[slug]/board-access';

describe('board public access client helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    global.fetch = jest.fn();
  });

  it('stores board tokens per slug and sends them as bearer tokens', async () => {
    storeBoardToken('ilsanmax', 'board-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ success: true }),
    });

    await fetchBoardJson('/public/ilsanmax', 'ilsanmax');

    expect(getStoredBoardToken('ilsanmax')).toBe('board-token');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://supermax.kr/peak/public/ilsanmax',
      { headers: { Authorization: 'Bearer board-token' } }
    );
  });

  it('clears stored tokens when the board API asks for PIN again', async () => {
    storeBoardToken('ilsanmax', 'expired-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 401,
      json: async () => ({
        success: false,
        requiresPin: true,
        message: '전광판 PIN을 입력해주세요.',
      }),
    });

    const json = await fetchBoardJson('/public/ilsanmax', 'ilsanmax');

    expect(json).toMatchObject({ requiresPin: true });
    expect(getStoredBoardToken('ilsanmax')).toBeNull();
  });

  it('submits board PIN and returns the issued board token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        requiresPin: false,
        boardToken: 'new-token',
      }),
    });

    await expect(submitBoardPin('ilsanmax', '1234')).resolves.toMatchObject({
      boardToken: 'new-token',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://supermax.kr/peak/public/ilsanmax/pin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pin: '1234' }),
      })
    );
  });

  it('removes board tokens explicitly', () => {
    storeBoardToken('ilsanmax', 'board-token');
    clearStoredBoardToken('ilsanmax');
    expect(getStoredBoardToken('ilsanmax')).toBeNull();
  });
});
