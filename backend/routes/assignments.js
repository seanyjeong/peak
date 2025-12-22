/**
 * Daily Assignments Routes (반 배치 - P-ACA 연동)
 * P-ACA의 class_schedules + attendance에서 학생 가져오기
 * P-ACA의 instructor_schedules에서 강사 가져오기
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');

const ACADEMY_ID = 2; // 일산맥스체대입시

// GET /peak/assignments - 오늘 반 배치 현황 (시간대별)
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // P-ACA에서 시간대 설정 가져오기
        const [settingsRows] = await pacaPool.query(`
            SELECT morning_class_time, afternoon_class_time, evening_class_time
            FROM academy_settings
            WHERE academy_id = ?
        `, [ACADEMY_ID]);

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
        `, [ACADEMY_ID, targetDate]);

        // 강사 이름 복호화 및 시간대별 그룹화
        const instructorsBySlot = { morning: [], afternoon: [], evening: [] };
        pacaInstructors.forEach(i => {
            const decryptedName = i.name ? decrypt(i.name) : i.name;
            if (instructorsBySlot[i.time_slot]) {
                instructorsBySlot[i.time_slot].push({
                    id: i.id,
                    name: decryptedName
                });
            }
        });

        // 배치된 학생 목록 조회
        const [assignments] = await db.query(`
            SELECT
                a.*,
                s.name as student_name,
                s.gender,
                s.school,
                s.grade,
                s.is_trial,
                s.trial_total,
                s.trial_remaining
            FROM daily_assignments a
            JOIN students s ON a.student_id = s.id
            WHERE a.date = ?
            ORDER BY a.time_slot, a.trainer_id, a.order_num
        `, [targetDate]);

        // 시간대별 결과 구성
        const result = {
            morning: { instructors: [], trainers: [] },
            afternoon: { instructors: [], trainers: [] },
            evening: { instructors: [], trainers: [] }
        };

        // 각 시간대별로 강사 컬럼 + 미배정 컬럼 구성
        ['morning', 'afternoon', 'evening'].forEach(slot => {
            const slotInstructors = instructorsBySlot[slot] || [];
            result[slot].instructors = slotInstructors;

            // 미배정 컬럼
            const unassigned = {
                trainer_id: null,
                trainer_name: '미배정',
                students: []
            };

            // 강사별 컬럼
            const trainerColumns = slotInstructors.map(inst => ({
                trainer_id: inst.id,
                trainer_name: inst.name,
                students: []
            }));

            // 해당 시간대 학생들 배치
            assignments.filter(a => a.time_slot === slot).forEach(a => {
                const student = {
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
                    order_num: a.order_num
                };

                if (a.trainer_id === null) {
                    unassigned.students.push(student);
                } else {
                    const col = trainerColumns.find(c => c.trainer_id === a.trainer_id);
                    if (col) {
                        col.students.push(student);
                    } else {
                        // 배정된 강사가 오늘 스케줄에 없으면 미배정으로
                        unassigned.students.push(student);
                    }
                }
            });

            result[slot].trainers = [unassigned, ...trainerColumns];
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

// GET /peak/assignments/instructors - 오늘 출근 강사 목록
router.get('/instructors', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

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
        `, [ACADEMY_ID, targetDate]);

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

// POST /peak/assignments/sync - P-ACA에서 오늘 스케줄 동기화
router.post('/sync', async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];

        // 기존 배치 조회 (trainer_id 유지를 위해)
        const [existingAssignments] = await db.query(`
            SELECT id, student_id, time_slot, trainer_id, paca_attendance_id
            FROM daily_assignments WHERE date = ?
        `, [targetDate]);

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
        `, [ACADEMY_ID, targetDate]);

        // P-ACA gender 변환 함수 (male/female → M/F)
        const convertGender = (g) => {
            if (g === 'male' || g === 'M') return 'M';
            if (g === 'female' || g === 'F') return 'F';
            return 'M'; // 기본값
        };

        let addedCount = 0;
        let updatedCount = 0;
        const syncedStudentKeys = new Set();

        for (const ps of pacaStudents) {
            const decryptedName = ps.student_name ? decrypt(ps.student_name) : ps.student_name;
            const gender = convertGender(ps.gender);

            // trial_total 계산: trial_dates 배열 길이 사용
            let trialTotal = 0;
            if (ps.is_trial) {
                try {
                    const trialDates = typeof ps.trial_dates === 'string'
                        ? JSON.parse(ps.trial_dates || '[]')
                        : (ps.trial_dates || []);
                    trialTotal = trialDates.length || 2; // 기본값 2
                } catch (e) {
                    trialTotal = 2; // 파싱 실패 시 기본값
                }
            }

            // Peak 학생 조회/생성
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
                // 학생 정보 업데이트 (trial_total은 유지, trial_remaining만 업데이트)
                await db.query(`
                    UPDATE students SET name = ?, gender = ?, school = ?, grade = ?,
                           is_trial = ?, trial_remaining = ?
                    WHERE id = ?
                `, [
                    decryptedName,
                    gender,
                    ps.school,
                    ps.grade,
                    ps.is_trial ? 1 : 0,
                    ps.trial_remaining || 0,
                    peakStudentId
                ]);
            }

            const studentKey = `${peakStudentId}-${ps.time_slot}`;
            syncedStudentKeys.add(studentKey);

            const existing = existingMap.get(studentKey);

            if (existing) {
                // 기존 배치 있음 - trainer_id 유지, paca_attendance_id만 업데이트
                await db.query(`
                    UPDATE daily_assignments SET paca_attendance_id = ?
                    WHERE id = ?
                `, [ps.attendance_id, existing.id]);
                updatedCount++;
            } else {
                // 새 학생 추가 - trainer_id는 NULL
                await db.query(`
                    INSERT INTO daily_assignments (date, time_slot, student_id, paca_attendance_id, trainer_id, status, order_num)
                    VALUES (?, ?, ?, ?, NULL, 'enrolled', 0)
                `, [targetDate, ps.time_slot, peakStudentId, ps.attendance_id]);
                addedCount++;
            }
        }

        // P-ACA에서 제거된 학생 삭제 (취소/보강 변경 등)
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

// POST /peak/assignments/init - 레거시 호환
router.post('/init', async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const [existing] = await db.query(
            'SELECT COUNT(*) as count FROM daily_assignments WHERE date = ?',
            [targetDate]
        );

        if (existing[0].count > 0) {
            return res.json({
                success: true,
                message: '이미 초기화됨',
                initialized: false
            });
        }

        // sync와 동일한 로직
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
                cs.time_slot
            FROM attendance a
            JOIN class_schedules cs ON a.class_schedule_id = cs.id
            JOIN students s ON a.student_id = s.id AND s.deleted_at IS NULL
            WHERE cs.academy_id = ? AND cs.class_date = ?
            ORDER BY cs.time_slot, s.name
        `, [ACADEMY_ID, targetDate]);

        // P-ACA gender 변환 함수 (male/female → M/F)
        const convertGender = (g) => {
            if (g === 'male' || g === 'M') return 'M';
            if (g === 'female' || g === 'F') return 'F';
            return 'M'; // 기본값
        };

        let syncedCount = 0;

        for (const ps of pacaStudents) {
            const decryptedName = ps.student_name ? decrypt(ps.student_name) : ps.student_name;
            const gender = convertGender(ps.gender);

            // trial_total 계산: trial_dates 배열 길이 사용
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
            }

            await db.query(`
                INSERT INTO daily_assignments (date, time_slot, student_id, paca_attendance_id, trainer_id, status, order_num)
                VALUES (?, ?, ?, ?, NULL, 'enrolled', 0)
            `, [targetDate, ps.time_slot, peakStudentId, ps.attendance_id]);

            syncedCount++;
        }

        res.json({
            success: true,
            message: `${syncedCount}명 학생 초기화 완료`,
            initialized: true,
            count: syncedCount
        });
    } catch (error) {
        console.error('Init assignments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/assignments/:id - 반 배치 변경 (드래그앤드롭)
router.put('/:id', async (req, res) => {
    try {
        const { trainer_id, status, order_num, time_slot } = req.body;

        let query = 'UPDATE daily_assignments SET trainer_id = ?, status = ?, order_num = ?';
        const params = [trainer_id, status, order_num];

        if (time_slot) {
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

// PUT /peak/assignments/batch - 일괄 업데이트
router.put('/batch', async (req, res) => {
    try {
        const { assignments } = req.body;

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            for (const a of assignments) {
                await connection.query(
                    'UPDATE daily_assignments SET trainer_id = ?, order_num = ?, time_slot = ? WHERE id = ?',
                    [a.trainer_id, a.order_num, a.time_slot || 'evening', a.id]
                );
            }
            await connection.commit();
            res.json({ success: true, updated: assignments.length });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Batch update error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
