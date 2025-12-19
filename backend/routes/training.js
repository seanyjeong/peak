/**
 * Training Logs Routes (훈련 기록)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/training - 훈련 기록 목록
router.get('/', async (req, res) => {
    try {
        const { date, trainer_id, student_id } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT
                l.*,
                s.name as student_name,
                t.name as trainer_name,
                p.tags, p.description as plan_description
            FROM training_logs l
            JOIN students s ON l.student_id = s.id
            JOIN trainers t ON l.trainer_id = t.id
            LEFT JOIN daily_plans p ON l.plan_id = p.id
            WHERE l.date = ?
        `;
        const params = [targetDate];

        if (trainer_id) {
            query += ' AND l.trainer_id = ?';
            params.push(trainer_id);
        }
        if (student_id) {
            query += ' AND l.student_id = ?';
            params.push(student_id);
        }

        query += ' ORDER BY l.created_at DESC';

        const [logs] = await db.query(query, params);
        res.json({ success: true, date: targetDate, logs });
    } catch (error) {
        console.error('Get training logs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/training - 훈련 기록 저장
router.post('/', async (req, res) => {
    try {
        const { date, student_id, trainer_id, plan_id, condition_score, notes } = req.body;

        const [result] = await db.query(`
            INSERT INTO training_logs
            (date, student_id, trainer_id, plan_id, condition_score, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [date, student_id, trainer_id, plan_id, condition_score, notes]);

        res.status(201).json({
            success: true,
            logId: result.insertId
        });
    } catch (error) {
        console.error('Create training log error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/training/:id - 훈련 기록 수정
router.put('/:id', async (req, res) => {
    try {
        const { condition_score, notes } = req.body;

        await db.query(
            'UPDATE training_logs SET condition_score = ?, notes = ? WHERE id = ?',
            [condition_score, notes, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update training log error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
