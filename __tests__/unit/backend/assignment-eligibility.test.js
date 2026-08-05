const fs = require('fs');
const path = require('path');

const {
    ASSIGNMENT_SYNC_SOURCE_STATUSES,
    ASSIGNABLE_PACA_STUDENT_STATUSES,
    getAssignmentReadEligibilitySql,
    getAssignmentSyncSourceStatusSql,
    getAssignablePacaStatusSql,
    isAssignmentSyncEligible,
    isAssignablePacaStudentStatus,
    isTrialAssignmentSnapshot,
} = require('../../../backend/services/assignmentEligibilityService');

function source(relativePath) {
    return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('assignment eligibility', () => {
    it('allows only registered or trial PACA students into class placement', () => {
        expect(ASSIGNABLE_PACA_STUDENT_STATUSES).toEqual(['active', 'trial']);
        expect(isAssignablePacaStudentStatus('active')).toBe(true);
        expect(isAssignablePacaStudentStatus('trial')).toBe(true);
        expect(isAssignablePacaStudentStatus('pending')).toBe(false);
        expect(isAssignablePacaStudentStatus('paused')).toBe(false);
        expect(isAssignablePacaStudentStatus('withdrawn')).toBe(false);
        expect(isAssignablePacaStudentStatus('graduated')).toBe(false);
    });

    it('builds a parameterized PACA status filter for assignment queries', () => {
        expect(getAssignablePacaStatusSql('ps')).toEqual({
            clause: 'ps.status IN (?, ?)',
            params: ['active', 'trial'],
        });
    });

    it('keeps an existing trial assignment visible after PACA marks the student pending', () => {
        expect(getAssignmentReadEligibilitySql('ps', 'a')).toEqual({
            clause: '(ps.status IN (?, ?) OR (ps.status = ? AND a.is_trial = ?))',
            params: ['active', 'trial', 'pending', 1],
        });
    });

    it('reads pending rows for sync but only retains pending students with an existing trial assignment', () => {
        expect(ASSIGNMENT_SYNC_SOURCE_STATUSES).toEqual(['active', 'trial', 'pending']);
        expect(getAssignmentSyncSourceStatusSql('s')).toEqual({
            clause: 's.status IN (?, ?, ?)',
            params: ['active', 'trial', 'pending'],
        });
        expect(isAssignmentSyncEligible('active', null)).toBe(true);
        expect(isAssignmentSyncEligible('trial', null)).toBe(true);
        expect(isAssignmentSyncEligible('pending', { is_trial: 1 })).toBe(true);
        expect(isAssignmentSyncEligible('pending', { is_trial: 0 })).toBe(false);
        expect(isAssignmentSyncEligible('withdrawn', { is_trial: 1 })).toBe(false);
    });

    it('retains only rows captured as trial assignments when the PACA source is no longer assignable', () => {
        expect(isTrialAssignmentSnapshot({ is_trial: 1 })).toBe(true);
        expect(isTrialAssignmentSnapshot({ is_trial: '1' })).toBe(true);
        expect(isTrialAssignmentSnapshot({ is_trial: 0 })).toBe(false);
        expect(isTrialAssignmentSnapshot({ is_trial: null })).toBe(false);
    });

    it('applies the status filter to assignment reads and sync source reads', () => {
        const assignmentReadRoute = source('backend/routes/assignments.js');
        const assignmentSyncRoute = source('backend/routes/assignmentSyncRoutes.js');
        expect(assignmentReadRoute.match(/getAssignmentReadEligibilitySql/g)).toHaveLength(2);
        expect(assignmentSyncRoute.match(/getAssignmentSyncSourceStatusSql/g)).toHaveLength(2);
        expect(assignmentReadRoute).toContain("getAssignmentReadEligibilitySql('ps', 'a')");
        expect(assignmentSyncRoute).toContain("getAssignmentSyncSourceStatusSql('s')");
        expect(assignmentSyncRoute).toContain('isAssignmentSyncEligible(ps.student_status, existing)');
    });
});
