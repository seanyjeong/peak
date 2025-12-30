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

// GET /peak/assignments - 반 배치 현황 (반 중심 구조)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;  // 토큰에서 학원 ID 가져오기

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

        // 배치된 학생 조회 - 해당 학원만
        const [assignments] = await db.query(`
            SELECT
                a.*,
                s.name as student_name,
                s.gender,
                s.school,
                s.grade,
                s.is_trial,
                s.trial_total,
                s.trial_remaining,
                s.paca_student_id
            FROM daily_assignments a
            JOIN students s ON a.student_id = s.id
            WHERE a.academy_id = ? AND a.date = ?
            ORDER BY a.time_slot, a.class_id, a.order_num
        `, [academyId, targetDate]);

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
                    });

                result[slot].classes.push({
                    class_num: classNum,
                    instructors: classInsts,
                    students: classStudents
                });
            });

            // 대기 중인 학생 (class_id가 NULL)
            result[slot].waitingStudents = assignments
                .filter(a => a.time_slot === slot && a.class_id === null)
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
                });
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

// POST /peak/assignments/instructor - 강사 배치/이동
router.post('/instructor', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { date, time_slot, instructor_id, to_class_num, is_main } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];

        if (to_class_num === null || to_class_num === undefined) {
            // 대기로 이동: 기존 배치 삭제
            const [deleted] = await db.query(`
                DELETE FROM class_instructors
                WHERE date = ? AND time_slot = ? AND instructor_id = ?
            `, [targetDate, time_slot, instructor_id]);

            // 해당 강사가 있던 반 찾기
            if (deleted.affectedRows > 0) {
                // 남은 강사가 없는 반의 학생들 미배치로
                await cleanupEmptyClasses(targetDate, time_slot);
            }

            return res.json({ success: true, action: 'removed' });
        }

        // 기존 배치 삭제
        await db.query(`
            DELETE FROM class_instructors
            WHERE date = ? AND time_slot = ? AND instructor_id = ?
        `, [targetDate, time_slot, instructor_id]);

        // 해당 반의 기존 강사 확인
        const [existingInsts] = await db.query(`
            SELECT * FROM class_instructors
            WHERE date = ? AND time_slot = ? AND class_num = ?
            ORDER BY order_num
        `, [targetDate, time_slot, to_class_num]);

        let orderNum = 0;
        let isMainFlag = is_main !== undefined ? is_main : (existingInsts.length === 0);

        if (isMainFlag && existingInsts.length > 0) {
            // 기존 주강사를 보조로 변경
            await db.query(`
                UPDATE class_instructors
                SET is_main = 0, order_num = order_num + 1
                WHERE date = ? AND time_slot = ? AND class_num = ? AND is_main = 1
            `, [targetDate, time_slot, to_class_num]);
            orderNum = 0;
        } else {
            orderNum = existingInsts.length;
        }

        // 새 배치 추가 - academy_id 포함
        await db.query(`
            INSERT INTO class_instructors (academy_id, date, time_slot, class_num, instructor_id, is_main, order_num)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [academyId, targetDate, time_slot, to_class_num, instructor_id, isMainFlag ? 1 : 0, orderNum]);

        // 빈 반 정리
        await cleanupEmptyClasses(targetDate, time_slot);

        res.json({ success: true, action: 'assigned', class_num: to_class_num });
    } catch (error) {
        console.error('Instructor assignment error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 빈 반 정리 함수 (강사 없는 반의 학생들 미배치로)
async function cleanupEmptyClasses(date, time_slot) {
    // 강사가 있는 반 목록
    const [classesWithInstructors] = await db.query(`
        SELECT DISTINCT class_num FROM class_instructors
        WHERE date = ? AND time_slot = ?
    `, [date, time_slot]);

    const validClassNums = classesWithInstructors.map(c => c.class_num);

    if (validClassNums.length === 0) {
        // 모든 학생 미배치로
        await db.query(`
            UPDATE daily_assignments
            SET class_id = NULL
            WHERE date = ? AND time_slot = ? AND class_id IS NOT NULL
        `, [date, time_slot]);
    } else {
        // 유효하지 않은 반의 학생 미배치로
        await db.query(`
            UPDATE daily_assignments
            SET class_id = NULL
            WHERE date = ? AND time_slot = ? AND class_id IS NOT NULL AND class_id NOT IN (?)
        `, [date, time_slot, validClassNums]);
    }
}

// PUT /peak/assignments/:id - 학생 배치 변경
router.put('/:id', async (req, res) => {
    try {
        const { class_id, status, order_num, time_slot } = req.body;

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

        query += ' WHERE id = ?';
        params.push(req.params.id);

        await db.query(query, params);

        res.json({ success: true });
    } catch (error) {
        console.error('Update assignment error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/assignments/sync - P-ACA에서 오늘 스케줄 동기화
router.post('/sync', verifyToken, async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;  // 토큰에서 학원 ID

        // 기존 배치 조회 (class_id 유지를 위해) - 해당 학원만
        const [existingAssignments] = await db.query(`
            SELECT id, student_id, time_slot, class_id, paca_attendance_id
            FROM daily_assignments WHERE academy_id = ? AND date = ?
        `, [academyId, targetDate]);

        // 기존 배치를 student_id+time_slot로 맵핑
        const existingMap = new Map();
        existingAssignments.forEach(a => {
            existingMap.set(`${a.student_id}-${a.time_slot}`, a);
        });

        // P-ACA에서 오늘 수업에 배정된 학생들 조회
        const [pacaStudents] = await pacaPool.query(`
            SELECT
                a.id as attendance_id,
                a.student_id as paca_student_id,
                s.name as student_name,
                s.gender,
                s.school,
                s.grade,
                s.is_trial,
                s.trial_remaining,
                s.trial_dates,
                s.status as student_status,
                cs.time_slot,
                a.attendance_status,
                a.is_makeup
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            JOIN students s ON a.student_id = s.id AND s.deleted_at IS NULL
            WHERE cs.academy_id = ? AND cs.class_date = ?
            ORDER BY cs.time_slot, s.name
        `, [academyId, targetDate]);

        const convertGender = (g) => {
            if (g === 'male' || g === 'M') return 'M';
            if (g === 'female' || g === 'F') return 'F';
            return 'M';
        };

        let addedCount = 0;
        let updatedCount = 0;
        const syncedStudentKeys = new Set();

        for (const ps of pacaStudents) {
            const decryptedName = ps.student_name ? decrypt(ps.student_name) : ps.student_name;
            const gender = convertGender(ps.gender);

            let trialTotal = 0;
            if (ps.is_trial) {
                try {
                    const trialDates = typeof ps.trial_dates === 'string'
                        ? JSON.parse(ps.trial_dates || '[]')
                        : (ps.trial_dates || []);
                    trialTotal = trialDates.length || 2;
                } catch (e) {
                    trialTotal = 2;
                }
            }

            let [peakStudents] = await db.query(
                'SELECT id FROM students WHERE paca_student_id = ?',
                [ps.paca_student_id]
            );

            let peakStudentId;

            if (peakStudents.length === 0) {
                const [insertResult] = await db.query(`
                    INSERT INTO students (paca_student_id, name, gender, school, grade, is_trial, trial_total, trial_remaining, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
                `, [
                    ps.paca_student_id,
                    decryptedName,
                    gender,
                    ps.school,
                    ps.grade,
                    ps.is_trial ? 1 : 0,
                    trialTotal,
                    ps.trial_remaining || 0
                ]);
                peakStudentId = insertResult.insertId;
            } else {
                peakStudentId = peakStudents[0].id;
                await db.query(`
                    UPDATE students SET name = ?, gender = ?, school = ?, grade = ?,
                           is_trial = ?, trial_total = ?, trial_remaining = ?
                    WHERE id = ?
                `, [
                    decryptedName,
                    gender,
                    ps.school,
                    ps.grade,
                    ps.is_trial ? 1 : 0,
                    trialTotal,
                    ps.trial_remaining || 0,
                    peakStudentId
                ]);
            }

            const studentKey = `${peakStudentId}-${ps.time_slot}`;
            syncedStudentKeys.add(studentKey);

            const existing = existingMap.get(studentKey);

            if (existing) {
                // 기존 배치 있음 - class_id 유지
                await db.query(`
                    UPDATE daily_assignments SET paca_attendance_id = ?
                    WHERE id = ?
                `, [ps.attendance_id, existing.id]);
                updatedCount++;
            } else {
                // 새 학생 추가 - class_id는 NULL (대기), academy_id 포함
                await db.query(`
                    INSERT INTO daily_assignments (academy_id, date, time_slot, student_id, paca_attendance_id, class_id, status, order_num)
                    VALUES (?, ?, ?, ?, ?, NULL, 'enrolled', 0)
                `, [academyId, targetDate, ps.time_slot, peakStudentId, ps.attendance_id]);
                addedCount++;
            }
        }

        // P-ACA에서 제거된 학생 삭제
        let removedCount = 0;
        for (const existing of existingAssignments) {
            const studentKey = `${existing.student_id}-${existing.time_slot}`;
            if (!syncedStudentKeys.has(studentKey)) {
                await db.query('DELETE FROM daily_assignments WHERE id = ?', [existing.id]);
                removedCount++;
            }
        }

        res.json({
            success: true,
            message: `동기화 완료: 추가 ${addedCount}명, 유지 ${updatedCount}명, 제거 ${removedCount}명`,
            added: addedCount,
            updated: updatedCount,
            removed: removedCount
        });
    } catch (error) {
        console.error('Sync assignments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/assignments/next-class-num - 다음 반 번호 조회
router.get('/next-class-num', async (req, res) => {
    try {
        const { date, time_slot } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const [result] = await db.query(`
            SELECT COALESCE(MAX(class_num), 0) + 1 as next_num
            FROM class_instructors
            WHERE date = ? AND time_slot = ?
        `, [targetDate, time_slot]);

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
