const axios = require('axios');

const VALID_STATUSES = new Set(['present', 'absent', 'late', 'excused', 'makeup']);

function requireBridgeKey(req, res, next) {
    const expected = process.env.ATTENDANCE_REALTIME_BRIDGE_KEY;
    if (!expected) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: '실시간 브리지 키가 설정되지 않았습니다.'
        });
    }

    if (req.headers['x-internal-key'] !== expected) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: '인증되지 않은 내부 요청입니다.'
        });
    }

    next();
}

function normalizeBridgeStatus(status) {
    if (!status || status === 'none') return null;
    return VALID_STATUSES.has(status) ? status : null;
}

function groupPacaBridgeEvents({ academyId, source = 'peak', rows, updatesById }) {
    const events = new Map();

    rows.forEach((row) => {
        const rowId = Number(row.id);
        if (!updatesById.has(rowId)) return;

        const status = normalizeBridgeStatus(updatesById.get(rowId));
        const scheduleId = Number(row.class_schedule_id);
        if (!scheduleId) return;

        if (!events.has(scheduleId)) {
            events.set(scheduleId, {
                source,
                academy_id: Number(academyId),
                schedule_id: scheduleId,
                class_date: row.class_date || null,
                records: []
            });
        }

        events.get(scheduleId).records.push({
            student_id: Number(row.student_id),
            attendance_status: status
        });
    });

    return Array.from(events.values()).filter((event) => event.records.length > 0);
}

async function postPacaBridgeEvent(
    event,
    {
        url = process.env.PACA_ATTENDANCE_EVENT_URL,
        key = process.env.ATTENDANCE_REALTIME_BRIDGE_KEY
    } = {}
) {
    if (!url || !key) return { sent: false };

    await axios.post(url, event, {
        timeout: 2500,
        headers: { 'x-internal-key': key }
    });
    return { sent: true };
}

function postPacaBridgeEvents(events, logger = console) {
    events.forEach((event) => {
        postPacaBridgeEvent(event).catch((error) => {
            logger.warn('[AttendanceRealtime] paca bridge failed', { error: error.message });
        });
    });
}

module.exports = {
    groupPacaBridgeEvents,
    normalizeBridgeStatus,
    postPacaBridgeEvent,
    postPacaBridgeEvents,
    requireBridgeKey
};
