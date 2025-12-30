/**
 * Training Logs Routes (훈련 기록)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET /peak/training - 훈련 기록 목록
// 원장(owner)은 모든 강사의 기록 조회 가능
router.get('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const userRole = req.user.role;
        const { date, trainer_id, student_id } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // trainer_id는 P-ACA instructor_id 직접 사용 (trainers 테이블 사용 안함)
        let query = `
            SELECT
                l.*,
                s.name as student_name,
                s.gender as student_gender,
                s.is_trial,
                s.trial_total,
                s.trial_remaining,
                p.tags, p.description as plan_description, p.time_slot
            FROM training_logs l
            JOIN students s ON l.student_id = s.id
            LEFT JOIN daily_plans p ON l.plan_id = p.id
            WHERE l.academy_id = ? AND l.date = ?
        `;
        const params = [academyId, targetDate];

        // 원장(owner)은 trainer_id 필터 무시 - 모든 강사 기록 조회 가능
        if (trainer_id && userRole !== 'owner') {
            query += ' AND l.trainer_id = ?';
            params.push(trainer_id);
        } else if (trainer_id && userRole === 'owner') {
            // 원장이 특정 강사 조회를 원할 경우에만 필터 적용
            query += ' AND l.trainer_id = ?';
            params.push(trainer_id);
        }
        if (student_id) {
            query += ' AND l.student_id = ?';
            params.push(student_id);
        }

        query += ' ORDER BY l.created_at DESC';

        const [logs] = await db.query(query, params);
        res.json({
            success: true,
            date: targetDate,
            logs,
            isOwner: userRole === 'owner'  // 프론트엔드에서 활용
        });
    } catch (error) {
        console.error('Get training logs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/training - 훈련 기록 저장
router.post('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { date, student_id, trainer_id, plan_id, condition_score, notes, temperature, humidity } = req.body;

        const [result] = await db.query(`
            INSERT INTO training_logs
            (academy_id, date, student_id, trainer_id, plan_id, condition_score, notes, temperature, humidity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [academyId, date, student_id, trainer_id, plan_id, condition_score, notes, temperature || null, humidity || null]);

        res.status(201).json({
            success: true,
            logId: result.insertId
        });
    } catch (error) {
        console.error('Create training log error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/training/conditions/:date - 해당 날짜 전체 온습도 일괄 업데이트
// 주의: /:id 보다 먼저 정의해야 함 (Express 라우트 순서)
router.put('/conditions/:date', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { date } = req.params;
        const { temperature, humidity, time_slot, trainer_id } = req.body;

        let query = 'UPDATE training_logs SET temperature = ?, humidity = ? WHERE date = ? AND academy_id = ?';
        const params = [temperature ?? null, humidity ?? null, date, academyId];

        // time_slot이 있으면 해당 시간대만
        if (time_slot) {
            // daily_plans와 조인해서 해당 시간대 기록만 업데이트
            query = `
                UPDATE training_logs l
                JOIN daily_plans p ON l.plan_id = p.id
                SET l.temperature = ?, l.humidity = ?
                WHERE l.date = ? AND l.academy_id = ? AND p.time_slot = ?
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

// PUT /peak/training/:id - 훈련 기록 수정
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { condition_score, notes, temperature, humidity } = req.body;

        await db.query(
            'UPDATE training_logs SET condition_score = ?, notes = ?, temperature = ?, humidity = ? WHERE id = ? AND academy_id = ?',
            [condition_score, notes, temperature ?? null, humidity ?? null, req.params.id, academyId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update training log error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
