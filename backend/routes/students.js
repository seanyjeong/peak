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

// GET /peak/students/:id/records - 학생 기록 히스토리 (동적 종목)
router.get('/:id/records', async (req, res) => {
    try {
        const [records] = await db.query(`
            SELECT r.*, rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ?
            ORDER BY r.measured_at DESC, rt.display_order
        `, [req.params.id]);

        // 날짜별로 그룹화해서 반환
        const grouped = {};
        records.forEach(r => {
            const dateKey = r.measured_at.toISOString().split('T')[0];
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    measured_at: dateKey,
                    records: []
                };
            }
            grouped[dateKey].records.push({
                record_type_id: r.record_type_id,
                record_type_name: r.record_type_name,
                unit: r.unit,
                direction: r.direction,
                value: r.value,
                notes: r.notes
            });
        });

        res.json({
            success: true,
            records: Object.values(grouped).sort((a, b) =>
                new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
            )
        });
    } catch (error) {
        console.error('Get student records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
