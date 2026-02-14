/**
 * Attendance Routes (출근 체크 + 학생 출석 체크 - P-ACA 연동)
 * - 강사 출근: P-ACA instructor_schedules에서 조회
 * - 학생 출석: P-ACA attendance 테이블에 직접 쓰기
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');

// ==========================================
// 강사 출근 (기존)
// ==========================================

// GET /peak/attendance - P-ACA에서 오늘 강사 출근 현황
router.get('/', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;

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
                checkedIn: presentIds.size,
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

        let currentSlot;
        if (currentHour < 12) currentSlot = 'morning';
        else if (currentHour < 18) currentSlot = 'afternoon';
        else currentSlot = 'evening';

        const slotLabels = { morning: '오전반', afternoon: '오후반', evening: '저녁반' };

        const [scheduledInstructors] = await pacaPool.query(`
            SELECT
                i.id,
                i.name,
                ins.time_slot,
                ia.attendance_status,
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

        const instructors = scheduledInstructors.map(inst => ({
            id: inst.id,
            name: inst.name ? decrypt(inst.name) : inst.name,
            checkedIn: inst.attendance_status === 'present' || inst.attendance_status === 'late',
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

// POST /peak/attendance/checkin - 강사 출근 체크
router.post('/checkin', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { trainer_id } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0];

        const requesterId = req.user.instructorId;
        const isAdminOrOwner = req.user.role === 'admin' || req.user.role === 'owner';

        if (parseInt(trainer_id) !== requesterId && !isAdminOrOwner) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '본인 또는 원장/관리자만 출근 체크 가능합니다.'
            });
        }

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

// ==========================================
// 학생 출석 체크 (신규)
// ==========================================

// GET /peak/attendance/students - 학생 출석 현황 (시간대별)
router.get('/students', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;

        // Peak daily_assignments에서 학생 조회 + Paca attendance 상태
        const [assignments] = await db.query(`
            SELECT
                da.id as assignment_id,
                da.student_id,
                da.time_slot,
                da.class_id,
                da.paca_attendance_id,
                da.is_trial,
                da.status,
                s.name as student_name,
                s.gender,
                s.school,
                s.grade,
                s.paca_student_id
            FROM daily_assignments da
            JOIN students s ON da.student_id = s.id
            WHERE da.academy_id = ? AND da.date = ?
            ORDER BY da.time_slot, s.name
        `, [academyId, targetDate]);

        if (assignments.length === 0) {
            return res.json({
                success: true,
                date: targetDate,
                slots: { morning: [], afternoon: [], evening: [] },
                stats: { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
            });
        }

        // Paca에서 출석 상태 조회 (paca_attendance_id로)
        const pacaAttIds = assignments
            .filter(a => a.paca_attendance_id)
            .map(a => a.paca_attendance_id);

        let attendanceMap = {};
        if (pacaAttIds.length > 0) {
            const [pacaRecords] = await pacaPool.query(
                'SELECT id, attendance_status, notes FROM attendance WHERE id IN (?)',
                [pacaAttIds]
            );
            pacaRecords.forEach(r => {
                attendanceMap[r.id] = {
                    attendance_status: r.attendance_status,
                    notes: r.notes
                };
            });
        }

        // 시간대별 그룹화
        const bySlot = { morning: [], afternoon: [], evening: [] };
        assignments.forEach(a => {
            const pacaAtt = attendanceMap[a.paca_attendance_id] || {};
            if (bySlot[a.time_slot]) {
                bySlot[a.time_slot].push({
                    assignment_id: a.assignment_id,
                    student_id: a.student_id,
                    student_name: a.student_name,
                    gender: a.gender,
                    school: a.school,
                    grade: a.grade,
                    class_id: a.class_id,
                    is_trial: a.is_trial,
                    paca_attendance_id: a.paca_attendance_id,
                    attendance_status: pacaAtt.attendance_status || null,
                    notes: pacaAtt.notes || null
                });
            }
        });

        // 통계
        const allStudents = [...bySlot.morning, ...bySlot.afternoon, ...bySlot.evening];
        const stats = {
            total: allStudents.length,
            present: allStudents.filter(s => s.attendance_status === 'present').length,
            absent: allStudents.filter(s => s.attendance_status === 'absent').length,
            late: allStudents.filter(s => s.attendance_status === 'late').length,
            excused: allStudents.filter(s => s.attendance_status === 'excused').length,
            unchecked: allStudents.filter(s => !s.attendance_status).length
        };

        res.json({
            success: true,
            date: targetDate,
            slots: bySlot,
            stats
        });
    } catch (error) {
        console.error('Get student attendance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/attendance/student - 개별 학생 출석 체크 (Paca에 직접 쓰기)
router.post('/student', verifyToken, async (req, res) => {
    try {
        const { paca_attendance_id, attendance_status } = req.body;

        if (!paca_attendance_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'paca_attendance_id가 필요합니다. 먼저 출석 동기화를 실행하세요.'
            });
        }

        const validStatuses = ['present', 'absent', 'late', 'excused'];
        if (!validStatuses.includes(attendance_status)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `유효한 상태: ${validStatuses.join(', ')}`
            });
        }

        // Paca attendance 테이블 직접 UPDATE
        const [result] = await pacaPool.query(
            'UPDATE attendance SET attendance_status = ? WHERE id = ?',
            [attendance_status, paca_attendance_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '해당 출석 레코드를 찾을 수 없습니다.'
            });
        }

        // Socket.io로 브로드캐스트
        const io = req.app.get('io');
        if (io) {
            const academyId = req.user.academyId;
            io.to(`academy-${academyId}`).emit('student-attendance-updated', {
                paca_attendance_id,
                attendance_status
            });
        }

        res.json({
            success: true,
            message: `출석 상태를 '${attendance_status}'로 변경했습니다.`,
            paca_attendance_id,
            attendance_status
        });
    } catch (error) {
        console.error('Update student attendance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/attendance/student/batch - 일괄 출석 체크
router.post('/student/batch', verifyToken, async (req, res) => {
    try {
        const { updates } = req.body;
        // updates: [{ paca_attendance_id, attendance_status }]

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'updates 배열이 필요합니다.'
            });
        }

        const validStatuses = ['present', 'absent', 'late', 'excused'];
        let successCount = 0;

        for (const update of updates) {
            if (!update.paca_attendance_id || !validStatuses.includes(update.attendance_status)) {
                continue;
            }
            const [result] = await pacaPool.query(
                'UPDATE attendance SET attendance_status = ? WHERE id = ?',
                [update.attendance_status, update.paca_attendance_id]
            );
            if (result.affectedRows > 0) successCount++;
        }

        // Socket.io 브로드캐스트
        const io = req.app.get('io');
        if (io) {
            const academyId = req.user.academyId;
            io.to(`academy-${academyId}`).emit('student-attendance-batch-updated', {
                count: successCount
            });
        }

        res.json({
            success: true,
            message: `${successCount}명의 출석 상태를 변경했습니다.`,
            updated: successCount,
            total: updates.length
        });
    } catch (error) {
        console.error('Batch update student attendance error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
