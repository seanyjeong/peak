/**
 * Exercise Tags Routes (운동 태그 관리)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET /peak/exercise-tags - 태그 목록 (자기 학원 + 시스템 기본 태그)
router.get('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const SYSTEM_ACADEMY_ID = 2; // 시스템 기본 태그가 있는 학원

        const [tags] = await db.query(
            `SELECT * FROM exercise_tags
             WHERE (academy_id = ? OR academy_id = ?) AND is_active = TRUE
             ORDER BY display_order, id`,
            [academyId, SYSTEM_ACADEMY_ID]
        );
        res.json({ success: true, tags });
    } catch (error) {
        console.error('Get tags error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/exercise-tags/all - 전체 태그 목록 (비활성 포함)
router.get('/all', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        const [tags] = await db.query(
            'SELECT * FROM exercise_tags WHERE academy_id = ? ORDER BY display_order, id',
            [academyId]
        );
        res.json({ success: true, tags });
    } catch (error) {
        console.error('Get all tags error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/exercise-tags - 태그 추가
router.post('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { tag_id, label, color } = req.body;

        if (!tag_id || !label) {
            return res.status(400).json({ error: 'tag_id and label are required' });
        }

        // 최대 display_order 조회 (해당 학원만)
        const [maxOrder] = await db.query(
            'SELECT MAX(display_order) as max_order FROM exercise_tags WHERE academy_id = ?',
            [academyId]
        );
        const newOrder = (maxOrder[0].max_order || 0) + 1;

        const [result] = await db.query(
            `INSERT INTO exercise_tags (academy_id, tag_id, label, color, display_order)
             VALUES (?, ?, ?, ?, ?)`,
            [academyId, tag_id, label, color || 'bg-slate-100 text-slate-700', newOrder]
        );

        res.status(201).json({
            success: true,
            tagId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Tag ID already exists' });
        }
        console.error('Create tag error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/exercise-tags/:id - 태그 수정
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { label, color, is_active, display_order } = req.body;

        // 해당 태그가 이 학원 소유인지 확인
        const [tagCheck] = await db.query(
            'SELECT id FROM exercise_tags WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );

        if (tagCheck.length === 0) {
            return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
        }

        const updates = [];
        const params = [];

        if (label !== undefined) {
            updates.push('label = ?');
            params.push(label);
        }
        if (color !== undefined) {
            updates.push('color = ?');
            params.push(color);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active);
        }
        if (display_order !== undefined) {
            updates.push('display_order = ?');
            params.push(display_order);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.params.id);
        params.push(academyId);
        await db.query(
            `UPDATE exercise_tags SET ${updates.join(', ')} WHERE id = ? AND academy_id = ?`,
            params
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update tag error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/exercise-tags/:id - 태그 삭제 (비활성화)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        const [result] = await db.query(
            'UPDATE exercise_tags SET is_active = FALSE WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete tag error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
