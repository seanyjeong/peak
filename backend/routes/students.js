/**
 * Students Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/students - 학생 목록
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT * FROM students';
        const params = [];

        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }
        query += ' ORDER BY name';

        const [students] = await db.query(query, params);
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students/:id - 학생 상세
router.get('/:id', async (req, res) => {
    try {
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [req.params.id]
        );
        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found' });
        }
        res.json({ success: true, student: students[0] });
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students/:id/records - 학생 기록 히스토리
router.get('/:id/records', async (req, res) => {
    try {
        const [records] = await db.query(
            'SELECT * FROM student_records WHERE student_id = ? ORDER BY measured_at DESC',
            [req.params.id]
        );
        res.json({ success: true, records });
    } catch (error) {
        console.error('Get student records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
