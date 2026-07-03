const {
    emitStudentAttendanceBatchUpdated,
    emitStudentAttendanceUpdated,
    toAttendanceBroadcastUpdate
} = require('../../../backend/services/studentAttendanceRealtime');

function makeIo() {
    const emit = jest.fn();
    return {
        emit,
        to: jest.fn(() => ({ emit }))
    };
}

describe('student attendance realtime events', () => {
    it('broadcasts a single attendance update inside the academy room', () => {
        const io = makeIo();

        emitStudentAttendanceUpdated(io, 2, {
            paca_attendance_id: '7001',
            attendance_status: 'present'
        });

        expect(io.to).toHaveBeenCalledWith('academy-2');
        expect(io.emit).toHaveBeenCalledWith('student-attendance-updated', {
            paca_attendance_id: 7001,
            attendance_status: 'present',
            source: 'peak'
        });
    });

    it('includes row-level updates for batch attendance changes', () => {
        const io = makeIo();
        const updates = [
            toAttendanceBroadcastUpdate({ paca_attendance_id: '7001', attendance_status: 'present' }),
            toAttendanceBroadcastUpdate({ paca_attendance_id: 7002, attendance_status: 'late' })
        ];

        emitStudentAttendanceBatchUpdated(io, 2, updates);

        expect(io.to).toHaveBeenCalledWith('academy-2');
        expect(io.emit).toHaveBeenCalledWith('student-attendance-batch-updated', {
            count: 2,
            updates,
            source: 'peak'
        });
    });
});
