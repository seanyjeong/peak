function toAttendanceBroadcastUpdate(update) {
    return {
        paca_attendance_id: Number(update.paca_attendance_id),
        attendance_status: update.attendance_status
    };
}

function emitStudentAttendanceUpdated(io, academyId, update, source = 'peak') {
    if (!io || !academyId || !update?.paca_attendance_id) return;

    io.to(`academy-${academyId}`).emit('student-attendance-updated', {
        ...toAttendanceBroadcastUpdate(update),
        source
    });
}

function emitStudentAttendanceBatchUpdated(io, academyId, updates, source = 'peak') {
    if (!io || !academyId || !Array.isArray(updates) || updates.length === 0) return;

    io.to(`academy-${academyId}`).emit('student-attendance-batch-updated', {
        count: updates.length,
        updates: updates.map(toAttendanceBroadcastUpdate),
        source
    });
}

module.exports = {
    emitStudentAttendanceUpdated,
    emitStudentAttendanceBatchUpdated,
    toAttendanceBroadcastUpdate
};
