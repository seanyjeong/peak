const { findPeakSettingsByAcademy, saveBoardSlug } = require('../../../backend/utils/peak-settings');

// D15: 같은 학원 행이 여러 개(11 demo · 12 qa-astra · 14 qa-redesign) 있어도 읽기·저장이 같은 대표 행을 쓴다.
function createDb(rows) {
  const state = rows.map((row) => ({ ...row }));
  const calls = [];
  const sortCanonical = (list) => [...list].sort((a, b) => (b.updated_at - a.updated_at) || (b.id - a.id));
  const query = jest.fn(async (sql, params) => {
    calls.push(sql);
    if (sql.trim().startsWith('SELECT') && sql.includes('FROM peak_settings') && sql.includes('WHERE academy_id = ?')) {
      const list = sortCanonical(state.filter((row) => row.academy_id === params[0]));
      return [sql.includes('LIMIT 1') ? list.slice(0, 1) : list];
    }
    if (sql.includes('UPDATE peak_settings')) {
      const [slug, name, , , id] = params;
      const row = state.find((item) => item.id === id);
      row.slug = slug;
      if (name !== null) row.academy_name = name;
      row.updated_at = Math.max(...state.map((item) => item.updated_at)) + 1;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('INSERT INTO peak_settings')) {
      state.push({ id: 99, academy_id: params[0], slug: params[1], academy_name: params[2], updated_at: 100 });
      return [{ insertId: 99 }];
    }
    return [[]];
  });
  const connection = { query, beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
  return { db: { query, getConnection: async () => connection }, state, calls };
}

const duplicated = [
  { id: 11, academy_id: 1, slug: 'demo', academy_name: '로컬', updated_at: 10 },
  { id: 12, academy_id: 1, slug: 'qa-astra', academy_name: '대구', updated_at: 10 },
  { id: 14, academy_id: 1, slug: 'qa-redesign', academy_name: '대구', updated_at: 20 },
];

describe('peak settings canonical row (D15)', () => {
  it('reads the most recently saved row for the academy', async () => {
    const { db } = createDb(duplicated);
    const settings = await findPeakSettingsByAcademy(db, 1);
    expect(settings.slug).toBe('qa-redesign');
  });

  it('updates the canonical row instead of inserting a new one, and reads it back', async () => {
    const { db, state } = createDb(duplicated);
    await saveBoardSlug(db, { academyId: 1, slug: 'new-board', academyName: '대구' });
    expect(state).toHaveLength(3);
    expect(state.find((row) => row.id === 14).slug).toBe('new-board');
    expect((await findPeakSettingsByAcademy(db, 1)).slug).toBe('new-board');
  });

  it('reuses an older row of the same academy that already has the slug', async () => {
    const { db, state } = createDb(duplicated);
    await saveBoardSlug(db, { academyId: 1, slug: 'demo', academyName: null });
    expect(state).toHaveLength(3);
    expect((await findPeakSettingsByAcademy(db, 1)).slug).toBe('demo');
    expect(state.find((row) => row.id === 11).academy_name).toBe('로컬');
  });

  it('inserts only when the academy has no row yet', async () => {
    const { db, state } = createDb([]);
    const result = await saveBoardSlug(db, { academyId: 7, slug: 'seven', academyName: null, fallbackName: '칠곡' });
    expect(result.created).toBe(true);
    expect(state).toEqual([expect.objectContaining({ academy_id: 7, slug: 'seven', academy_name: '칠곡' })]);
  });
});
