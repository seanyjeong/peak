/**
 * Student Records Routes (기록 측정 - 4대 종목)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /maxt/records - 기록 목록
router.get('/', async (req, res) => {
    try {
        const { student_id, from_date, to_date } = req.query;

        let query = `
            SELECT r.*, s.name as student_name, s.gender
            FROM student_records r
            JOIN students s ON r.student_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (student_id) {
            query += ' AND r.student_id = ?';
            params.push(student_id);
        }
        if (from_date) {
            query += ' AND r.measured_at >= ?';
            params.push(from_date);
        }
        if (to_date) {
            query += ' AND r.measured_at <= ?';
            params.push(to_date);
        }

        query += ' ORDER BY r.measured_at DESC';

        const [records] = await db.query(query, params);
        res.json({ success: true, records });
    } catch (error) {
        console.error('Get records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /maxt/records - 기록 측정 입력
router.post('/', async (req, res) => {
    try {
        const {
            student_id,
            measured_at,
            standing_jump,    // 제자리멀리뛰기 (cm)
            medicine_ball,    // 메디신볼 (m)
            shuttle_run,      // 20m왕복 (초)
            flexibility,      // 좌전굴 (cm)
            notes
        } = req.body;

        const [result] = await db.query(`
            INSERT INTO student_records
            (student_id, measured_at, standing_jump, medicine_ball, shuttle_run, flexibility, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [student_id, measured_at, standing_jump, medicine_ball, shuttle_run, flexibility, notes]);

        res.status(201).json({
            success: true,
            recordId: result.insertId
        });
    } catch (error) {
        console.error('Create record error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /maxt/records/latest - 학생별 최신 기록
router.get('/latest', async (req, res) => {
    try {
        const [records] = await db.query(`
            SELECT r.*, s.name as student_name, s.gender
            FROM student_records r
            JOIN students s ON r.student_id = s.id
            INNER JOIN (
                SELECT student_id, MAX(measured_at) as max_date
                FROM student_records
                GROUP BY student_id
            ) latest ON r.student_id = latest.student_id AND r.measured_at = latest.max_date
            ORDER BY s.name
        `);
        res.json({ success: true, records });
    } catch (error) {
        console.error('Get latest records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /maxt/records/stats/:student_id - 학생 기록 통계 (그래프용)
router.get('/stats/:student_id', async (req, res) => {
    try {
        const [records] = await db.query(`
            SELECT measured_at, standing_jump, medicine_ball, shuttle_run, flexibility
            FROM student_records
            WHERE student_id = ?
            ORDER BY measured_at ASC
        `, [req.params.student_id]);

        // 변화량 계산
        let stats = {
            records,
            improvements: {}
        };

        if (records.length >= 2) {
            const first = records[0];
            const last = records[records.length - 1];
            stats.improvements = {
                standing_jump: last.standing_jump - first.standing_jump,
                medicine_ball: last.medicine_ball - first.medicine_ball,
                shuttle_run: first.shuttle_run - last.shuttle_run, // 시간은 줄어드는게 좋음
                flexibility: last.flexibility - first.flexibility
            };
        }

        res.json({ success: true, ...stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
