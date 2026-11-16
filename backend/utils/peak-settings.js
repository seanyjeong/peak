function isMissingBoardPinColumn(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' && String(error.message || '').includes('board_pin');
}

// 전광판 테마: 1 스포츠 중계, 2 경기장 LED, 3 밝고 깔끔, 4 시상대, 5 육상 트랙
const BOARD_THEMES = [1, 2, 3, 4, 5];
const DEFAULT_BOARD_THEME = 1;

function normalizeBoardTheme(value) {
  const theme = Number(value);
  return BOARD_THEMES.includes(theme) ? theme : DEFAULT_BOARD_THEME;
}

function withBoardPinDefault(row) {
  if (!row) return null;
  return {
    ...row,
    board_pin_hash: row.board_pin_hash || null,
    board_pin_updated_at: row.board_pin_updated_at || null,
    board_theme: normalizeBoardTheme(row.board_theme),
  };
}

// peak_settings 는 slug 에만 UNIQUE 가 걸려 있고 academy_id 에는 없다. 그래서 예전 저장(INSERT ... ON DUPLICATE KEY)이
// 주소를 바꿀 때마다 같은 학원 행을 새로 만들었다(D15). 학원당 '대표 행'은 가장 최근에 저장한 행으로 정하고,
// 읽기·저장 모두 이 행을 쓴다.
const CANONICAL_ORDER = 'ORDER BY updated_at DESC, id DESC';

async function findPeakSettingsByAcademy(db, academyId) {
  try {
    const [settings] = await db.query(`
      SELECT id, academy_id, slug, academy_name, board_pin_hash, board_pin_updated_at, board_theme, created_at, updated_at
      FROM peak_settings
      WHERE academy_id = ?
      ${CANONICAL_ORDER}
      LIMIT 1
    `, [academyId]);
    return withBoardPinDefault(settings[0]);
  } catch (error) {
    if (!isMissingBoardPinColumn(error)) throw error;
    const [settings] = await db.query(`
      SELECT id, academy_id, slug, academy_name, created_at, updated_at
      FROM peak_settings
      WHERE academy_id = ?
      ${CANONICAL_ORDER}
      LIMIT 1
    `, [academyId]);
    return withBoardPinDefault(settings[0]);
  }
}

/**
 * 전광판 주소 저장. 학원의 대표 행을 고쳐 쓰고, 행이 없을 때만 새로 만든다.
 * 같은 학원의 옛 행이 이미 그 주소를 갖고 있으면(slug UNIQUE) 그 행을 고쳐 대표 행으로 만든다.
 * academyName 이 null 이면 기존 학원명을 그대로 둔다(새로 만들 때는 fallbackName 사용).
 */
async function saveBoardSlug(db, { academyId, slug, academyName = null, fallbackName = '학원' }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, slug FROM peak_settings WHERE academy_id = ? ${CANONICAL_ORDER} FOR UPDATE`,
      [academyId]
    );
    const target = rows.find((row) => row.slug === slug) || rows[0];

    if (target) {
      // 같은 초에 다른 행이 고쳐졌어도 이 행이 대표가 되게, 같은 학원 다른 행보다 늦은 시각을 넣는다
      await connection.query(
        `UPDATE peak_settings
         SET slug = ?, academy_name = COALESCE(?, academy_name),
             updated_at = GREATEST(CURRENT_TIMESTAMP, COALESCE((
               SELECT latest.next_at FROM (
                 SELECT MAX(updated_at) + INTERVAL 1 SECOND AS next_at
                 FROM peak_settings WHERE academy_id = ? AND id <> ?
               ) latest
             ), CURRENT_TIMESTAMP))
         WHERE id = ? AND academy_id = ?`,
        [slug, academyName, academyId, target.id, target.id, academyId]
      );
    } else {
      await connection.query(
        'INSERT INTO peak_settings (academy_id, slug, academy_name) VALUES (?, ?, ?)',
        [academyId, slug, academyName ?? fallbackName]
      );
    }

    await connection.commit();
    return { id: target ? target.id : null, created: !target };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findBoardSettingsBySlug(db, slug) {
  try {
    const [settings] = await db.query(`
      SELECT academy_id, slug, academy_name, board_pin_hash, board_theme
      FROM peak_settings
      WHERE slug = ?
    `, [slug]);
    return withBoardPinDefault(settings[0]);
  } catch (error) {
    if (!isMissingBoardPinColumn(error)) throw error;
    const [settings] = await db.query(`
      SELECT academy_id, slug, academy_name
      FROM peak_settings
      WHERE slug = ?
    `, [slug]);
    return withBoardPinDefault(settings[0]);
  }
}

function serializePeakSettings(row, academyId) {
  if (!row) {
    return {
      academy_id: academyId,
      slug: '',
      academy_name: '',
      has_board_pin: false,
      board_theme: DEFAULT_BOARD_THEME,
    };
  }

  const { board_pin_hash: boardPinHash, ...safeSettings } = row;
  return {
    ...safeSettings,
    has_board_pin: Boolean(boardPinHash),
  };
}

function toBoardAcademy(row) {
  return {
    id: row.academy_id,
    name: row.academy_name,
    slug: row.slug,
    boardPinHash: row.board_pin_hash,
    theme: normalizeBoardTheme(row.board_theme),
  };
}

module.exports = {
  BOARD_THEMES,
  CANONICAL_ORDER,
  findBoardSettingsBySlug,
  findPeakSettingsByAcademy,
  saveBoardSlug,
  isMissingBoardPinColumn,
  normalizeBoardTheme,
  serializePeakSettings,
  toBoardAcademy,
};
