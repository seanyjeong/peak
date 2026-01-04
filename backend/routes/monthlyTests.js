const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');

// 월말테스트 목록 조회
router.get('/', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const [tests] = await pool.query(`
      SELECT
        mt.*,
        (SELECT COUNT(*) FROM test_sessions WHERE monthly_test_id = mt.id) as session_count,
        (SELECT COUNT(DISTINCT tp.id)
         FROM test_participants tp
         JOIN test_sessions ts ON tp.test_session_id = ts.id
         WHERE ts.monthly_test_id = mt.id) as participant_count
      FROM monthly_tests mt
      WHERE mt.academy_id = ?
      ORDER BY mt.test_month DESC
    `, [academyId]);

    res.json({ success: true, tests });
  } catch (error) {
    console.error('월말테스트 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 월말테스트 상세 조회 (종목 포함)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { id } = req.params;

    // 테스트 기본 정보 - 해당 학원만
    const [tests] = await pool.query(`
      SELECT * FROM monthly_tests WHERE id = ? AND academy_id = ?
    `, [id, academyId]);

    if (tests.length === 0) {
      return res.status(404).json({ success: false, message: '테스트를 찾을 수 없습니다.' });
    }

    const test = tests[0];

    // 학원 정보 (P-ACA에서 이름, peak_settings에서 slug)
    const [academies] = await pacaPool.query(`
      SELECT id, name FROM academies WHERE id = ?
    `, [academyId]);
    const [peakSettings] = await pool.query(`
      SELECT slug, academy_name FROM peak_settings WHERE academy_id = ?
    `, [academyId]);

    const academy = {
      id: academies[0]?.id,
      name: academies[0]?.name,
      slug: peakSettings[0]?.slug || ''
    };

    // 선택된 종목
    const [types] = await pool.query(`
      SELECT mtt.*, rt.name, rt.short_name, rt.unit, rt.direction
      FROM monthly_test_types mtt
      JOIN record_types rt ON mtt.record_type_id = rt.id
      WHERE mtt.monthly_test_id = ?
      ORDER BY mtt.display_order
    `, [id]);

    // 세션 목록
    const [sessions] = await pool.query(`
      SELECT
        ts.*,
        (SELECT COUNT(*) FROM test_participants WHERE test_session_id = ts.id) as participant_count,
        (SELECT COUNT(*) FROM test_groups WHERE test_session_id = ts.id) as group_count
      FROM test_sessions ts
      WHERE ts.monthly_test_id = ?
      ORDER BY ts.test_date, FIELD(ts.time_slot, 'morning', 'afternoon', 'evening')
    `, [id]);

    res.json({
      success: true,
      test: {
        ...test,
        record_types: types,
        sessions
      },
      academy: {
        id: academy.id,
        name: academy.name ? decrypt(academy.name) : '',
        slug: academy.slug
      }
    });
  } catch (error) {
    console.error('월말테스트 상세 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 월말테스트 생성
router.post('/', verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const academyId = req.user.academyId;
    const { test_month, test_name, notes, record_type_ids } = req.body;

    // 중복 체크 - 해당 학원만
    const [existing] = await conn.query(
      'SELECT id FROM monthly_tests WHERE test_month = ? AND academy_id = ?',
      [test_month, academyId]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `${test_month} 테스트가 이미 존재합니다.`
      });
    }

    // 테스트 생성
    const [result] = await conn.query(`
      INSERT INTO monthly_tests (academy_id, test_month, test_name, notes)
      VALUES (?, ?, ?, ?)
    `, [academyId, test_month, test_name || `${test_month.split('-')[1]}월 월말테스트`, notes]);

    const testId = result.insertId;

    // 종목 연결
    if (record_type_ids && record_type_ids.length > 0) {
      const typeValues = record_type_ids.map((typeId, idx) => [testId, typeId, idx]);
      await conn.query(`
        INSERT INTO monthly_test_types (monthly_test_id, record_type_id, display_order)
        VALUES ?
      `, [typeValues]);
    }

    await conn.commit();
    res.json({ success: true, id: testId, message: '월말테스트가 생성되었습니다.' });
  } catch (error) {
    await conn.rollback();
    console.error('월말테스트 생성 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// 월말테스트 수정
router.put('/:id', verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const academyId = req.user.academyId;
    const { id } = req.params;
    const { test_name, status, notes, record_type_ids } = req.body;

    // 테스트 수정 - 해당 학원만
    await conn.query(`
      UPDATE monthly_tests
      SET test_name = ?, status = ?, notes = ?
      WHERE id = ? AND academy_id = ?
    `, [test_name, status, notes, id, academyId]);

    // 종목 재설정
    if (record_type_ids !== undefined) {
      await conn.query('DELETE FROM monthly_test_types WHERE monthly_test_id = ?', [id]);

      if (record_type_ids.length > 0) {
        const typeValues = record_type_ids.map((typeId, idx) => [id, typeId, idx]);
        await conn.query(`
          INSERT INTO monthly_test_types (monthly_test_id, record_type_id, display_order)
          VALUES ?
        `, [typeValues]);
      }
    }

    await conn.commit();
    res.json({ success: true, message: '월말테스트가 수정되었습니다.' });
  } catch (error) {
    await conn.rollback();
    console.error('월말테스트 수정 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// 월말테스트 삭제
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { id } = req.params;

    await pool.query('DELETE FROM monthly_tests WHERE id = ? AND academy_id = ?', [id, academyId]);

    res.json({ success: true, message: '월말테스트가 삭제되었습니다.' });
  } catch (error) {
    console.error('월말테스트 삭제 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 세션 추가
router.post('/:testId/sessions', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { testId } = req.params;
    const { test_date, time_slot, notes } = req.body;

    // 테스트가 해당 학원 소속인지 확인
    const [testCheck] = await pool.query('SELECT id FROM monthly_tests WHERE id = ? AND academy_id = ?', [testId, academyId]);
    if (testCheck.length === 0) {
      return res.status(404).json({ success: false, message: '테스트를 찾을 수 없습니다.' });
    }

    const [result] = await pool.query(`
      INSERT INTO test_sessions (monthly_test_id, test_date, time_slot, notes)
      VALUES (?, ?, ?, ?)
    `, [testId, test_date, time_slot, notes]);

    res.json({ success: true, id: result.insertId, message: '세션이 추가되었습니다.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: '해당 날짜/시간대에 이미 세션이 존재합니다.'
      });
    }
    console.error('세션 추가 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 학원 슬러그 업데이트 (전광판 URL용) - peak_settings 사용
router.put('/academy/slug', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { slug } = req.body;

    if (!slug || slug.trim() === '') {
      return res.status(400).json({ success: false, message: '슬러그를 입력해주세요.' });
    }

    // 슬러그 형식 검증 (영문 소문자, 숫자, 하이픈만)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        success: false,
        message: '슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.'
      });
    }

    // 중복 체크 (다른 학원이 사용 중인지) - peak_settings에서
    const [existing] = await pool.query(
      'SELECT id FROM peak_settings WHERE slug = ? AND academy_id != ?',
      [slug, academyId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 슬러그입니다.'
      });
    }

    // P-ACA에서 학원명 조회
    const [academyInfo] = await pacaPool.query(
      'SELECT name FROM academies WHERE id = ?',
      [academyId]
    );
    const academyName = academyInfo[0]?.name || '학원';

    // peak_settings에 UPSERT
    await pool.query(`
      INSERT INTO peak_settings (academy_id, slug, academy_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE slug = VALUES(slug)
    `, [academyId, slug, academyName]);

    res.json({ success: true, message: '슬러그가 업데이트되었습니다.', slug });
  } catch (error) {
    console.error('슬러그 업데이트 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 세션 목록 조회
router.get('/:testId/sessions', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { testId } = req.params;

    // 테스트가 해당 학원 소속인지 확인
    const [testCheck] = await pool.query('SELECT id FROM monthly_tests WHERE id = ? AND academy_id = ?', [testId, academyId]);
    if (testCheck.length === 0) {
      return res.status(404).json({ success: false, message: '테스트를 찾을 수 없습니다.' });
    }

    const [sessions] = await pool.query(`
      SELECT
        ts.*,
        (SELECT COUNT(*) FROM test_participants WHERE test_session_id = ts.id) as participant_count,
        (SELECT COUNT(*) FROM test_groups WHERE test_session_id = ts.id) as group_count
      FROM test_sessions ts
      WHERE ts.monthly_test_id = ?
      ORDER BY ts.test_date, FIELD(ts.time_slot, 'morning', 'afternoon', 'evening')
    `, [testId]);

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('세션 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== 충돌 종목 관리 =====

// 충돌 목록 조회
router.get('/:testId/conflicts', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { testId } = req.params;

    // 테스트 소유권 확인
    const [testCheck] = await pool.query(
      'SELECT id FROM monthly_tests WHERE id = ? AND academy_id = ?',
      [testId, academyId]
    );
    if (testCheck.length === 0) {
      return res.status(404).json({ success: false, message: '테스트를 찾을 수 없습니다.' });
    }

    const [conflicts] = await pool.query(`
      SELECT
        c.id,
        c.record_type_id_1,
        c.record_type_id_2,
        rt1.name as type1_name,
        rt1.short_name as type1_short,
        rt2.name as type2_name,
        rt2.short_name as type2_short
      FROM record_type_conflicts c
      JOIN record_types rt1 ON c.record_type_id_1 = rt1.id
      JOIN record_types rt2 ON c.record_type_id_2 = rt2.id
      WHERE c.monthly_test_id = ?
    `, [testId]);

    res.json({ success: true, conflicts });
  } catch (error) {
    console.error('충돌 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 충돌 추가
router.post('/:testId/conflicts', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { testId } = req.params;
    let { record_type_id_1, record_type_id_2 } = req.body;

    // id_1 < id_2 보장
    if (record_type_id_1 > record_type_id_2) {
      [record_type_id_1, record_type_id_2] = [record_type_id_2, record_type_id_1];
    }

    if (record_type_id_1 === record_type_id_2) {
      return res.status(400).json({ success: false, message: '같은 종목은 충돌 설정할 수 없습니다.' });
    }

    // 테스트 소유권 확인
    const [testCheck] = await pool.query(
      'SELECT id FROM monthly_tests WHERE id = ? AND academy_id = ?',
      [testId, academyId]
    );
    if (testCheck.length === 0) {
      return res.status(404).json({ success: false, message: '테스트를 찾을 수 없습니다.' });
    }

    const [result] = await pool.query(`
      INSERT INTO record_type_conflicts (academy_id, monthly_test_id, record_type_id_1, record_type_id_2)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id
    `, [academyId, testId, record_type_id_1, record_type_id_2]);

    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('충돌 추가 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 충돌 삭제
router.delete('/:testId/conflicts/:conflictId', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { testId, conflictId } = req.params;

    // 테스트 소유권 확인
    const [testCheck] = await pool.query(
      'SELECT id FROM monthly_tests WHERE id = ? AND academy_id = ?',
      [testId, academyId]
    );
    if (testCheck.length === 0) {
      return res.status(404).json({ success: false, message: '테스트를 찾을 수 없습니다.' });
    }

    await pool.query(
      'DELETE FROM record_type_conflicts WHERE id = ? AND monthly_test_id = ?',
      [conflictId, testId]
    );

    res.json({ success: true, message: '충돌이 삭제되었습니다.' });
  } catch (error) {
    console.error('충돌 삭제 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 충돌 일괄 설정 (종목 수정 시 함께 저장)
router.put('/:testId/conflicts', verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const academyId = req.user.academyId;
    const { testId } = req.params;
    const { conflicts } = req.body; // [[id1, id2], [id3, id4], ...]

    // 테스트 소유권 확인
    const [testCheck] = await conn.query(
      'SELECT id FROM monthly_tests WHERE id = ? AND academy_id = ?',
      [testId, academyId]
    );
    if (testCheck.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: '테스트를 찾을 수 없습니다.' });
    }

    // 기존 충돌 삭제
    await conn.query('DELETE FROM record_type_conflicts WHERE monthly_test_id = ?', [testId]);

    // 새 충돌 추가
    if (conflicts && conflicts.length > 0) {
      const values = conflicts.map(c => {
        // 객체 형식 { record_type_id_1, record_type_id_2 } 또는 배열 형식 [id1, id2] 모두 지원
        const id1 = Array.isArray(c) ? c[0] : c.record_type_id_1;
        const id2 = Array.isArray(c) ? c[1] : c.record_type_id_2;
        const [min, max] = id1 < id2 ? [id1, id2] : [id2, id1];
        return [academyId, testId, min, max];
      });
      await conn.query(`
        INSERT INTO record_type_conflicts (academy_id, monthly_test_id, record_type_id_1, record_type_id_2)
        VALUES ?
      `, [values]);
    }

    await conn.commit();
    res.json({ success: true, message: '충돌 설정이 저장되었습니다.' });
  } catch (error) {
    await conn.rollback();
    console.error('충돌 일괄 설정 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
