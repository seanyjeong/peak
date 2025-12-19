/**
 * Daily Assignments Routes (반 배치 - 핵심 기능!)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/assignments - 오늘 반 배치 현황
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // 트레이너별 배치된 학생 목록
        const [assignments] = await db.query(`
            SELECT
                a.*,
                s.name as student_name,
                s.gender,
                t.name as trainer_name
            FROM daily_assignments a
            JOIN students s ON a.student_id = s.id
            LEFT JOIN trainers t ON a.trainer_id = t.id
            WHERE a.date = ?
            ORDER BY a.trainer_id, a.order_num
        `, [targetDate]);

        // 트레이너별로 그룹화
        const grouped = {};
        assignments.forEach(a => {
            const key = a.trainer_id || 'unassigned';
            if (!grouped[key]) {
                grouped[key] = {
                    trainer_id: a.trainer_id,
                    trainer_name: a.trainer_name || '미배정',
                    students: []
                };
            }
            grouped[key].students.push({
                id: a.id,
                student_id: a.student_id,
                student_name: a.student_name,
                gender: a.gender,
                status: a.status,
                order_num: a.order_num
            });
        });

        res.json({
            success: true,
            date: targetDate,
            assignments: Object.values(grouped)
        });
    } catch (error) {
        console.error('Get assignments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/assignments/init - 오늘 날짜로 학생 배치 초기화
router.post('/init', async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // 이미 초기화되었는지 확인
        const [existing] = await db.query(
            'SELECT COUNT(*) as count FROM daily_assignments WHERE date = ?',
            [targetDate]
        );

        if (existing[0].count > 0) {
            return res.json({
                success: true,
                message: '이미 초기화됨',
                initialized: false
            });
        }

        // 활성 학생 목록으로 초기화 (미배정 상태로)
        const [students] = await db.query(
            'SELECT id FROM students WHERE status = "active"'
        );

        for (const s of students) {
            await db.query(
                'INSERT INTO daily_assignments (date, student_id, trainer_id, status, order_num) VALUES (?, ?, NULL, "training", 0)',
                [targetDate, s.id]
            );
        }

        res.json({
            success: true,
            message: `${students.length}명 학생 초기화 완료`,
            initialized: true,
            count: students.length
        });
    } catch (error) {
        console.error('Init assignments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/assignments/:id - 반 배치 변경 (드래그앤드롭)
router.put('/:id', async (req, res) => {
    try {
        const { trainer_id, status, order_num } = req.body;

        await db.query(
            'UPDATE daily_assignments SET trainer_id = ?, status = ?, order_num = ? WHERE id = ?',
            [trainer_id, status, order_num, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update assignment error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/assignments/batch - 일괄 업데이트 (드래그앤드롭 후)
router.put('/batch', async (req, res) => {
    try {
        const { assignments } = req.body;
        // assignments: [{ id, trainer_id, order_num }, ...]

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            for (const a of assignments) {
                await connection.query(
                    'UPDATE daily_assignments SET trainer_id = ?, order_num = ? WHERE id = ?',
                    [a.trainer_id, a.order_num, a.id]
                );
            }
            await connection.commit();
            res.json({ success: true, updated: assignments.length });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Batch update error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
