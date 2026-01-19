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

        // 배치된 학생 조회 - 해당 학원만 (체험 정보는 daily_assignments에서 가져옴)
        const [assignments] = await db.query(`
            SELECT
                a.*,
                s.name as student_name,
                s.gender,
                s.school,
                s.grade,
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

            // 대기 중인 학생: 미배치 학생(결석 아닌) + 결석 학생(배치 여부 무관)
            const waitingNonAbsent = assignments
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

            // Socket.io 브로드캐스트
            const io = req.app.get('io');
            if (io) {
                io.to(`academy-${academyId}`).emit('assignments-updated', {
                    date: targetDate,
                    time_slot,
                    action: 'instructor-removed'
                });
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
        await cleanupEmptyClasses(targetDate, time_slot, academyId);

        // Socket.io 브로드캐스트
        const io = req.app.get('io');
        if (io) {
            io.to(`academy-${academyId}`).emit('assignments-updated', {
                date: targetDate,
                time_slot,
                action: 'instructor-assigned',
                class_num: to_class_num
            });
        }

        res.json({ success: true, action: 'assigned', class_num: to_class_num });
    } catch (error) {
        console.error('Instructor assignment error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 빈 반 정리 함수 (강사 없는 반의 학생들 미배치로)
async function cleanupEmptyClasses(date, time_slot, academyId) {
    // 강사가 있는 반 목록 (해당 학원만)
    const [classesWithInstructors] = await db.query(`
        SELECT DISTINCT class_num FROM class_instructors
        WHERE academy_id = ? AND date = ? AND time_slot = ?
    `, [academyId, date, time_slot]);

    const validClassNums = classesWithInstructors.map(c => c.class_num);

    if (validClassNums.length === 0) {
        // 모든 학생 미배치로 (해당 학원만)
        await db.query(`
            UPDATE daily_assignments
            SET class_id = NULL
            WHERE academy_id = ? AND date = ? AND time_slot = ? AND class_id IS NOT NULL
        `, [academyId, date, time_slot]);
    } else {
        // 유효하지 않은 반의 학생 미배치로 (해당 학원만)
        await db.query(`
            UPDATE daily_assignments
            SET class_id = NULL
            WHERE academy_id = ? AND date = ? AND time_slot = ? AND class_id IS NOT NULL AND class_id NOT IN (?)
        `, [academyId, date, time_slot, validClassNums]);
    }
}

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

// POST /peak/assignments/sync - P-ACA에서 오늘 스케줄 동기화
router.post('/sync', verifyToken, async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const academyId = req.user.academyId;  // 토큰에서 학원 ID

        // 기존 배치 조회 (class_id 유지를 위해) - 해당 학원만, 체험 정보 포함
        const [existingAssignments] = await db.query(`
            SELECT id, student_id, time_slot, class_id, paca_attendance_id, is_trial, trial_total, trial_remaining
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

        // N+1 쿼리 최적화: 한 번에 모든 학생 조회
        const pacaStudentIds = pacaStudents.map(ps => ps.paca_student_id);
        const [existingPeakStudents] = await db.query(
            'SELECT id, paca_student_id FROM students WHERE paca_student_id IN (?)',
            [pacaStudentIds]
        );

        // paca_student_id로 매핑
        const peakStudentMap = new Map();
        existingPeakStudents.forEach(s => {
            peakStudentMap.set(s.paca_student_id, s.id);
        });

        let addedCount = 0;
        let updatedCount = 0;
        const syncedStudentKeys = new Set();

        // 새로 추가할 학생과 업데이트할 학생 분리
        const studentsToInsert = [];
        const studentsToUpdate = [];
        const assignmentsToInsert = [];
        const assignmentsToUpdate = [];

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

            let peakStudentId = peakStudentMap.get(ps.paca_student_id);

            if (!peakStudentId) {
                // 새 학생 추가 대기열에 추가
                studentsToInsert.push([
                    ps.paca_student_id,
                    decryptedName,
                    gender,
                    ps.school,
                    ps.grade,
                    ps.is_trial ? 1 : 0,
                    trialTotal,
                    ps.trial_remaining || 0
                ]);
                // 임시 ID (나중에 실제 ID로 교체)
                peakStudentId = `temp_${ps.paca_student_id}`;
                peakStudentMap.set(ps.paca_student_id, peakStudentId);
            } else {
                // 기존 학생 업데이트 대기열에 추가
                studentsToUpdate.push([
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

            // 실제 student_id를 사용하여 existing 조회 (임시 ID는 아직 확정 안됨)
            let actualStudentId = peakStudentId;
            if (typeof peakStudentId === 'string' && peakStudentId.startsWith('temp_')) {
                // 임시 ID의 경우, existing에서 조회할 수 없으므로 null
                actualStudentId = null;
            }

            const studentKey = `${peakStudentId}-${ps.time_slot}`;
            syncedStudentKeys.add(studentKey);

            const existing = actualStudentId ? existingMap.get(`${actualStudentId}-${ps.time_slot}`) : null;

            if (existing) {
                // 기존 배치 있음 - class_id 유지
                const keepTrialInfo = existing.is_trial === 1;
                const newIsTrial = keepTrialInfo ? 1 : (ps.is_trial ? 1 : 0);
                const newTrialTotal = keepTrialInfo ? existing.trial_total : trialTotal;
                const newTrialRemaining = keepTrialInfo ? existing.trial_remaining : (ps.trial_remaining || 0);

                assignmentsToUpdate.push([
                    ps.attendance_id,
                    newIsTrial,
                    newTrialTotal,
                    newTrialRemaining,
                    existing.id
                ]);
                updatedCount++;
            } else {
                // 새 학생 배치 추가 대기열
                assignmentsToInsert.push({
                    pacaStudentId: ps.paca_student_id,
                    timeSlot: ps.time_slot,
                    attendanceId: ps.attendance_id,
                    isTrial: ps.is_trial ? 1 : 0,
                    trialTotal: trialTotal,
                    trialRemaining: ps.trial_remaining || 0
                });
                addedCount++;
            }
        }

        // Bulk Insert: 새 학생들
        if (studentsToInsert.length > 0) {
            const [insertResult] = await db.query(`
                INSERT INTO students (paca_student_id, name, gender, school, grade, is_trial, trial_total, trial_remaining, status)
                VALUES ?
            `, [studentsToInsert.map(s => [...s, 'active'])]);

            // 새로 생성된 ID로 매핑 업데이트
            const startId = insertResult.insertId;
            studentsToInsert.forEach((s, idx) => {
                const pacaStudentId = s[0];
                peakStudentMap.set(pacaStudentId, startId + idx);
            });
        }

        // Bulk Update: 기존 학생들
        if (studentsToUpdate.length > 0) {
            for (const updateData of studentsToUpdate) {
                await db.query(`
                    UPDATE students SET name = ?, gender = ?, school = ?, grade = ?,
                           is_trial = ?, trial_total = ?, trial_remaining = ?
                    WHERE id = ?
                `, updateData);
            }
        }

        // Bulk Update: 기존 배치
        if (assignmentsToUpdate.length > 0) {
            for (const updateData of assignmentsToUpdate) {
                await db.query(`
                    UPDATE daily_assignments
                    SET paca_attendance_id = ?, is_trial = ?, trial_total = ?, trial_remaining = ?
                    WHERE id = ?
                `, updateData);
            }
        }

        // Bulk Insert: 새 배치
        if (assignmentsToInsert.length > 0) {
            const assignmentValues = assignmentsToInsert.map(a => [
                academyId,
                targetDate,
                a.timeSlot,
                peakStudentMap.get(a.pacaStudentId),
                a.attendanceId,
                null, // class_id
                'enrolled', // status
                0, // order_num
                a.isTrial,
                a.trialTotal,
                a.trialRemaining
            ]);

            await db.query(`
                INSERT INTO daily_assignments (academy_id, date, time_slot, student_id, paca_attendance_id, class_id, status, order_num, is_trial, trial_total, trial_remaining)
                VALUES ?
            `, [assignmentValues]);
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
