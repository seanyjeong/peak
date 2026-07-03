const {
    groupPacaBridgeEvents,
    normalizeBridgeStatus
} = require('../../../backend/services/attendanceRealtimeBridge');

describe('attendance realtime bridge', () => {
    it('groups PACA bridge events by schedule', () => {
        const events = groupPacaBridgeEvents({
            academyId: 2,
            rows: [
                { id: 10, student_id: 100, class_schedule_id: 3, class_date: '2026-07-03' },
                { id: 11, student_id: 101, class_schedule_id: 3, class_date: '2026-07-03' },
                { id: 12, student_id: 102, class_schedule_id: 4, class_date: '2026-07-04' }
            ],
            updatesById: new Map([
                [10, 'present'],
                [11, 'late'],
                [12, 'none']
            ])
        });

        expect(events).toEqual([
            {
                source: 'peak',
                academy_id: 2,
                schedule_id: 3,
                class_date: '2026-07-03',
                records: [
                    { student_id: 100, attendance_status: 'present' },
                    { student_id: 101, attendance_status: 'late' }
                ]
            },
            {
                source: 'peak',
                academy_id: 2,
                schedule_id: 4,
                class_date: '2026-07-04',
                records: [
                    { student_id: 102, attendance_status: null }
                ]
            }
        ]);
    });

    it('normalizes invalid bridge statuses to unchecked', () => {
        expect(normalizeBridgeStatus('present')).toBe('present');
        expect(normalizeBridgeStatus('none')).toBeNull();
        expect(normalizeBridgeStatus('wrong')).toBeNull();
    });

    it('does not bridge rows that were not actually updated', () => {
        const events = groupPacaBridgeEvents({
            academyId: 2,
            rows: [
                { id: 10, student_id: 100, class_schedule_id: 3, class_date: '2026-07-03' },
                { id: 11, student_id: 101, class_schedule_id: 3, class_date: '2026-07-03' }
            ],
            updatesById: new Map([[10, 'present']])
        });

        expect(events[0].records).toEqual([
            { student_id: 100, attendance_status: 'present' }
        ]);
    });
});
