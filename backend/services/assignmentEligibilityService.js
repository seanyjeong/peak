const {
    ASSIGNABLE_PACA_STUDENT_STATUSES,
    ASSIGNMENT_SYNC_SOURCE_STATUSES,
    COMPLETED_TRIAL_PACA_STATUS,
    DEFAULT_TRIAL_TOTAL,
    TRIAL_ASSIGNMENT_FLAG,
} = require('../constants/assignment');

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
        params: [...assignable.params, COMPLETED_TRIAL_PACA_STATUS, TRIAL_ASSIGNMENT_FLAG],
    };
}

function isTrialAssignmentSnapshot(assignment) {
    return Number(assignment?.is_trial) === TRIAL_ASSIGNMENT_FLAG;
}

function isAssignmentSyncEligible(studentStatus, existingAssignment, trialSnapshot) {
    if (isAssignablePacaStudentStatus(studentStatus)) return true;
    if (studentStatus !== COMPLETED_TRIAL_PACA_STATUS) return false;
    return isTrialAssignmentSnapshot(existingAssignment) || Boolean(trialSnapshot?.isTrial);
}

function getTrialAssignmentSnapshot(student, targetDate) {
    const trialDates = parseTrialDates(student.trial_dates);
    const hasMatchingTrialDate = trialDates.some((trialDate) => {
        const date = typeof trialDate === 'string' ? trialDate : trialDate?.date;
        const timeSlot = typeof trialDate === 'string' ? null : trialDate?.time_slot;
        return date === targetDate && (!timeSlot || timeSlot === student.time_slot);
    });
    const isCompletedTrial = student.student_status === COMPLETED_TRIAL_PACA_STATUS
        && Boolean(student.attendance_status)
        && hasMatchingTrialDate;
    const isTrial = Boolean(student.is_trial) || isCompletedTrial;

    return {
        isTrial,
        trialTotal: isTrial ? (trialDates.length || DEFAULT_TRIAL_TOTAL) : 0,
    };
}

function parseTrialDates(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

module.exports = {
    ASSIGNMENT_SYNC_SOURCE_STATUSES,
    ASSIGNABLE_PACA_STUDENT_STATUSES,
    getAssignmentReadEligibilitySql,
    getAssignmentSyncSourceStatusSql,
    getTrialAssignmentSnapshot,
    getAssignablePacaStatusSql,
    isAssignmentSyncEligible,
    isAssignablePacaStudentStatus,
    isTrialAssignmentSnapshot,
};
