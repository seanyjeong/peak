/**
 * Record Types Routes (측정 종목 관리)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// 자동 줄임말 생성
// 4글자 이하는 그대로, 그 이상은 null (수동 설정 필요)
const generateShortName = (name) => {
    if (!name) return null;
    // 짧은 이름(4글자 이하)은 그대로 사용
    if (name.length <= 4) return name;
    // 긴 이름은 자동생성 안함 (설정에서 수동 입력)
    return null;
};

// GET /peak/record-types - 종목 목록
router.get('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { active } = req.query;
        let query = 'SELECT * FROM record_types WHERE academy_id = ?';
        const params = [academyId];

        if (active === 'true') {
            query += ' AND is_active = 1';
        }
        query += ' ORDER BY display_order, id';

        const [types] = await db.query(query, params);
        res.json({ success: true, recordTypes: types });
    } catch (error) {
        console.error('Get record types error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/record-types - 종목 추가
router.post('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { name, unit, direction, display_order, short_name } = req.body;

        if (!name || !unit) {
            return res.status(400).json({ error: '종목명과 단위는 필수입니다.' });
        }

        // 줄임말이 없으면 자동 생성
        const finalShortName = short_name || generateShortName(name);

        const [result] = await db.query(
            'INSERT INTO record_types (academy_id, name, short_name, unit, direction, display_order) VALUES (?, ?, ?, ?, ?, ?)',
            [academyId, name, finalShortName, unit, direction || 'higher', display_order || 0]
        );

        res.status(201).json({
            success: true,
            id: result.insertId,
            short_name: finalShortName,
            message: '종목이 추가되었습니다.'
        });
    } catch (error) {
        console.error('Create record type error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/record-types/:id - 종목 수정
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { name, short_name, unit, direction, is_active, display_order } = req.body;

        // 줄임말이 없고 이름이 바뀌면 자동 생성
        let finalShortName = short_name;
        if (!short_name && name) {
            finalShortName = generateShortName(name);
        }

        const [result] = await db.query(
            'UPDATE record_types SET name = ?, short_name = ?, unit = ?, direction = ?, is_active = ?, display_order = ? WHERE id = ? AND academy_id = ?',
            [name, finalShortName, unit, direction, is_active, display_order, req.params.id, academyId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
        }

        res.json({ success: true, short_name: finalShortName });
    } catch (error) {
        console.error('Update record type error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/record-types/:id - 종목 삭제 (비활성화)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        // 실제 삭제 대신 비활성화
        const [result] = await db.query(
            'UPDATE record_types SET is_active = 0 WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '종목을 찾을 수 없습니다.' });
        }

        res.json({ success: true, message: '종목이 비활성화되었습니다.' });
    } catch (error) {
        console.error('Delete record type error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
