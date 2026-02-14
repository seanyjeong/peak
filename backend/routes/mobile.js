/**
 * Mobile API Routes (강사용 모바일 전용)
 * - 내 수업 한방 조회
 * - 주간/월간 통계
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { decryptStudentFields } = require('../utils/paca-student');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');

// GET /peak/mobile/my-class - 내 수업 한방 조회
// 강사 기준: 오늘 내가 배치된 반 + 학생 + 출석 + 수업계획
router.get('/my-class', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;
        const userId = req.user.id;
        const instructorId = req.user.instructorId;
        const isOwnerOrAdmin = req.user.role === 'owner' || req.user.role === 'admin';

        // 원장/관리자: 모든 반, 강사: 내 반만
        let classFilter = '';
        const classParams = [academyId, targetDate];

        if (!isOwnerOrAdmin && instructorId) {
            classFilter = 'AND ci.instructor_id = ?';
            classParams.push(instructorId);
        } else if (!isOwnerOrAdmin) {
            // instructor_id 없는 경우 owner의 음수 ID 체크
            classFilter = 'AND ci.instructor_id = ?';
            classParams.push(-userId);
        }

        // 내가 배치된 반 + 강사 조회
        const [myClasses] = await db.query(`
            SELECT ci.time_slot, ci.class_num, ci.instructor_id, ci.is_main
            FROM class_instructors ci
            WHERE ci.academy_id = ? AND ci.date = ? ${classFilter}
            ORDER BY ci.time_slot, ci.class_num
        `, classParams);

        // 시간대별 결과 구성
        const result = { morning: null, afternoon: null, evening: null };

        if (myClasses.length === 0 && !isOwnerOrAdmin) {
            return res.json({
                success: true,
                date: targetDate,
                slots: result,
                hasClass: false
            });
        }

        // 배치된 시간대/반 번호 수집
        const slotClassMap = {};
        myClasses.forEach(mc => {
            if (!slotClassMap[mc.time_slot]) slotClassMap[mc.time_slot] = new Set();
            slotClassMap[mc.time_slot].add(mc.class_num);
        });

        // 해당 날짜 전체 학생 배치 조회
        const [allAssignments] = await db.query(`
            SELECT
                da.id as assignment_id, da.student_id, da.time_slot,
                da.class_id, da.paca_attendance_id, da.is_trial,
                da.trial_total, da.trial_remaining, da.status,
                ps.name as student_name, ps.gender, ps.school, ps.grade, s.paca_student_id
            FROM daily_assignments da
            JOIN students s ON da.student_id = s.id
            JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
            WHERE da.academy_id = ? AND da.date = ?
            ORDER BY da.time_slot, ps.name
        `, [academyId, academyId, targetDate]);

        // Decrypt student names + convert gender
        allAssignments.forEach(a => {
            if (a.student_name) a.student_name = decrypt(a.student_name);
            if (a.gender === 'male') a.gender = 'M';
            else if (a.gender === 'female') a.gender = 'F';
        });

        // Paca 출석 상태 조회
        const pacaAttIds = allAssignments.filter(a => a.paca_attendance_id).map(a => a.paca_attendance_id);
        let attendanceMap = {};
        if (pacaAttIds.length > 0) {
            const [pacaRecords] = await pacaPool.query(
                'SELECT id, attendance_status, notes FROM attendance WHERE id IN (?)',
                [pacaAttIds]
            );
            pacaRecords.forEach(r => {
                attendanceMap[r.id] = { status: r.attendance_status, notes: r.notes };
            });
        }

        // 수업 계획 조회
        const [plans] = await db.query(`
            SELECT id, time_slot, exercises, completed_exercises, extra_exercises,
                   exercise_times, temperature, humidity, conditions_checked, description
            FROM daily_plans
            WHERE academy_id = ? AND date = ?
        `, [academyId, targetDate]);

        const plansBySlot = {};
        plans.forEach(p => {
            if (!plansBySlot[p.time_slot]) plansBySlot[p.time_slot] = [];
            const exercises = typeof p.exercises === 'string' ? JSON.parse(p.exercises) : (p.exercises || []);
            const completedExercises = typeof p.completed_exercises === 'string' ? JSON.parse(p.completed_exercises) : (p.completed_exercises || []);
            plansBySlot[p.time_slot].push({
                id: p.id,
                exercises,
                completedExercises,
                temperature: p.temperature,
                humidity: p.humidity,
                conditionsChecked: p.conditions_checked,
                description: p.description
            });
        });

        // 시간대별 구성
        for (const slot of ['morning', 'afternoon', 'evening']) {
            const slotAssignments = allAssignments.filter(a => a.time_slot === slot);
            if (slotAssignments.length === 0 && !plansBySlot[slot]) continue;

            // 내 반 학생만 필터 (원장은 전체)
            let students;
            if (isOwnerOrAdmin) {
                students = slotAssignments;
            } else {
                const myClassNums = slotClassMap[slot] || new Set();
                students = slotAssignments.filter(a => myClassNums.has(a.class_id));
            }

            const studentList = students.map(s => {
                const att = attendanceMap[s.paca_attendance_id] || {};
                return {
                    student_id: s.student_id,
                    name: s.student_name,
                    gender: s.gender,
                    school: s.school,
                    grade: s.grade,
                    class_id: s.class_id,
                    is_trial: s.is_trial,
                    attendance_status: att.status || null,
                    attendance_notes: att.notes || null
                };
            });

            const presentCount = studentList.filter(s => s.attendance_status === 'present').length;
            const absentCount = studentList.filter(s => s.attendance_status === 'absent').length;
            const lateCount = studentList.filter(s => s.attendance_status === 'late').length;

            result[slot] = {
                students: studentList,
                plan: plansBySlot[slot] || [],
                stats: {
                    total: studentList.length,
                    present: presentCount,
                    absent: absentCount,
                    late: lateCount
                }
            };
        }

        res.json({
            success: true,
            date: targetDate,
            slots: result,
            hasClass: true,
            isOwner: isOwnerOrAdmin
        });
    } catch (error) {
        console.error('Mobile my-class error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/mobile/stats - 주간/월간 통계
router.get('/stats', async (req, res) => {
    try {
        const { period } = req.query; // 'week' or 'month'
        const academyId = req.user.academyId;
        const instructorId = req.user.instructorId;
        const isOwnerOrAdmin = req.user.role === 'owner' || req.user.role === 'admin';

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 기간 계산
        let startDate;
        if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        } else {
            // 이번 주 월요일
            const dayOfWeek = today.getDay();
            const monday = new Date(today);
            monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            startDate = monday.toISOString().split('T')[0];
        }

        // 1. 출석 통계 (Paca에서 조회)
        const [attendanceStats] = await pacaPool.query(`
            SELECT
                a.attendance_status,
                COUNT(*) as count
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            WHERE cs.academy_id = ?
              AND cs.class_date BETWEEN ? AND ?
            GROUP BY a.attendance_status
        `, [academyId, startDate, todayStr]);

        const attStats = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
        attendanceStats.forEach(r => {
            if (attStats.hasOwnProperty(r.attendance_status)) {
                attStats[r.attendance_status] = r.count;
            }
            attStats.total += r.count;
        });

        // 2. 일별 출석률 (차트용)
        const [dailyAttendance] = await pacaPool.query(`
            SELECT
                cs.class_date,
                COUNT(*) as total,
                SUM(CASE WHEN a.attendance_status = 'present' THEN 1 ELSE 0 END) as present_count
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            WHERE cs.academy_id = ?
              AND cs.class_date BETWEEN ? AND ?
            GROUP BY cs.class_date
            ORDER BY cs.class_date
        `, [academyId, startDate, todayStr]);

        const dailyRates = dailyAttendance.map(d => ({
            date: typeof d.class_date === 'string' ? d.class_date : d.class_date.toISOString().split('T')[0],
            rate: d.total > 0 ? Math.round((d.present_count / d.total) * 100) : 0,
            total: d.total,
            present: d.present_count
        }));

        // 3. 최근 기록 측정 활동
        const [recentRecords] = await db.query(`
            SELECT
                sr.measured_at,
                COUNT(DISTINCT sr.student_id) as student_count,
                COUNT(*) as record_count
            FROM student_records sr
            WHERE sr.academy_id = ?
              AND sr.measured_at BETWEEN ? AND ?
            GROUP BY sr.measured_at
            ORDER BY sr.measured_at DESC
            LIMIT 7
        `, [academyId, startDate, todayStr]);

        // 4. 수업 진행률 (plans)
        const [planStats] = await db.query(`
            SELECT
                COUNT(*) as total_plans,
                SUM(CASE WHEN conditions_checked = 1 THEN 1 ELSE 0 END) as checked_plans
            FROM daily_plans
            WHERE academy_id = ?
              AND date BETWEEN ? AND ?
        `, [academyId, startDate, todayStr]);

        res.json({
            success: true,
            period: period || 'week',
            startDate,
            endDate: todayStr,
            attendance: {
                ...attStats,
                rate: attStats.total > 0 ? Math.round((attStats.present / attStats.total) * 100) : 0
            },
            dailyRates,
            recentRecords,
            plans: {
                total: planStats[0]?.total_plans || 0,
                checked: planStats[0]?.checked_plans || 0
            }
        });
    } catch (error) {
        console.error('Mobile stats error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
