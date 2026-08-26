const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { verifyToken } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const {
    getAssignmentSyncSourceStatusSql,
    getTrialAssignmentSnapshot,
    isAssignmentSyncEligible,
    isTrialAssignmentSnapshot,
} = require('../services/assignmentEligibilityService');

function registerAssignmentSyncRoutes(router) {
    router.post('/sync', verifyToken, async (req, res) => {
        try {
            const { date } = req.body;
            const targetDate = date || new Date().toISOString().split('T')[0];
            const academyId = req.user.academyId;
            const assignableStatusSql = getAssignmentSyncSourceStatusSql('s');

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
                    a.is_makeup
                FROM attendance a
                JOIN class_schedules cs ON a.class_schedule_id = cs.id
                JOIN students s
                    ON a.student_id = s.id
                    AND s.academy_id = cs.academy_id
                    AND s.deleted_at IS NULL
                    AND ${assignableStatusSql.clause}
                WHERE cs.academy_id = ? AND cs.class_date = ?
                ORDER BY cs.time_slot, s.name
            `, [...assignableStatusSql.params, academyId, targetDate]);

            const syncResult = await syncAssignments({
                academyId,
                targetDate,
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

async function syncAssignments({ academyId, targetDate, pacaStudents, existingAssignments, existingMap }) {
    const pacaStudentIds = pacaStudents.map(ps => ps.paca_student_id);
    const peakStudentMap = await getPeakStudentMap(pacaStudentIds, academyId);
    const syncPlan = buildSyncPlan(pacaStudents, existingMap, peakStudentMap, targetDate);

    if (syncPlan.studentsToInsert.length > 0) {
        await insertStudents(syncPlan.studentsToInsert, academyId, peakStudentMap);
    }
    await updateStudents(syncPlan.studentsToUpdate, academyId);
    await updateAssignments(syncPlan.assignmentsToUpdate, academyId);
    await insertAssignments(syncPlan.assignmentsToInsert, academyId, targetDate, peakStudentMap);

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
            plan.updatedCount++;
        } else {
            plan.assignmentsToInsert.push({
                pacaStudentId: ps.paca_student_id,
                timeSlot: ps.time_slot,
                attendanceId: ps.attendance_id,
                isTrial: trialSnapshot.isTrial ? 1 : 0,
                trialTotal: trialSnapshot.trialTotal,
                trialRemaining: ps.trial_remaining || 0,
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

async function insertAssignments(assignmentsToInsert, academyId, targetDate, peakStudentMap) {
    if (assignmentsToInsert.length === 0) return;

    const assignmentValues = assignmentsToInsert.map(a => [
        academyId,
        targetDate,
        a.timeSlot,
        peakStudentMap.get(a.pacaStudentId),
        a.attendanceId,
        null,
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
