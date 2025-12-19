/**
 * Record Types Routes (측정 종목 관리)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/record-types - 종목 목록
router.get('/', async (req, res) => {
    try {
        const { active } = req.query;
        let query = 'SELECT * FROM record_types';

        if (active === 'true') {
            query += ' WHERE is_active = 1';
        }
        query += ' ORDER BY display_order, id';

        const [types] = await db.query(query);
        res.json({ success: true, recordTypes: types });
    } catch (error) {
        console.error('Get record types error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/record-types - 종목 추가
router.post('/', async (req, res) => {
    try {
        const { name, unit, direction, display_order } = req.body;

        if (!name || !unit) {
            return res.status(400).json({ error: '종목명과 단위는 필수입니다.' });
        }

        const [result] = await db.query(
            'INSERT INTO record_types (name, unit, direction, display_order) VALUES (?, ?, ?, ?)',
            [name, unit, direction || 'higher', display_order || 0]
        );

        res.status(201).json({
            success: true,
            id: result.insertId,
            message: '종목이 추가되었습니다.'
        });
    } catch (error) {
        console.error('Create record type error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/record-types/:id - 종목 수정
router.put('/:id', async (req, res) => {
    try {
        const { name, unit, direction, is_active, display_order } = req.body;

        await db.query(
            'UPDATE record_types SET name = ?, unit = ?, direction = ?, is_active = ?, display_order = ? WHERE id = ?',
            [name, unit, direction, is_active, display_order, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update record type error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/record-types/:id - 종목 삭제 (비활성화)
router.delete('/:id', async (req, res) => {
    try {
        // 실제 삭제 대신 비활성화
        await db.query(
            'UPDATE record_types SET is_active = 0 WHERE id = ?',
            [req.params.id]
        );

        res.json({ success: true, message: '종목이 비활성화되었습니다.' });
    } catch (error) {
        console.error('Delete record type error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
