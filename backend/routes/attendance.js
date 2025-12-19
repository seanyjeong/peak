/**
 * Trainer Attendance Routes (출근 체크)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /maxt/attendance - 오늘 출근 현황
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const [attendance] = await db.query(`
            SELECT a.*, t.name as trainer_name
            FROM daily_attendance a
            JOIN trainers t ON a.trainer_id = t.id
            WHERE a.date = ?
            ORDER BY a.check_in_time
        `, [targetDate]);

        res.json({ success: true, date: targetDate, attendance });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /maxt/attendance/checkin - 출근 체크
router.post('/checkin', async (req, res) => {
    try {
        const { trainer_id } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0];

        // 이미 출근했는지 확인
        const [existing] = await db.query(
            'SELECT id FROM daily_attendance WHERE date = ? AND trainer_id = ?',
            [today, trainer_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Already Checked In',
                message: '오늘 이미 출근 체크했습니다.'
            });
        }

        const [result] = await db.query(
            'INSERT INTO daily_attendance (date, trainer_id, check_in_time) VALUES (?, ?, ?)',
            [today, trainer_id, now]
        );

        res.status(201).json({
            success: true,
            message: '출근 체크 완료!',
            attendanceId: result.insertId,
            checkInTime: now
        });
    } catch (error) {
        console.error('Check in error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
