/**
 * 반 배치의 P-ACA 지점 구분.
 * 지점이 하나도 없는 학원은 이 기능을 쓰지 않는 학원이다 — 그때는 지점 관련 SQL 을 하나도 실행하지 않는다.
 */
const db = require('../config/database');
const pacaPool = require('../config/paca-database');

// 그 학원의 P-ACA 지점 목록. 지점 표가 아직 없는 P-ACA(배포 전)에서는 빈 목록.
async function getPacaBranches(academyId) {
    try {
        const [rows] = await pacaPool.query(
            `SELECT id, name FROM branches WHERE academy_id = ? AND status = 'active' ORDER BY sort_order, id`,
            [academyId]
        );
        return rows;
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') return [];
        throw error;
    }
}

// 요청의 지점 값: 없음 → null, 그 학원 지점 → 번호, 그 밖 → undefined(잘못된 값).
function resolveBranchId(value, branches) {
    if (value === undefined || value === null || value === '') return null;
    const id = Number(value);
    return branches.some(branch => branch.id === id) ? id : undefined;
}

// 조가 속한 지점. 지점 없는 조(또는 없는 조)는 null.
async function getClassBranchId(academyId, date, timeSlot, classNum) {
    const [rows] = await db.query(`
        SELECT branch_id FROM class_instructors
        WHERE academy_id = ? AND date = ? AND time_slot = ? AND class_num = ? AND branch_id IS NOT NULL
        LIMIT 1
    `, [academyId, date, timeSlot, classNum]);
    return rows.length > 0 ? rows[0].branch_id : null;
}

// 배치된 학생의 P-ACA 지점.
async function getAssignmentBranchId(assignmentId, academyId) {
    const [rows] = await db.query(`
        SELECT ps.branch_id
        FROM daily_assignments a
        JOIN students s ON a.student_id = s.id
        JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
        WHERE a.id = ? AND a.academy_id = ?
    `, [academyId, assignmentId, academyId]);
    return rows.length > 0 ? rows[0].branch_id : null;
}

module.exports = { getPacaBranches, resolveBranchId, getClassBranchId, getAssignmentBranchId };
