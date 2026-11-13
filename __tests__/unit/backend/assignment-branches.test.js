jest.mock('../../../backend/config/database', () => ({ query: jest.fn() }));
jest.mock('../../../backend/config/paca-database', () => ({ query: jest.fn() }));
jest.mock('../../../backend/middleware/auth', () => ({
    verifyToken: (req, _res, next) => {
        req.user = { academyId: 2 };
        next();
    },
}));
jest.mock('../../../backend/utils/encryption', () => ({ decrypt: (value) => value }));

const express = require('express');
const http = require('http');
const peakDb = require('../../../backend/config/database');
const pacaDb = require('../../../backend/config/paca-database');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/peak/assignments', require('../../../backend/routes/assignments'));
    app.use('/peak/presets', (req, _res, next) => { req.user = { academyId: 2 }; next(); }, require('../../../backend/routes/presets'));
    app.use('/peak/attendance', require('../../../backend/routes/attendance'));
    app.use('/peak/mobile', (req, _res, next) => { req.user = { academyId: 2, id: 1, role: 'owner' }; next(); }, require('../../../backend/routes/mobile'));
    return app;
}

// 기존 테스트(assignment-sync-retention)와 같은 방식: 임시 포트에 띄워 한 번 호출한다.
async function call(method, path, payload) {
    const server = makeApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        return await new Promise((resolve, reject) => {
            const body = JSON.stringify(payload);
            const req = http.request({
                hostname: '127.0.0.1', port: server.address().port, path, method,
                headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
            }, (response) => {
                let text = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => { text += chunk; });
                response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
            });
            req.on('error', reject);
            req.end(body);
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

const branches = [{ id: 1, name: '수성' }, { id: 2, name: '칠곡' }];
const pacaStudent = {
    attendance_id: 900, paca_student_id: 50, student_name: '가', gender: 'male', school: null, grade: '고3',
    is_trial: 0, trial_remaining: 0, trial_dates: null, student_status: 'active', time_slot: 'evening',
    attendance_status: null, is_makeup: 0, branch_id: 1, paca_class_id: 3, class_instructor_id: 7,
};

beforeEach(() => {
    peakDb.query.mockReset();
    pacaDb.query.mockReset();
});

describe('지점별 반 배치', () => {
    it('동기화: 반 담당 강사가 그 시간대에 근무하면 그 반의 조를 만들고 새 학생을 넣는다', async () => {
        pacaDb.query
            .mockResolvedValueOnce([branches])
            .mockResolvedValueOnce([[pacaStudent]])
            .mockResolvedValueOnce([[{ instructor_id: 7, time_slot: 'evening' }]]);
        peakDb.query
            .mockResolvedValueOnce([[]])                                  // 그날 기존 배치
            .mockResolvedValueOnce([[{ id: 500, paca_student_id: 50 }]])  // 피크 학생
            .mockResolvedValueOnce([{ affectedRows: 1 }])                 // 학생 정보 갱신
            .mockResolvedValueOnce([[{ time_slot: 'evening', class_num: 1, instructor_id: 9, paca_class_id: null }]])
            .mockResolvedValue([{ affectedRows: 1 }]);

        const res = await call('POST', '/peak/assignments/sync', { date: '2026-11-13' });

        expect(res.status).toBe(200);
        expect(pacaDb.query.mock.calls[1][0]).toContain('c.instructor_id as class_instructor_id');
        const classInsert = peakDb.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO class_instructors'));
        expect(classInsert[1]).toEqual([2, '2026-11-13', 'evening', 2, 7, 1, 3]);
        const assignmentInsert = peakDb.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO daily_assignments'));
        expect(assignmentInsert[1][0][0][5]).toBe(2);
    });

    it('동기화: 담당 강사가 근무하지 않으면 조를 만들지 않고 대기로 둔다', async () => {
        pacaDb.query
            .mockResolvedValueOnce([branches])
            .mockResolvedValueOnce([[pacaStudent]])
            .mockResolvedValueOnce([[]]);
        peakDb.query
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[{ id: 500, paca_student_id: 50 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[]])
            .mockResolvedValue([{ affectedRows: 1 }]);

        await call('POST', '/peak/assignments/sync', { date: '2026-11-13' });

        expect(peakDb.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO class_instructors'))).toBe(false);
        const assignmentInsert = peakDb.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO daily_assignments'));
        expect(assignmentInsert[1][0][0][5]).toBeNull();
    });

    it('동기화: 지점이 없는 학원은 지점 관련 조회를 하지 않는다', async () => {
        pacaDb.query
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[{ ...pacaStudent, branch_id: undefined, paca_class_id: undefined, class_instructor_id: undefined }]]);
        peakDb.query
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[{ id: 500, paca_student_id: 50 }]])
            .mockResolvedValue([{ affectedRows: 1 }]);

        await call('POST', '/peak/assignments/sync', { date: '2026-11-13' });

        expect(pacaDb.query).toHaveBeenCalledTimes(2);
        expect(pacaDb.query.mock.calls[1][0]).not.toContain('branch_id');
        expect(peakDb.query.mock.calls.some(([sql]) => sql.includes('class_instructors'))).toBe(false);
    });

    it('동기화: P-ACA 에서 지점을 옮긴 학생이 옛 지점 조에 있으면 대기로 돌리고, 지점 없는 조는 그대로 둔다', async () => {
        const moved = { ...pacaStudent, branch_id: 2 };
        const other = { ...pacaStudent, attendance_id: 901, paca_student_id: 51 };
        pacaDb.query
            .mockResolvedValueOnce([branches])
            .mockResolvedValueOnce([[moved, other]]);
        peakDb.query
            .mockResolvedValueOnce([[
                { id: 10, student_id: 500, time_slot: 'evening', class_id: 1, paca_attendance_id: 900, is_trial: 0 },
                { id: 11, student_id: 501, time_slot: 'evening', class_id: 3, paca_attendance_id: 901, is_trial: 0 },
            ]])
            .mockResolvedValueOnce([[{ id: 500, paca_student_id: 50 }, { id: 501, paca_student_id: 51 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ time_slot: 'evening', class_num: 1, branch_id: 1 }]]) // 3번 조는 지점 없음
            .mockResolvedValue([{ affectedRows: 1 }]);

        const res = await call('POST', '/peak/assignments/sync', { date: '2026-11-13' });

        expect(res.status).toBe(200);
        const released = peakDb.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE daily_assignments SET class_id = NULL'));
        expect(released.map(([, params]) => params)).toEqual([[10, 2]]);
    });

    it('이동: 다른 지점의 조로는 옮길 수 없고, 같은 지점 조로는 옮긴다', async () => {
        pacaDb.query.mockResolvedValue([branches]);
        peakDb.query
            .mockResolvedValueOnce([[{ date: '2026-11-13', time_slot: 'evening' }]])
            .mockResolvedValueOnce([[{ branch_id: 2 }]])   // 조의 지점
            .mockResolvedValueOnce([[{ branch_id: 1 }]]);  // 학생의 지점
        const blocked = await call('PUT', '/peak/assignments/10', { class_id: 4 });
        expect(blocked.status).toBe(400);
        expect(blocked.body.error).toBe('다른 지점의 반으로는 옮길 수 없습니다.');
        expect(peakDb.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE daily_assignments'))).toBe(false);

        peakDb.query.mockReset();
        peakDb.query
            .mockResolvedValueOnce([[{ date: '2026-11-13', time_slot: 'evening' }]])
            .mockResolvedValueOnce([[{ branch_id: 1 }]])
            .mockResolvedValueOnce([[{ branch_id: 1 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        expect((await call('PUT', '/peak/assignments/10', { class_id: 4 })).status).toBe(200);
    });

    it('이동: 지점에 묶이지 않은 조는 지금처럼 누구나 들어간다', async () => {
        peakDb.query
            .mockResolvedValueOnce([[{ date: '2026-11-13', time_slot: 'evening' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        expect((await call('PUT', '/peak/assignments/10', { class_id: 4 })).status).toBe(200);
        expect(peakDb.query).toHaveBeenCalledTimes(3);
    });

    it('프리셋: 지점 프리셋은 그 지점의 조만 지우고, 남은 조 번호 다음부터 그 지점 조를 만든다', async () => {
        peakDb.query
            .mockResolvedValueOnce([[{ id: 5, academy_id: 2, branch_id: 1 }]])                 // 프리셋
            .mockResolvedValueOnce([[{ id: 50, instructor_id: 7 }]])                           // 그룹
            .mockResolvedValueOnce([[{ student_id: 500 }, { student_id: 600 }]])               // 그룹 학생 (600 은 다른 지점)
            .mockResolvedValueOnce([[{ id: 10, student_id: 500 }, { id: 11, student_id: 600 }]]) // 그날 전체 학생
            .mockResolvedValueOnce([[{ id: 10, student_id: 500 }]])                            // 그 지점 학생
            .mockResolvedValueOnce([{ affectedRows: 1 }])                                      // 그 지점 조 삭제
            .mockResolvedValueOnce([{ affectedRows: 1 }])                                      // 그 지점 학생 대기로
            .mockResolvedValueOnce([[{ max_num: 2 }]])                                         // 남은 조 번호
            .mockResolvedValueOnce([[{ instructor_id: 9 }]])                                   // 다른 조에 있는 강사
            .mockResolvedValue([{ affectedRows: 1 }]);
        pacaDb.query
            .mockResolvedValueOnce([[{ id: 7 }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([branches]);

        const res = await call('POST', '/peak/presets/5/apply', { date: '2026-11-13', time_slot: 'evening' });

        expect(res.body.result).toMatchObject({ classes_created: 1, students_assigned: 1 });
        const sqls = peakDb.query.mock.calls.map(([sql]) => sql);
        const deletes = sqls.filter(sql => sql.startsWith('DELETE FROM class_instructors'));
        expect(deletes).toHaveLength(1);
        expect(deletes[0]).toContain('branch_id = ?');
        const classInsert = peakDb.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO class_instructors'));
        expect(classInsert[1]).toEqual([2, '2026-11-13', 'evening', 3, 7, 1]);
        const moved = peakDb.query.mock.calls.filter(([sql]) => sql === 'UPDATE daily_assignments SET class_id = ? WHERE id = ?');
        expect(moved.map(([, params]) => params)).toEqual([[3, 10]]);
    });

    it('프리셋: 다른 지점 조에 이미 들어간 강사의 그룹은 만들지 않고 학생을 대기로 둔다', async () => {
        peakDb.query
            .mockResolvedValueOnce([[{ id: 5, academy_id: 2, branch_id: 1 }]])
            .mockResolvedValueOnce([[{ id: 50, instructor_id: 7 }]])
            .mockResolvedValueOnce([[{ student_id: 500 }]])
            .mockResolvedValueOnce([[{ id: 10, student_id: 500 }]])
            .mockResolvedValueOnce([[{ id: 10, student_id: 500 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ max_num: 2 }]])
            .mockResolvedValueOnce([[{ instructor_id: 7 }]])                                   // 7 은 다른 지점 조에 있음
            .mockResolvedValue([{ affectedRows: 1 }]);
        pacaDb.query
            .mockResolvedValueOnce([[{ id: 7 }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([branches]);

        const res = await call('POST', '/peak/presets/5/apply', { date: '2026-11-13', time_slot: 'evening' });

        expect(res.body.result).toMatchObject({ classes_created: 0, students_assigned: 0, instructors_absent: 1 });
        expect(peakDb.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO class_instructors'))).toBe(false);
    });

    it('지운 지점: 그 지점을 가리키는 조는 지점 없는 조처럼 누구나 들어간다', async () => {
        pacaDb.query.mockResolvedValue([branches]);
        peakDb.query
            .mockResolvedValueOnce([[{ date: '2026-11-13', time_slot: 'evening' }]])
            .mockResolvedValueOnce([[{ branch_id: 12 }]])   // P-ACA 에서 지운 지점
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        expect((await call('PUT', '/peak/assignments/10', { class_id: 4 })).status).toBe(200);
    });

    it('지운 지점: 동기화는 그 지점 조에 있는 학생을 옮긴 학생으로 보지 않는다', async () => {
        pacaDb.query
            .mockResolvedValueOnce([branches])
            .mockResolvedValueOnce([[pacaStudent]]);
        peakDb.query
            .mockResolvedValueOnce([[{ id: 10, student_id: 500, time_slot: 'evening', class_id: 1, paca_attendance_id: 900, is_trial: 0 }]])
            .mockResolvedValueOnce([[{ id: 500, paca_student_id: 50 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])                                  // 학생 정보 갱신
            .mockResolvedValueOnce([{ affectedRows: 1 }])                                  // 배치 갱신
            .mockResolvedValueOnce([[{ time_slot: 'evening', class_num: 1, branch_id: 12 }]]) // 지운 지점의 조
            .mockResolvedValue([{ affectedRows: 1 }]);

        expect((await call('POST', '/peak/assignments/sync', { date: '2026-11-13' })).status).toBe(200);
        expect(peakDb.query.mock.calls.some(([sql]) => sql.includes('SELECT DISTINCT time_slot, class_num, branch_id'))).toBe(true);
        expect(peakDb.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE daily_assignments SET class_id = NULL'))).toBe(false);
    });

    it('지운 지점: 그 지점 프리셋은 목록에서 지점 없음(전체)으로 나오고, 적용은 전체 프리셋처럼 한다', async () => {
        pacaDb.query.mockResolvedValue([branches]);
        peakDb.query
            .mockResolvedValueOnce([[{ id: 5, branch_id: 12 }, { id: 6, branch_id: 2 }]])
            .mockResolvedValue([[]]);
        const list = await call('GET', '/peak/presets', {});
        expect(list.body.presets.map(preset => preset.branch_id)).toEqual([null, 2]);

        peakDb.query.mockReset();
        pacaDb.query.mockReset();
        peakDb.query
            .mockResolvedValueOnce([[{ id: 5, academy_id: 2, branch_id: 12 }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValue([{ affectedRows: 1 }]);
        pacaDb.query
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([branches]);
        expect((await call('POST', '/peak/presets/5/apply', { date: '2026-11-13', time_slot: 'evening' })).status).toBe(200);
        const deletes = peakDb.query.mock.calls.filter(([sql]) => sql.startsWith('DELETE FROM class_instructors'));
        expect(deletes).toHaveLength(1);
        expect(deletes[0][0]).not.toContain('branch_id');
    });

    it('학생 출석: 지점을 주면 그 지점 학생만 읽고, 없는 지점은 거절한다', async () => {
        pacaDb.query.mockResolvedValueOnce([branches]);
        peakDb.query.mockResolvedValueOnce([[]]);
        const res = await call('GET', '/peak/attendance/students?date=2026-11-14&branch_id=2', {});
        expect(res.status).toBe(200);
        expect(res.body.branches).toEqual(branches);
        expect(peakDb.query.mock.calls[0][0]).toContain('AND ps.branch_id = ?');
        expect(peakDb.query.mock.calls[0][1]).toEqual([2, 2, '2026-11-14', 2]);

        pacaDb.query.mockReset();
        pacaDb.query.mockResolvedValueOnce([branches]);
        expect((await call('GET', '/peak/attendance/students?date=2026-11-14&branch_id=99', {})).status).toBe(400);
    });
    it('모바일 내 수업: 지점을 주면 그 지점 학생만 읽고, 지점 없는 요청은 그대로, 없는 지점은 거절한다', async () => {
        pacaDb.query.mockResolvedValueOnce([branches]);
        peakDb.query.mockResolvedValue([[]]);
        const res = await call('GET', '/peak/mobile/my-class?date=2026-11-14&branch_id=2', {});
        expect(res.status).toBe(200);
        expect(res.body.branches).toEqual(branches);
        const studentsSql = peakDb.query.mock.calls.find(([sql]) => sql.includes('FROM daily_assignments'));
        expect(studentsSql[0]).toContain('AND ps.branch_id = ?');
        expect(studentsSql[1]).toEqual([2, 2, '2026-11-14', 2]);

        peakDb.query.mockClear();
        pacaDb.query.mockResolvedValueOnce([branches]);
        await call('GET', '/peak/mobile/my-class?date=2026-11-14', {});
        const allSql = peakDb.query.mock.calls.find(([sql]) => sql.includes('FROM daily_assignments'));
        expect(allSql[0]).not.toContain('ps.branch_id');
        expect(allSql[1]).toEqual([2, 2, '2026-11-14']);

        pacaDb.query.mockResolvedValueOnce([branches]);
        expect((await call('GET', '/peak/mobile/my-class?date=2026-11-14&branch_id=99', {})).status).toBe(400);
    });
});
