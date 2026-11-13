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

    it('이동: 다른 지점의 조로는 옮길 수 없고, 같은 지점 조로는 옮긴다', async () => {
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
});
