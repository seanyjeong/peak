const fs = require('fs');
const path = require('path');

const {
    ASSIGNABLE_PACA_STUDENT_STATUSES,
    getAssignablePacaStatusSql,
    isAssignablePacaStudentStatus,
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

    it('applies the status filter to assignment reads and sync source reads', () => {
        const assignmentReadRoute = source('backend/routes/assignments.js');
        const assignmentSyncRoute = source('backend/routes/assignmentSyncRoutes.js');
        const routeSources = `${assignmentReadRoute}\n${assignmentSyncRoute}`;

        expect(routeSources.match(/getAssignablePacaStatusSql/g)).toHaveLength(4);
        expect(assignmentReadRoute).toContain("getAssignablePacaStatusSql('ps')");
        expect(assignmentSyncRoute).toContain("getAssignablePacaStatusSql('s')");
    });
});
