/**
 * Exercises Routes (운동 라이브러리)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/exercises - 운동 목록 (태그 필터 가능)
router.get('/', async (req, res) => {
    try {
        const { tag } = req.query;

        let query = 'SELECT * FROM exercises ORDER BY name';
        let params = [];

        if (tag) {
            // JSON 배열에서 태그 검색
            query = `SELECT * FROM exercises WHERE JSON_CONTAINS(tags, ?) ORDER BY name`;
            params = [JSON.stringify(tag)];
        }

        const [exercises] = await db.query(query, params);

        // tags를 파싱해서 반환
        const result = exercises.map(ex => ({
            ...ex,
            tags: typeof ex.tags === 'string' ? JSON.parse(ex.tags) : ex.tags
        }));

        res.json({ success: true, exercises: result });
    } catch (error) {
        console.error('Get exercises error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/exercises/:id - 운동 상세
router.get('/:id', async (req, res) => {
    try {
        const [exercises] = await db.query(
            'SELECT * FROM exercises WHERE id = ?',
            [req.params.id]
        );

        if (exercises.length === 0) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        const exercise = exercises[0];
        exercise.tags = typeof exercise.tags === 'string'
            ? JSON.parse(exercise.tags)
            : exercise.tags;

        res.json({ success: true, exercise });
    } catch (error) {
        console.error('Get exercise error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/exercises - 운동 추가
router.post('/', async (req, res) => {
    try {
        const { name, tags = [], default_sets, default_reps, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const [result] = await db.query(
            `INSERT INTO exercises (name, tags, default_sets, default_reps, description)
             VALUES (?, ?, ?, ?, ?)`,
            [name, JSON.stringify(tags), default_sets || null, default_reps || null, description || null]
        );

        res.status(201).json({
            success: true,
            exerciseId: result.insertId
        });
    } catch (error) {
        console.error('Create exercise error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/exercises/:id - 운동 수정
router.put('/:id', async (req, res) => {
    try {
        const { name, tags, default_sets, default_reps, description } = req.body;

        await db.query(
            `UPDATE exercises
             SET name = ?, tags = ?, default_sets = ?, default_reps = ?, description = ?
             WHERE id = ?`,
            [name, JSON.stringify(tags), default_sets || null, default_reps || null, description || null, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update exercise error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/exercises/:id - 운동 삭제
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM exercises WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete exercise error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
