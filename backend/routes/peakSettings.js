const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  hashBoardPin,
  validateBoardPin,
  validateBoardSlug,
} = require('../utils/board-access');
const { requireFeaturePermission } = require('../utils/feature-permissions');
const {
  findPeakSettingsByAcademy,
  isMissingBoardPinColumn,
  serializePeakSettings,
} = require('../utils/peak-settings');

const requireMeasurementSettings = requireFeaturePermission('measurementSettingsManage');

async function findDuplicateSlug(slug, academyId) {
  const [existing] = await pool.query(
    'SELECT id FROM peak_settings WHERE slug = ? AND academy_id != ?',
    [slug, academyId]
  );
  return existing;
}

function handleSettingsError(res, error, logLabel) {
  console.error(logLabel, error);
  if (isMissingBoardPinColumn(error)) {
    return res.status(500).json({
      success: false,
      message: '전광판 PIN 저장을 위한 DB 업데이트가 아직 적용되지 않았습니다.',
    });
  }
  return res.status(500).json({
    success: false,
    message: '설정을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
  });
}

// 설정 조회
router.get('/', async (req, res) => {
  try {
    const academyId = req.user.academyId;
    res.json({
      success: true,
      settings: serializePeakSettings(await findPeakSettingsByAcademy(pool, academyId), academyId)
    });
  } catch (error) {
    return handleSettingsError(res, error, '설정 조회 오류:');
  }
});

// 전광판 주소 중복 확인
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const validation = validateBoardSlug(req.params.slug);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const existing = await findDuplicateSlug(validation.slug, academyId);
    const available = existing.length === 0;

    return res.json({
      success: true,
      available,
      slug: validation.slug,
      message: available
        ? '사용할 수 있는 전광판 주소입니다.'
        : '이미 다른 학원에서 사용 중인 전광판 주소입니다.',
    });
  } catch (error) {
    return handleSettingsError(res, error, '전광판 주소 중복 확인 오류:');
  }
});

// 설정 저장 (upsert)
router.post('/', requireMeasurementSettings, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { slug, academy_name } = req.body;

    if (!slug || !academy_name) {
      return res.status(400).json({
        success: false,
        message: 'slug와 academy_name은 필수입니다.'
      });
    }

    const validation = validateBoardSlug(slug);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const existing = await findDuplicateSlug(validation.slug, academyId);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 다른 학원에서 사용 중인 전광판 주소입니다.'
      });
    }

    // UPSERT
    await pool.query(`
      INSERT INTO peak_settings (academy_id, slug, academy_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE slug = VALUES(slug), academy_name = VALUES(academy_name)
    `, [academyId, validation.slug, academy_name]);

    res.json({
      success: true,
      message: '설정이 저장되었습니다.',
      settings: { academy_id: academyId, slug: validation.slug, academy_name }
    });
  } catch (error) {
    return handleSettingsError(res, error, '설정 저장 오류:');
  }
});

// 전광판 PIN 저장/해제
router.patch('/board-pin', requireMeasurementSettings, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const settings = await findPeakSettingsByAcademy(pool, academyId);
    if (!settings?.slug) {
      return res.status(400).json({
        success: false,
        message: '전광판 주소를 먼저 저장해주세요.',
      });
    }

    if (req.body?.clear_board_pin) {
      await pool.query(
        'UPDATE peak_settings SET board_pin_hash = NULL, board_pin_updated_at = NOW() WHERE academy_id = ?',
        [academyId]
      );
      return res.json({
        success: true,
        message: '전광판 PIN을 해제했습니다.',
        has_board_pin: false,
      });
    }

    const validation = validateBoardPin(req.body?.board_pin);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const boardPinHash = await hashBoardPin(validation.pin);
    await pool.query(
      'UPDATE peak_settings SET board_pin_hash = ?, board_pin_updated_at = NOW() WHERE academy_id = ?',
      [boardPinHash, academyId]
    );

    return res.json({
      success: true,
      message: '전광판 PIN을 저장했습니다.',
      has_board_pin: true,
    });
  } catch (error) {
    return handleSettingsError(res, error, '전광판 PIN 저장 오류:');
  }
});

module.exports = router;
