const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 설정 조회
router.get('/', async (req, res) => {
  try {
    const academyId = req.user?.academy_id || 2;

    const [settings] = await pool.query(`
      SELECT id, academy_id, slug, academy_name, created_at, updated_at
      FROM peak_settings
      WHERE academy_id = ?
    `, [academyId]);

    if (settings.length === 0) {
      // 설정이 없으면 기본값 반환
      return res.json({
        success: true,
        settings: {
          academy_id: academyId,
          slug: '',
          academy_name: ''
        }
      });
    }

    res.json({
      success: true,
      settings: settings[0]
    });
  } catch (error) {
    console.error('설정 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 설정 저장 (upsert)
router.post('/', async (req, res) => {
  try {
    const academyId = req.user?.academy_id || 2;
    const { slug, academy_name } = req.body;

    if (!slug || !academy_name) {
      return res.status(400).json({
        success: false,
        message: 'slug와 academy_name은 필수입니다.'
      });
    }

    // slug 유효성 검사 (영문 소문자, 숫자, 하이픈만 허용)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        success: false,
        message: 'slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.'
      });
    }

    // 중복 체크 (다른 학원의 slug와 겹치지 않는지)
    const [existing] = await pool.query(`
      SELECT id FROM peak_settings WHERE slug = ? AND academy_id != ?
    `, [slug, academyId]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 slug입니다.'
      });
    }

    // UPSERT
    await pool.query(`
      INSERT INTO peak_settings (academy_id, slug, academy_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE slug = VALUES(slug), academy_name = VALUES(academy_name)
    `, [academyId, slug, academy_name]);

    res.json({
      success: true,
      message: '설정이 저장되었습니다.',
      settings: { academy_id: academyId, slug, academy_name }
    });
  } catch (error) {
    console.error('설정 저장 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
