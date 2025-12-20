/**
 * Exercise Tags Routes (운동 태그 관리)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/exercise-tags - 태그 목록
router.get('/', async (req, res) => {
    try {
        const [tags] = await db.query(
            'SELECT * FROM exercise_tags WHERE is_active = TRUE ORDER BY display_order, id'
        );
        res.json({ success: true, tags });
    } catch (error) {
        console.error('Get tags error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/exercise-tags/all - 전체 태그 목록 (비활성 포함)
router.get('/all', async (req, res) => {
    try {
        const [tags] = await db.query(
            'SELECT * FROM exercise_tags ORDER BY display_order, id'
        );
        res.json({ success: true, tags });
    } catch (error) {
        console.error('Get all tags error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/exercise-tags - 태그 추가
router.post('/', async (req, res) => {
    try {
        const { tag_id, label, color } = req.body;

        if (!tag_id || !label) {
            return res.status(400).json({ error: 'tag_id and label are required' });
        }

        // 최대 display_order 조회
        const [maxOrder] = await db.query(
            'SELECT MAX(display_order) as max_order FROM exercise_tags'
        );
        const newOrder = (maxOrder[0].max_order || 0) + 1;

        const [result] = await db.query(
            `INSERT INTO exercise_tags (tag_id, label, color, display_order)
             VALUES (?, ?, ?, ?)`,
            [tag_id, label, color || 'bg-slate-100 text-slate-700', newOrder]
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
router.put('/:id', async (req, res) => {
    try {
        const { label, color, is_active, display_order } = req.body;

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
        await db.query(
            `UPDATE exercise_tags SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update tag error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/exercise-tags/:id - 태그 삭제 (비활성화)
router.delete('/:id', async (req, res) => {
    try {
        await db.query(
            'UPDATE exercise_tags SET is_active = FALSE WHERE id = ?',
            [req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Delete tag error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
