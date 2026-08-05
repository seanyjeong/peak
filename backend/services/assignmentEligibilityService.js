const ASSIGNABLE_PACA_STUDENT_STATUSES = Object.freeze(['active', 'trial']);
const PACA_PENDING_STATUS = 'pending';
const ASSIGNMENT_SYNC_SOURCE_STATUSES = Object.freeze([
    ...ASSIGNABLE_PACA_STUDENT_STATUSES,
    PACA_PENDING_STATUS,
]);
const TRIAL_ASSIGNMENT_FLAG = 1;

function isAssignablePacaStudentStatus(status) {
    return ASSIGNABLE_PACA_STUDENT_STATUSES.includes(status);
}

function getAssignablePacaStatusSql(tableAlias) {
    return getPacaStatusSql(tableAlias, ASSIGNABLE_PACA_STUDENT_STATUSES);
}

function getAssignmentSyncSourceStatusSql(tableAlias) {
    return getPacaStatusSql(tableAlias, ASSIGNMENT_SYNC_SOURCE_STATUSES);
}

function getPacaStatusSql(tableAlias, statuses) {
    const placeholders = statuses.map(() => '?').join(', ');
    return {
        clause: `${tableAlias}.status IN (${placeholders})`,
        params: [...statuses],
    };
}

function getAssignmentReadEligibilitySql(studentAlias, assignmentAlias) {
    const assignable = getAssignablePacaStatusSql(studentAlias);
    return {
        clause: `(${assignable.clause} OR (${studentAlias}.status = ? AND ${assignmentAlias}.is_trial = ?))`,
        params: [...assignable.params, PACA_PENDING_STATUS, TRIAL_ASSIGNMENT_FLAG],
    };
}

function isTrialAssignmentSnapshot(assignment) {
    return Number(assignment?.is_trial) === TRIAL_ASSIGNMENT_FLAG;
}

function isAssignmentSyncEligible(studentStatus, existingAssignment) {
    return isAssignablePacaStudentStatus(studentStatus)
        || (studentStatus === PACA_PENDING_STATUS && isTrialAssignmentSnapshot(existingAssignment));
}

module.exports = {
    ASSIGNMENT_SYNC_SOURCE_STATUSES,
    ASSIGNABLE_PACA_STUDENT_STATUSES,
    getAssignmentReadEligibilitySql,
    getAssignmentSyncSourceStatusSql,
    getAssignablePacaStatusSql,
    isAssignmentSyncEligible,
    isAssignablePacaStudentStatus,
    isTrialAssignmentSnapshot,
};
