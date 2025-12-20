/**
 * Daily Plans Routes (수업 계획 - P-ACA 연동)
 * P-ACA instructor_schedules에서 스케줄된 강사 조회
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');

const ACADEMY_ID = 2; // 일산맥스체대입시

// GET /peak/plans - 수업 계획 목록 (시간대별 + 스케줄된 강사)
router.get('/', async (req, res) => {
    try {
        const { date, time_slot } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // P-ACA에서 해당 날짜 스케줄된 강사 조회
        const [scheduledInstructors] = await pacaPool.query(`
            SELECT DISTINCT
                i.id,
                i.name,
                i.user_id,
                ins.time_slot
            FROM instructor_schedules ins
            JOIN instructors i ON ins.instructor_id = i.id
            WHERE ins.academy_id = ? AND ins.work_date = ?
            ORDER BY ins.time_slot, i.name
        `, [ACADEMY_ID, targetDate]);

        // 이름 복호화 및 시간대별 그룹화
        const bySlot = { morning: [], afternoon: [], evening: [] };
        scheduledInstructors.forEach(inst => {
            const decryptedName = inst.name ? decrypt(inst.name) : inst.name;
            if (bySlot[inst.time_slot]) {
                bySlot[inst.time_slot].push({
                    id: inst.id,
                    name: decryptedName,
                    user_id: inst.user_id,
                    time_slot: inst.time_slot
                });
            }
        });

        // 해당 날짜의 수업 계획 조회
        let planQuery = `SELECT * FROM daily_plans WHERE date = ?`;
        const params = [targetDate];

        if (time_slot) {
            planQuery += ' AND time_slot = ?';
            params.push(time_slot);
        }

        const [plans] = await db.query(planQuery, params);

        // 계획에 강사 이름 매칭
        const allInstructors = [...bySlot.morning, ...bySlot.afternoon, ...bySlot.evening];
        const result = plans.map(p => {
            const instructor = allInstructors.find(i => i.id === p.instructor_id);
            return {
                ...p,
                instructor_name: instructor?.name || '알 수 없음',
                tags: typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []),
                exercises: typeof p.exercises === 'string' ? JSON.parse(p.exercises) : (p.exercises || [])
            };
        });

        res.json({
            success: true,
            date: targetDate,
            slots: bySlot,
            plans: result,
            stats: {
                morning: { scheduled: bySlot.morning.length, planned: result.filter(p => p.time_slot === 'morning').length },
                afternoon: { scheduled: bySlot.afternoon.length, planned: result.filter(p => p.time_slot === 'afternoon').length },
                evening: { scheduled: bySlot.evening.length, planned: result.filter(p => p.time_slot === 'evening').length }
            }
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/plans - 수업 계획 작성
router.post('/', async (req, res) => {
    try {
        const { date, time_slot, instructor_id, tags, exercises, description } = req.body;

        // 같은 날짜, 시간대, 강사의 계획이 이미 있는지 확인
        const [existing] = await db.query(
            'SELECT id FROM daily_plans WHERE date = ? AND time_slot = ? AND instructor_id = ?',
            [date, time_slot, instructor_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Plan Already Exists',
                message: '해당 시간대에 이미 계획이 작성되어 있습니다.'
            });
        }

        const [result] = await db.query(
            `INSERT INTO daily_plans (date, time_slot, instructor_id, tags, exercises, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                date,
                time_slot,
                instructor_id,
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

// PUT /peak/plans/:id - 수업 계획 수정
router.put('/:id', async (req, res) => {
    try {
        const { tags, exercises, description } = req.body;

        await db.query(
            `UPDATE daily_plans
             SET tags = ?, exercises = ?, description = ?, updated_at = NOW()
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
