const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { verifyToken } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const { getKstDateString } = require('../utils/kst-date');
const {
    getAssignmentSyncSourceStatusSql,
    getTrialAssignmentSnapshot,
    isAssignmentSyncEligible,
    isTrialAssignmentSnapshot,
} = require('../services/assignmentEligibilityService');
const { getPacaBranches, liveBranchId } = require('../services/assignmentBranchService');

function registerAssignmentSyncRoutes(router) {
    router.post('/sync', verifyToken, async (req, res) => {
        try {
            const { date } = req.body;
            const targetDate = date || getKstDateString();
            const academyId = req.user.academyId;
            const assignableStatusSql = getAssignmentSyncSourceStatusSql('s');
            // 지점을 쓰는 학원만 학생의 P-ACA 지점·반·반 담당 강사를 같이 읽는다
            const branches = await getPacaBranches(academyId);
            const hasBranches = branches.length > 0;

            const [existingAssignments] = await db.query(`
                SELECT id, student_id, time_slot, class_id, paca_attendance_id, is_trial, trial_total, trial_remaining
                FROM daily_assignments WHERE academy_id = ? AND date = ?
            `, [academyId, targetDate]);

            const existingMap = new Map();
            existingAssignments.forEach(a => {
                existingMap.set(`${a.student_id}-${a.time_slot}`, a);
            });

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
                    ${hasBranches ? 's.branch_id, s.class_id as paca_class_id, c.instructor_id as class_instructor_id,' : ''}
                    a.is_makeup
                FROM attendance a
                JOIN class_schedules cs ON a.class_schedule_id = cs.id
                JOIN students s
                    ON a.student_id = s.id
                    AND s.academy_id = cs.academy_id
                    AND s.deleted_at IS NULL
                    AND ${assignableStatusSql.clause}
                ${hasBranches ? 'LEFT JOIN classes c ON c.id = s.class_id AND c.academy_id = s.academy_id' : ''}
                WHERE cs.academy_id = ? AND cs.class_date = ?
                ORDER BY cs.time_slot, s.name
            `, [...assignableStatusSql.params, academyId, targetDate]);

            const syncResult = await syncAssignments({
                academyId,
                targetDate,
                branches,
                pacaStudents,
                existingAssignments,
                existingMap,
            });

            res.json({
                success: true,
                message: `동기화 완료: 추가 ${syncResult.addedCount}명, 유지 ${syncResult.updatedCount}명, 제거 ${syncResult.removedCount}명`,
                added: syncResult.addedCount,
                updated: syncResult.updatedCount,
                removed: syncResult.removedCount,
            });
        } catch (error) {
            console.error('Sync assignments error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}

async function syncAssignments({ academyId, targetDate, branches, pacaStudents, existingAssignments, existingMap }) {
    const pacaStudentIds = pacaStudents.map(ps => ps.paca_student_id);
    const peakStudentMap = await getPeakStudentMap(pacaStudentIds, academyId);
    const syncPlan = buildSyncPlan(pacaStudents, existingMap, peakStudentMap, targetDate);

    if (syncPlan.studentsToInsert.length > 0) {
        await insertStudents(syncPlan.studentsToInsert, academyId, peakStudentMap);
    }
    await updateStudents(syncPlan.studentsToUpdate, academyId);
    await updateAssignments(syncPlan.assignmentsToUpdate, academyId);
    if (branches.length > 0) await releaseMovedStudents(syncPlan.placedStudents, academyId, targetDate, branches);
    const classNums = await prepareBranchClasses(syncPlan.assignmentsToInsert, academyId, targetDate);
    await insertAssignments(syncPlan.assignmentsToInsert, academyId, targetDate, peakStudentMap, classNums);

    const removedCount = await removeMissingAssignments(existingAssignments, syncPlan.syncedStudentKeys, academyId);

    return {
        addedCount: syncPlan.addedCount,
        updatedCount: syncPlan.updatedCount,
        removedCount,
    };
}

async function getPeakStudentMap(pacaStudentIds, academyId) {
    const peakStudentMap = new Map();
    if (pacaStudentIds.length === 0) return peakStudentMap;

    const [existingPeakStudents] = await db.query(
        'SELECT id, paca_student_id FROM students WHERE academy_id = ? AND paca_student_id IN (?)',
        [academyId, pacaStudentIds]
    );
    existingPeakStudents.forEach(s => {
        peakStudentMap.set(s.paca_student_id, s.id);
    });
    return peakStudentMap;
}

function buildSyncPlan(pacaStudents, existingMap, peakStudentMap, targetDate) {
    const plan = {
        studentsToInsert: [],
        studentsToUpdate: [],
        assignmentsToInsert: [],
        assignmentsToUpdate: [],
        syncedStudentKeys: new Set(),
        placedStudents: [],
        addedCount: 0,
        updatedCount: 0,
    };

    for (const ps of pacaStudents) {
        let peakStudentId = peakStudentMap.get(ps.paca_student_id);
        const trialSnapshot = getTrialAssignmentSnapshot(ps, targetDate);
        const actualStudentId = typeof peakStudentId === 'string' && peakStudentId.startsWith('temp_')
            ? null
            : peakStudentId;
        const existing = actualStudentId
            ? existingMap.get(`${actualStudentId}-${ps.time_slot}`)
            : null;
        if (!isAssignmentSyncEligible(ps.student_status, existing, trialSnapshot)) continue;

        const currentTrialTotal = ps.is_trial ? trialSnapshot.trialTotal : 0;

        if (!peakStudentId) {
            plan.studentsToInsert.push([
                ps.paca_student_id,
                ps.student_name ? decrypt(ps.student_name) : ps.student_name,
                convertGender(ps.gender),
                ps.school,
                ps.grade,
                ps.is_trial ? 1 : 0,
                currentTrialTotal,
                ps.trial_remaining || 0,
            ]);
            peakStudentId = `temp_${ps.paca_student_id}`;
            peakStudentMap.set(ps.paca_student_id, peakStudentId);
        } else {
            plan.studentsToUpdate.push([
                ps.student_name ? decrypt(ps.student_name) : ps.student_name,
                convertGender(ps.gender),
                ps.school,
                ps.grade,
                ps.is_trial ? 1 : 0,
                currentTrialTotal,
                ps.trial_remaining || 0,
                peakStudentId,
            ]);
        }

        plan.syncedStudentKeys.add(`${peakStudentId}-${ps.time_slot}`);

        if (existing) {
            const keepTrialInfo = isTrialAssignmentSnapshot(existing);
            plan.assignmentsToUpdate.push([
                ps.attendance_id,
                keepTrialInfo ? 1 : (trialSnapshot.isTrial ? 1 : 0),
                keepTrialInfo ? existing.trial_total : trialSnapshot.trialTotal,
                ps.trial_remaining || 0,
                existing.id,
            ]);
            if (existing.class_id !== null) {
                plan.placedStudents.push({
                    id: existing.id, timeSlot: existing.time_slot, classNum: existing.class_id, branchId: ps.branch_id || null,
                });
            }
            plan.updatedCount++;
        } else {
            plan.assignmentsToInsert.push({
                pacaStudentId: ps.paca_student_id,
                timeSlot: ps.time_slot,
                attendanceId: ps.attendance_id,
                isTrial: trialSnapshot.isTrial ? 1 : 0,
                trialTotal: trialSnapshot.trialTotal,
                trialRemaining: ps.trial_remaining || 0,
                branchId: ps.branch_id || null,
                pacaClassId: ps.paca_class_id || null,
                classInstructorId: ps.class_instructor_id || null,
            });
            plan.addedCount++;
        }
    }

    return plan;
}

function convertGender(gender) {
    if (gender === 'male' || gender === 'M') return 'M';
    if (gender === 'female' || gender === 'F') return 'F';
    return 'M';
}

async function insertStudents(studentsToInsert, academyId, peakStudentMap) {
    const [insertResult] = await db.query(`
        INSERT INTO students (paca_student_id, name, gender, school, grade, is_trial, trial_total, trial_remaining, status, academy_id)
        VALUES ?
    `, [studentsToInsert.map(s => [...s, 'active', academyId])]);

    const startId = insertResult.insertId;
    studentsToInsert.forEach((s, idx) => {
        const pacaStudentId = s[0];
        peakStudentMap.set(pacaStudentId, startId + idx);
    });
}

async function updateStudents(studentsToUpdate, academyId) {
    for (const updateData of studentsToUpdate) {
        await db.query(`
            UPDATE students SET name = ?, gender = ?, school = ?, grade = ?,
                   is_trial = ?, trial_total = ?, trial_remaining = ?
            WHERE id = ? AND academy_id = ?
        `, [...updateData, academyId]);
    }
}

async function updateAssignments(assignmentsToUpdate, academyId) {
    for (const updateData of assignmentsToUpdate) {
        await db.query(`
            UPDATE daily_assignments
            SET paca_attendance_id = ?, is_trial = ?, trial_total = ?, trial_remaining = ?
            WHERE id = ? AND academy_id = ?
        `, [...updateData, academyId]);
    }
}

// P-ACA 에서 지점을 옮긴 학생이 옛 지점 조에 남아 있으면 대기로 돌린다.
// 지점에 묶이지 않은 조(전체에서 만든 조, 지운 지점의 조)에 있는 학생은 그대로 둔다.
async function releaseMovedStudents(placedStudents, academyId, targetDate, branches) {
    if (placedStudents.length === 0) return;

    const [classRows] = await db.query(`
        SELECT DISTINCT time_slot, class_num, branch_id FROM class_instructors
        WHERE academy_id = ? AND date = ? AND branch_id IS NOT NULL
    `, [academyId, targetDate]);
    const classBranch = new Map(classRows
        .filter(row => liveBranchId(row.branch_id, branches) !== null)
        .map(row => [`${row.time_slot}-${row.class_num}`, row.branch_id]));

    for (const placed of placedStudents) {
        const branchId = classBranch.get(`${placed.timeSlot}-${placed.classNum}`);
        if (branchId === undefined || branchId === placed.branchId) continue;
        await db.query('UPDATE daily_assignments SET class_id = NULL WHERE id = ? AND academy_id = ?', [placed.id, academyId]);
    }
}

// 새로 들어온 학생을 P-ACA 반대로 나눈다: 반에 담당 강사가 있고 그 강사가 그 시간대에 근무하면
// 그 반의 조를 만들고(이미 있으면 그 조에) 학생을 넣는다. 그 밖의 학생은 지금처럼 대기.
// 이미 배치돼 있던 학생은 건드리지 않는다. 돌려주는 값: `${timeSlot}-${pacaClassId}` → 조 번호.
async function prepareBranchClasses(assignmentsToInsert, academyId, targetDate) {
    const classNums = new Map();
    const targets = assignmentsToInsert.filter(a => a.branchId && a.pacaClassId && a.classInstructorId);
    if (targets.length === 0) return classNums;

    const [classRows] = await db.query(`
        SELECT time_slot, class_num, instructor_id, paca_class_id FROM class_instructors
        WHERE academy_id = ? AND date = ?
    `, [academyId, targetDate]);
    const [working] = await pacaPool.query(`
        SELECT instructor_id, time_slot FROM instructor_schedules
        WHERE academy_id = ? AND work_date = ?
    `, [academyId, targetDate]);
    const workingKeys = new Set(working.map(w => `${w.time_slot}-${w.instructor_id}`));

    for (const target of targets) {
        const key = `${target.timeSlot}-${target.pacaClassId}`;
        if (classNums.has(key)) continue;

        const slotRows = classRows.filter(row => row.time_slot === target.timeSlot);
        const existing = slotRows.find(row => row.paca_class_id === target.pacaClassId);
        if (existing) {
            classNums.set(key, existing.class_num);
            continue;
        }
        const placed = slotRows.some(row => row.instructor_id === target.classInstructorId);
        if (placed || !workingKeys.has(`${target.timeSlot}-${target.classInstructorId}`)) continue;

        const classNum = slotRows.reduce((max, row) => Math.max(max, row.class_num), 0) + 1;
        await db.query(`
            INSERT INTO class_instructors (academy_id, date, time_slot, class_num, instructor_id, is_main, order_num, branch_id, paca_class_id)
            VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
        `, [academyId, targetDate, target.timeSlot, classNum, target.classInstructorId, target.branchId, target.pacaClassId]);
        classRows.push({
            time_slot: target.timeSlot, class_num: classNum,
            instructor_id: target.classInstructorId, paca_class_id: target.pacaClassId,
        });
        classNums.set(key, classNum);
    }
    return classNums;
}

async function insertAssignments(assignmentsToInsert, academyId, targetDate, peakStudentMap, classNums) {
    if (assignmentsToInsert.length === 0) return;

    const assignmentValues = assignmentsToInsert.map(a => [
        academyId,
        targetDate,
        a.timeSlot,
        peakStudentMap.get(a.pacaStudentId),
        a.attendanceId,
        classNums.get(`${a.timeSlot}-${a.pacaClassId}`) ?? null,
        'enrolled',
        0,
        a.isTrial,
        a.trialTotal,
        a.trialRemaining,
    ]);

    await db.query(`
        INSERT INTO daily_assignments (academy_id, date, time_slot, student_id, paca_attendance_id, class_id, status, order_num, is_trial, trial_total, trial_remaining)
        VALUES ?
    `, [assignmentValues]);
}

async function removeMissingAssignments(existingAssignments, syncedStudentKeys, academyId) {
    let removedCount = 0;
    for (const existing of existingAssignments) {
        const studentKey = `${existing.student_id}-${existing.time_slot}`;
        if (!syncedStudentKeys.has(studentKey)) {
            await db.query('DELETE FROM daily_assignments WHERE id = ? AND academy_id = ?', [existing.id, academyId]);
            removedCount++;
        }
    }
    return removedCount;
}

module.exports = registerAssignmentSyncRoutes;
