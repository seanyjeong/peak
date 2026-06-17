const ASSIGNABLE_PACA_STUDENT_STATUSES = Object.freeze(['active', 'trial']);

function isAssignablePacaStudentStatus(status) {
    return ASSIGNABLE_PACA_STUDENT_STATUSES.includes(status);
}

function getAssignablePacaStatusSql(tableAlias) {
    const placeholders = ASSIGNABLE_PACA_STUDENT_STATUSES.map(() => '?').join(', ');
    return {
        clause: `${tableAlias}.status IN (${placeholders})`,
        params: [...ASSIGNABLE_PACA_STUDENT_STATUSES],
    };
}

module.exports = {
    ASSIGNABLE_PACA_STUDENT_STATUSES,
    getAssignablePacaStatusSql,
    isAssignablePacaStudentStatus,
};
