/**
 * Trainer Attendance Routes (출근 체크 - P-ACA 연동)
 * P-ACA의 instructor_schedules에서 출근 현황 가져오기
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');

// GET /peak/attendance - P-ACA에서 오늘 강사 출근 현황
router.get('/', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;  // 토큰에서 학원 ID 가져오기

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
        `, [academyId, targetDate]);

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

        // 전체 통계 (고유 강사 기준)
        const allInstructors = [...bySlot.morning, ...bySlot.afternoon, ...bySlot.evening];
        const uniqueIds = new Set(allInstructors.map(i => i.id));
        const presentIds = new Set(
            allInstructors.filter(i => i.attendance_status === 'present').map(i => i.id)
        );

        res.json({
            success: true,
            date: targetDate,
            slots: bySlot,
            stats: {
                total: allInstructors.length,
                checkedIn: presentIds.size,  // 고유 강사 중 출근한 수
                uniqueInstructors: uniqueIds.size
            }
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/attendance/current - 현재 시간대 강사 현황
router.get('/current', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentHour = now.getHours();

        // 현재 시간대 판단 (기본값 사용, 추후 academy_settings에서 가져올 수 있음)
        let currentSlot;
        if (currentHour < 12) {
            currentSlot = 'morning';
        } else if (currentHour < 18) {
            currentSlot = 'afternoon';
        } else {
            currentSlot = 'evening';
        }

        const slotLabels = {
            morning: '오전반',
            afternoon: '오후반',
            evening: '저녁반'
        };

        // P-ACA에서 해당 시간대 스케줄된 강사 조회
        const [scheduledInstructors] = await pacaPool.query(`
            SELECT
                i.id,
                i.name,
                ins.time_slot,
                ia.check_in_time
            FROM instructor_schedules ins
            JOIN instructors i ON ins.instructor_id = i.id
            LEFT JOIN instructor_attendance ia
                ON ia.instructor_id = ins.instructor_id
                AND ia.work_date = ins.work_date
                AND ia.time_slot = ins.time_slot
            WHERE ins.academy_id = ?
              AND ins.work_date = ?
              AND ins.time_slot = ?
            ORDER BY i.name
        `, [academyId, today, currentSlot]);

        // 이름 복호화 및 출근 여부 판단
        const instructors = scheduledInstructors.map(inst => ({
            id: inst.id,
            name: inst.name ? decrypt(inst.name) : inst.name,
            checkedIn: !!inst.check_in_time,
            checkInTime: inst.check_in_time
        }));

        const checkedInCount = instructors.filter(i => i.checkedIn).length;

        res.json({
            success: true,
            currentSlot,
            currentSlotLabel: slotLabels[currentSlot],
            date: today,
            instructors,
            stats: {
                scheduled: instructors.length,
                checkedIn: checkedInCount,
                notCheckedIn: instructors.length - checkedInCount
            }
        });
    } catch (error) {
        console.error('Get current attendance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/attendance/checkin - 출근 체크
router.post('/checkin', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { trainer_id } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0];

        // 권한 체크: 본인 또는 원장/관리자만 대리 체크 가능
        const requesterId = req.user.instructorId;
        const isAdminOrOwner = req.user.role === 'admin' || req.user.role === 'owner';

        if (parseInt(trainer_id) !== requesterId && !isAdminOrOwner) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '본인 또는 원장/관리자만 출근 체크 가능합니다.'
            });
        }

        // 이미 출근했는지 확인 (해당 학원만)
        const [existing] = await db.query(
            'SELECT id FROM daily_attendance WHERE academy_id = ? AND date = ? AND trainer_id = ?',
            [academyId, today, trainer_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Already Checked In',
                message: '오늘 이미 출근 체크했습니다.'
            });
        }

        const [result] = await db.query(
            'INSERT INTO daily_attendance (academy_id, date, trainer_id, check_in_time) VALUES (?, ?, ?, ?)',
            [academyId, today, trainer_id, now]
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
