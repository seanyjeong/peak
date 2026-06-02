const {
  exchangePeakSsoCode,
  hashPeakSsoCode,
} = require('../../../backend/utils/peak-sso');

function createPool({ rows = [], updateResult = { affectedRows: 1 } } = {}) {
  return {
    query: jest.fn(async (sql) => {
      if (sql.includes('SELECT c.id')) {
        return [rows];
      }
      if (sql.includes('UPDATE peak_sso_codes')) {
        return [updateResult];
      }
      return [[]];
    }),
  };
}

describe('Peak SSO exchange utility', () => {
  test('exchanges a valid one-time code and marks it used', async () => {
    const code = 'a'.repeat(64);
    const pool = createPool({
      rows: [{
        code_id: 1,
        user_id: 10,
        academy_id: 5,
        email: 'owner@example.com',
        name: 'ENC:name',
        role: 'owner',
        is_active: 1,
        approval_status: 'approved',
        position: '원장',
        instructor_id: null,
      }],
    });

    const user = await exchangePeakSsoCode(pool, code);

    expect(user).toMatchObject({ user_id: 10, academy_id: 5, email: 'owner@example.com' });
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE peak_sso_codes'),
      [1]
    );
  });

  test('rejects invalid or reused codes', async () => {
    const pool = createPool({ rows: [] });
    await expect(exchangePeakSsoCode(pool, 'bad')).rejects.toMatchObject({ code: 'INVALID_SSO_CODE' });
  });

  test('hashes codes without exposing the raw value', () => {
    const code = 'b'.repeat(64);
    expect(hashPeakSsoCode(code)).toHaveLength(64);
    expect(hashPeakSsoCode(code)).not.toBe(code);
  });
});
