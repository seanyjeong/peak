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
        const { date, student_id, trainer_id, plan_id, condition_score, notes, temperature, humidity } = req.body;

        const [result] = await db.query(`
            INSERT INTO training_logs
            (date, student_id, trainer_id, plan_id, condition_score, notes, temperature, humidity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [date, student_id, trainer_id, plan_id, condition_score, notes, temperature || null, humidity || null]);

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
        const { condition_score, notes, temperature, humidity } = req.body;

        await db.query(
            'UPDATE training_logs SET condition_score = ?, notes = ?, temperature = ?, humidity = ? WHERE id = ?',
            [condition_score, notes, temperature ?? null, humidity ?? null, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update training log error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/training/conditions/:date - 해당 날짜 전체 온습도 일괄 업데이트
router.put('/conditions/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { temperature, humidity, time_slot, trainer_id } = req.body;

        let query = 'UPDATE training_logs SET temperature = ?, humidity = ? WHERE date = ?';
        const params = [temperature ?? null, humidity ?? null, date];

        // time_slot이 있으면 해당 시간대만
        if (time_slot) {
            // daily_plans와 조인해서 해당 시간대 기록만 업데이트
            query = `
                UPDATE training_logs l
                JOIN daily_plans p ON l.plan_id = p.id
                SET l.temperature = ?, l.humidity = ?
                WHERE l.date = ? AND p.time_slot = ?
            `;
            params.push(time_slot);
        }

        // trainer_id가 있으면 해당 강사만
        if (trainer_id && !time_slot) {
            query += ' AND trainer_id = ?';
            params.push(trainer_id);
        }

        const [result] = await db.query(query, params);

        res.json({
            success: true,
            updated: result.affectedRows,
            message: `${result.affectedRows}개 기록 온습도 업데이트`
        });
    } catch (error) {
        console.error('Update conditions error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
