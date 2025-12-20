/**
 * Trainer Attendance Routes (출근 체크 - P-ACA 연동)
 * P-ACA의 instructor_schedules에서 출근 현황 가져오기
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');

const ACADEMY_ID = 2; // 일산맥스체대입시

// GET /peak/attendance - P-ACA에서 오늘 강사 출근 현황
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // P-ACA에서 강사 스케줄 + 출결 조회 (instructor_schedules + instructor_attendance JOIN)
        const [instructors] = await pacaPool.query(`
            SELECT
                i.id,
                i.name,
                ins.time_slot,
                COALESCE(ia.attendance_status, 'scheduled') as attendance_status,
                ia.check_in_time,
                ia.check_out_time
            FROM instructor_schedules ins
            JOIN instructors i ON ins.instructor_id = i.id
            LEFT JOIN instructor_attendance ia
                ON ia.instructor_id = ins.instructor_id
                AND ia.work_date = ins.work_date
                AND ia.time_slot = ins.time_slot
            WHERE ins.academy_id = ? AND ins.work_date = ?
            ORDER BY ins.time_slot, i.name
        `, [ACADEMY_ID, targetDate]);

        // 이름 복호화 및 시간대별 그룹화
        const bySlot = { morning: [], afternoon: [], evening: [] };
        instructors.forEach(inst => {
            const decryptedName = inst.name ? decrypt(inst.name) : inst.name;
            if (bySlot[inst.time_slot]) {
                bySlot[inst.time_slot].push({
                    id: inst.id,
                    name: decryptedName,
                    time_slot: inst.time_slot,
                    attendance_status: inst.attendance_status || 'scheduled',
                    check_in_time: inst.check_in_time,
                    check_out_time: inst.check_out_time
                });
            }
        });

        // 전체 통계
        const allInstructors = [...bySlot.morning, ...bySlot.afternoon, ...bySlot.evening];
        const checkedIn = allInstructors.filter(i => i.attendance_status === 'present').length;

        res.json({
            success: true,
            date: targetDate,
            slots: bySlot,
            stats: {
                total: allInstructors.length,
                checkedIn,
                uniqueInstructors: new Set(allInstructors.map(i => i.id)).size
            }
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/attendance/checkin - 출근 체크
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
