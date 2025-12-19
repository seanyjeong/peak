/**
 * Daily Plans Routes (훈련 계획)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/plans - 훈련 계획 목록
router.get('/', async (req, res) => {
    try {
        const { date, trainer_id } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT p.*, t.name as trainer_name
            FROM daily_plans p
            JOIN trainers t ON p.trainer_id = t.id
            WHERE p.date = ?
        `;
        const params = [targetDate];

        if (trainer_id) {
            query += ' AND p.trainer_id = ?';
            params.push(trainer_id);
        }

        const [plans] = await db.query(query, params);

        // Parse JSON fields
        const result = plans.map(p => ({
            ...p,
            tags: typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []),
            exercises: typeof p.exercises === 'string' ? JSON.parse(p.exercises) : (p.exercises || [])
        }));

        res.json({ success: true, date: targetDate, plans: result });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/plans - 훈련 계획 작성
router.post('/', async (req, res) => {
    try {
        const { date, trainer_id, tags, exercises, description } = req.body;

        const [result] = await db.query(
            `INSERT INTO daily_plans (date, trainer_id, tags, exercises, description)
             VALUES (?, ?, ?, ?, ?)`,
            [
                date,
                trainer_id,
                JSON.stringify(tags || []),
                JSON.stringify(exercises || []),
                description || null
            ]
        );

        res.status(201).json({
            success: true,
            planId: result.insertId
        });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/plans/:id - 훈련 계획 수정
router.put('/:id', async (req, res) => {
    try {
        const { tags, exercises, description } = req.body;

        await db.query(
            `UPDATE daily_plans
             SET tags = ?, exercises = ?, description = ?
             WHERE id = ?`,
            [
                JSON.stringify(tags || []),
                JSON.stringify(exercises || []),
                description || null,
                req.params.id
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/plans/:id - 훈련 계획 삭제
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM daily_plans WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
