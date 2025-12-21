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
                exercises: typeof p.exercises === 'string' ? JSON.parse(p.exercises) : (p.exercises || []),
                completed_exercises: typeof p.completed_exercises === 'string' ? JSON.parse(p.completed_exercises) : (p.completed_exercises || []),
                extra_exercises: typeof p.extra_exercises === 'string' ? JSON.parse(p.extra_exercises) : (p.extra_exercises || []),
                exercise_times: typeof p.exercise_times === 'string' ? JSON.parse(p.exercise_times) : (p.exercise_times || {})
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

        // trainer_id는 요청한 사용자의 instructor_id 사용
        const trainer_id = req.user?.instructorId || instructor_id;

        const [result] = await db.query(
            `INSERT INTO daily_plans (date, time_slot, trainer_id, instructor_id, tags, exercises, description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                date,
                time_slot,
                trainer_id,
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

// PUT /peak/plans/:id/toggle-exercise - 운동 완료 토글
router.put('/:id/toggle-exercise', async (req, res) => {
    try {
        const { exercise_id } = req.body;
        const planId = req.params.id;

        // 현재 completed_exercises, exercise_times 조회
        const [plans] = await db.query('SELECT completed_exercises, exercise_times FROM daily_plans WHERE id = ?', [planId]);
        if (plans.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        let completed = plans[0].completed_exercises || [];
        if (typeof completed === 'string') completed = JSON.parse(completed);

        let times = plans[0].exercise_times || {};
        if (typeof times === 'string') times = JSON.parse(times);

        // 토글
        const idx = completed.indexOf(exercise_id);
        if (idx > -1) {
            completed.splice(idx, 1); // 이미 있으면 제거
            delete times[exercise_id]; // 시간도 제거
        } else {
            completed.push(exercise_id); // 없으면 추가
            times[exercise_id] = new Date(); // 완료 시간 기록
        }

        await db.query('UPDATE daily_plans SET completed_exercises = ?, exercise_times = ? WHERE id = ?',
            [JSON.stringify(completed), JSON.stringify(times), planId]);

        res.json({ success: true, completed_exercises: completed, exercise_times: times });
    } catch (error) {
        console.error('Toggle exercise error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/plans/:id/extra-exercise - 추가 운동 등록
router.post('/:id/extra-exercise', async (req, res) => {
    try {
        const { exercise_id, name, note } = req.body;
        const planId = req.params.id;

        const [plans] = await db.query('SELECT extra_exercises FROM daily_plans WHERE id = ?', [planId]);
        if (plans.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        let extras = plans[0].extra_exercises || [];
        if (typeof extras === 'string') extras = JSON.parse(extras);

        // 추가 (completed: false로 시작)
        extras.push({ exercise_id, name, note: note || '', completed: false });

        await db.query('UPDATE daily_plans SET extra_exercises = ? WHERE id = ?', [JSON.stringify(extras), planId]);

        res.json({ success: true, extra_exercises: extras });
    } catch (error) {
        console.error('Add extra exercise error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/plans/:id/toggle-extra - 추가 운동 완료 토글
router.put('/:id/toggle-extra', async (req, res) => {
    try {
        const { index } = req.body; // 배열 인덱스
        const planId = req.params.id;

        const [plans] = await db.query('SELECT extra_exercises FROM daily_plans WHERE id = ?', [planId]);
        if (plans.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        let extras = plans[0].extra_exercises || [];
        if (typeof extras === 'string') extras = JSON.parse(extras);

        if (extras[index]) {
            extras[index].completed = !extras[index].completed;
        }

        await db.query('UPDATE daily_plans SET extra_exercises = ? WHERE id = ?', [JSON.stringify(extras), planId]);

        res.json({ success: true, extra_exercises: extras });
    } catch (error) {
        console.error('Toggle extra exercise error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/plans/:id/conditions - 온습도 저장
router.put('/:id/conditions', async (req, res) => {
    try {
        const { temperature, humidity, checked } = req.body;
        const planId = req.params.id;

        // checked가 true면 현재 시간(KST) 저장, false면 null
        const checkedAt = checked ? new Date() : null;

        await db.query(
            'UPDATE daily_plans SET temperature = ?, humidity = ?, conditions_checked = ?, conditions_checked_at = ? WHERE id = ?',
            [temperature ?? null, humidity ?? null, checked ? 1 : 0, checkedAt, planId]
        );

        res.json({ success: true, checked_at: checkedAt });
    } catch (error) {
        console.error('Update conditions error:', error);
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
