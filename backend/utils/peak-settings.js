function isMissingBoardPinColumn(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' && String(error.message || '').includes('board_pin');
}

function withBoardPinDefault(row) {
  if (!row) return null;
  return {
    ...row,
    board_pin_hash: row.board_pin_hash || null,
    board_pin_updated_at: row.board_pin_updated_at || null,
  };
}

async function findPeakSettingsByAcademy(db, academyId) {
  try {
    const [settings] = await db.query(`
      SELECT id, academy_id, slug, academy_name, board_pin_hash, board_pin_updated_at, created_at, updated_at
      FROM peak_settings
      WHERE academy_id = ?
    `, [academyId]);
    return withBoardPinDefault(settings[0]);
  } catch (error) {
    if (!isMissingBoardPinColumn(error)) throw error;
    const [settings] = await db.query(`
      SELECT id, academy_id, slug, academy_name, created_at, updated_at
      FROM peak_settings
      WHERE academy_id = ?
    `, [academyId]);
    return withBoardPinDefault(settings[0]);
  }
}

async function findBoardSettingsBySlug(db, slug) {
  try {
    const [settings] = await db.query(`
      SELECT academy_id, slug, academy_name, board_pin_hash
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
  };
}

module.exports = {
  findBoardSettingsBySlug,
  findPeakSettingsByAcademy,
  isMissingBoardPinColumn,
  serializePeakSettings,
  toBoardAcademy,
};
