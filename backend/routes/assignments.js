/**
 * Daily Assignments Routes (반 배치 - v2.0 반 중심 구조)
 * - 학생 + 강사 모두 드래그앤드롭
 * - 한 반에 여러 강사 (주 + 보조)
 * - 반 자동 생성/삭제
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');
const { getAssignablePacaStatusSql } = require('../services/assignmentEligibilityService');
const registerAssignmentInstructorRoutes = require('./assignmentInstructorRoutes');
const registerAssignmentSyncRoutes = require('./assignmentSyncRoutes');

// GET /peak/assignments - 반 배치 현황 (반 중심 구조)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;  // 토큰에서 학원 ID 가져오기
        const assignableStatusSql = getAssignablePacaStatusSql('ps');

        // P-ACA에서 시간대 설정 가져오기
        const [settingsRows] = await pacaPool.query(`
            SELECT morning_class_time, afternoon_class_time, evening_class_time
            FROM academy_settings
            WHERE academy_id = ?
        `, [academyId]);

        const timeSlots = settingsRows[0] ? {
            morning: settingsRows[0].morning_class_time || '09:00-12:00',
            afternoon: settingsRows[0].afternoon_class_time || '13:00-17:00',
            evening: settingsRows[0].evening_class_time || '18:00-21:00'
        } : {
            morning: '09:00-12:00',
            afternoon: '13:00-17:00',
            evening: '18:00-21:00'
        };

        // P-ACA에서 오늘 출근 강사 조회 (시간대별)
        const [pacaInstructors] = await pacaPool.query(`
            SELECT DISTINCT
                i.id,
                i.name,
                ins.time_slot
            FROM instructor_schedules ins
            JOIN instructors i ON ins.instructor_id = i.id
            WHERE ins.academy_id = ? AND ins.work_date = ?
            ORDER BY ins.time_slot, i.id
        `, [academyId, targetDate]);

        // P-ACA에서 원장 조회
        const [owners] = await pacaPool.query(`
            SELECT id, name FROM users
            WHERE academy_id = ? AND role = 'owner' AND deleted_at IS NULL
        `, [academyId]);

        // 강사 이름 복호화 및 시간대별 그룹화
        const allInstructorsBySlot = { morning: [], afternoon: [], evening: [] };

        // 원장을 모든 시간대에 추가 (음수 ID)
        owners.forEach(owner => {
            const decryptedName = owner.name ? decrypt(owner.name) : owner.name;
            ['morning', 'afternoon', 'evening'].forEach(slot => {
                allInstructorsBySlot[slot].push({
                    id: -owner.id,
                    name: decryptedName,
                    isOwner: true
                });
            });
        });

        // 일반 강사 추가
        pacaInstructors.forEach(i => {
            const decryptedName = i.name ? decrypt(i.name) : i.name;
            if (allInstructorsBySlot[i.time_slot]) {
                allInstructorsBySlot[i.time_slot].push({
                    id: i.id,
                    name: decryptedName,
                    isOwner: false
                });
            }
        });

        // 반에 배치된 강사 조회 - 해당 학원만
        const [classInstructors] = await db.query(`
            SELECT * FROM class_instructors
            WHERE academy_id = ? AND date = ?
            ORDER BY time_slot, class_num, order_num
        `, [academyId, targetDate]);

        // 배치된 학생 조회 - 해당 학원만 (체험 정보는 daily_assignments에서 가져옴)
        const [assignments] = await db.query(`
            SELECT
                a.*,
                ps.name as student_name,
                ps.gender,
                ps.school,
                ps.grade,
                s.paca_student_id
            FROM daily_assignments a
            JOIN students s ON a.student_id = s.id
            JOIN paca.students ps
                ON s.paca_student_id = ps.id
                AND ps.academy_id = ?
                AND ${assignableStatusSql.clause}
            WHERE a.academy_id = ? AND a.date = ?
            ORDER BY a.time_slot, a.class_id, a.order_num
        `, [academyId, ...assignableStatusSql.params, academyId, targetDate]);

        // Decrypt student names + convert gender
        assignments.forEach(a => {
            if (a.student_name) a.student_name = decrypt(a.student_name);
            if (a.gender === 'male') a.gender = 'M';
            else if (a.gender === 'female') a.gender = 'F';
        });

        // P-ACA에서 출결 상태 조회
        const [pacaAttendance] = await pacaPool.query(`
            SELECT
                a.student_id as paca_student_id,
                a.attendance_status,
                a.notes,
                cs.time_slot
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            WHERE cs.academy_id = ? AND cs.class_date = ?
        `, [academyId, targetDate]);

        // paca_student_id로 출결 정보 매핑
        const attendanceMap = {};
        pacaAttendance.forEach(att => {
            attendanceMap[`${att.paca_student_id}-${att.time_slot}`] = {
                attendance_status: att.attendance_status,
                absence_reason: att.notes  // notes를 absence_reason으로 사용
            };
        });



        // 배치된 강사 ID Set 생성 (시간대별)
        const assignedInstructorsBySlot = { morning: new Set(), afternoon: new Set(), evening: new Set() };
        classInstructors.forEach(ci => {
            assignedInstructorsBySlot[ci.time_slot].add(ci.instructor_id);
        });

        // 결과 구성
        const result = {
            morning: { waitingStudents: [], waitingInstructors: [], classes: [] },
            afternoon: { waitingStudents: [], waitingInstructors: [], classes: [] },
            evening: { waitingStudents: [], waitingInstructors: [], classes: [] }
        };

        // 각 시간대별 구성
        ['morning', 'afternoon', 'evening'].forEach(slot => {
            // 대기 중인 강사 (배치되지 않은)
            result[slot].waitingInstructors = allInstructorsBySlot[slot].filter(
                inst => !assignedInstructorsBySlot[slot].has(inst.id)
            );

            // 반별 데이터 구성
            const slotClassInstructors = classInstructors.filter(ci => ci.time_slot === slot);
            const classNums = [...new Set(slotClassInstructors.map(ci => ci.class_num))].sort((a, b) => a - b);

            classNums.forEach(classNum => {
                const classInsts = slotClassInstructors
                    .filter(ci => ci.class_num === classNum)
                    .sort((a, b) => a.order_num - b.order_num)
                    .map(ci => {
                        const instInfo = allInstructorsBySlot[slot].find(i => i.id === ci.instructor_id);
                        return {
                            id: ci.instructor_id,
                            name: instInfo ? instInfo.name : `강사 ${ci.instructor_id}`,
                            isOwner: instInfo ? instInfo.isOwner : false,
                            isMain: ci.is_main === 1,
                            order_num: ci.order_num
                        };
                    });

                // 반에 배치된 학생 중 결석이 아닌 학생만 표시 (결석 학생은 대기 영역으로)
                const classStudents = assignments
                    .filter(a => a.time_slot === slot && a.class_id === classNum)
                    .map(a => {
                        const attInfo = attendanceMap[`${a.paca_student_id}-${slot}`] || {};
                        return {
                            id: a.id,
                            student_id: a.student_id,
                            student_name: a.student_name,
                            gender: a.gender,
                            school: a.school,
                            grade: a.grade,
                            is_trial: a.is_trial,
                            trial_total: a.trial_total,
                            trial_remaining: a.trial_remaining,
                            status: a.status,
                            order_num: a.order_num,
                            attendance_status: attInfo.attendance_status || 'scheduled',
                            absence_reason: attInfo.absence_reason || null
                        };
                    })
                    .filter(s => s.attendance_status !== 'absent');  // 결석 학생 제외

                result[slot].classes.push({
                    class_num: classNum,
                    instructors: classInsts,
                    students: classStudents
                });
            });

            // 유효한 반 번호 (강사가 있는 반)
            const validClassNums = new Set(classNums);

            // 대기 중인 학생: 미배치 + 강사 없는 반에 배치된 학생(결석 아닌) + 결석 학생(배치 여부 무관)
            const waitingNonAbsent = assignments
                .filter(a => a.time_slot === slot && (a.class_id === null || !validClassNums.has(a.class_id)))
                .map(a => {
                    const attInfo = attendanceMap[`${a.paca_student_id}-${slot}`] || {};
                    return {
                        id: a.id,
                        student_id: a.student_id,
                        student_name: a.student_name,
                        gender: a.gender,
                        school: a.school,
                        grade: a.grade,
                        is_trial: a.is_trial,
                        trial_total: a.trial_total,
                        trial_remaining: a.trial_remaining,
                        status: a.status,
                        attendance_status: attInfo.attendance_status || 'scheduled',
                        absence_reason: attInfo.absence_reason || null
                    };
                })
                .filter(s => s.attendance_status !== 'absent');

            // 결석 학생 (배치 여부 무관하게 모두 대기 영역에 표시)
            const absentStudents = assignments
                .filter(a => a.time_slot === slot)
                .map(a => {
                    const attInfo = attendanceMap[`${a.paca_student_id}-${slot}`] || {};
                    return {
                        id: a.id,
                        student_id: a.student_id,
                        student_name: a.student_name,
                        gender: a.gender,
                        school: a.school,
                        grade: a.grade,
                        is_trial: a.is_trial,
                        trial_total: a.trial_total,
                        trial_remaining: a.trial_remaining,
                        status: a.status,
                        attendance_status: attInfo.attendance_status || 'scheduled',
                        absence_reason: attInfo.absence_reason || null
                    };
                })
                .filter(s => s.attendance_status === 'absent');

            result[slot].waitingStudents = [...waitingNonAbsent, ...absentStudents];
        });

        res.json({
            success: true,
            date: targetDate,
            slots: result,
            timeSlots
        });
    } catch (error) {
        console.error('Get assignments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

registerAssignmentInstructorRoutes(router);

// PUT /peak/assignments/:id - 학생 배치 변경
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { class_id, status, order_num, time_slot } = req.body;

        // 먼저 배치 정보 조회 (브로드캐스트용)
        const [existing] = await db.query(
            'SELECT date, time_slot FROM daily_assignments WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: '배치를 찾을 수 없습니다.' });
        }

        let query = 'UPDATE daily_assignments SET class_id = ?';
        const params = [class_id];

        if (status !== undefined) {
            query += ', status = ?';
            params.push(status);
        }
        if (order_num !== undefined) {
            query += ', order_num = ?';
            params.push(order_num);
        }
        if (time_slot !== undefined) {
            query += ', time_slot = ?';
            params.push(time_slot);
        }

        query += ' WHERE id = ? AND academy_id = ?';
        params.push(req.params.id);
        params.push(academyId);

        const [result] = await db.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '배치를 찾을 수 없습니다.' });
        }

        // Socket.io 브로드캐스트
        const io = req.app.get('io');
        if (io) {
            io.to(`academy-${academyId}`).emit('assignments-updated', {
                date: existing[0].date,
                time_slot: time_slot || existing[0].time_slot,
                action: 'student-moved'
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update assignment error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

registerAssignmentSyncRoutes(router);

// POST /peak/assignments/reset - 반 배치 초기화 (해당 날짜, 시간대 모든 배치 삭제)
router.post('/reset', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { date, time_slot } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // 특정 시간대 또는 전체 초기화
        if (time_slot) {
            // 특정 시간대만 초기화
            // 1. 강사 배치 삭제
            await db.query(`
                DELETE FROM class_instructors
                WHERE academy_id = ? AND date = ? AND time_slot = ?
            `, [academyId, targetDate, time_slot]);

            // 2. 학생 배치 해제 (class_id만 null로)
            await db.query(`
                UPDATE daily_assignments
                SET class_id = NULL
                WHERE academy_id = ? AND date = ? AND time_slot = ?
            `, [academyId, targetDate, time_slot]);
        } else {
            // 전체 시간대 초기화
            // 1. 강사 배치 삭제
            await db.query(`
                DELETE FROM class_instructors
                WHERE academy_id = ? AND date = ?
            `, [academyId, targetDate]);

            // 2. 학생 배치 해제
            await db.query(`
                UPDATE daily_assignments
                SET class_id = NULL
                WHERE academy_id = ? AND date = ?
            `, [academyId, targetDate]);
        }

        // Socket.io 브로드캐스트 (io가 있다면)
        const io = req.app.get('io');
        if (io) {
            io.to(`academy-${academyId}`).emit('assignments-updated', {
                date: targetDate,
                time_slot: time_slot || 'all',
                action: 'reset'
            });
        }

        res.json({
            success: true,
            message: time_slot
                ? `${targetDate} ${time_slot} 반 배치가 초기화되었습니다.`
                : `${targetDate} 모든 반 배치가 초기화되었습니다.`
        });
    } catch (error) {
        console.error('Reset assignments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/assignments/next-class-num - 다음 반 번호 조회
router.get('/next-class-num', verifyToken, async (req, res) => {
    try {
        const { date, time_slot } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;

        // academy_id 필터 추가하여 다른 학원의 반 번호와 충돌 방지
        const [result] = await db.query(`
            SELECT COALESCE(MAX(class_num), 0) + 1 as next_num
            FROM class_instructors
            WHERE date = ? AND time_slot = ? AND academy_id = ?
        `, [targetDate, time_slot, academyId]);

        res.json({ success: true, next_class_num: result[0].next_num });
    } catch (error) {
        console.error('Get next class num error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/assignments/instructors - 오늘 출근 강사 목록
router.get('/instructors', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;  // 토큰에서 학원 ID

        const [instructors] = await pacaPool.query(`
            SELECT DISTINCT
                i.id,
                i.name,
                ins.time_slot,
                ins.attendance_status,
                ins.check_in_time,
                ins.check_out_time
            FROM instructor_schedules ins
            JOIN instructors i ON ins.instructor_id = i.id
            WHERE ins.academy_id = ? AND ins.work_date = ?
            ORDER BY ins.time_slot
        `, [academyId, targetDate]);

        const decrypted = instructors.map(i => ({
            ...i,
            name: i.name ? decrypt(i.name) : i.name
        }));

        const bySlot = { morning: [], afternoon: [], evening: [] };
        decrypted.forEach(i => {
            if (bySlot[i.time_slot]) {
                bySlot[i.time_slot].push(i);
            }
        });

        res.json({
            success: true,
            date: targetDate,
            instructors: bySlot
        });
    } catch (error) {
        console.error('Get instructors error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
