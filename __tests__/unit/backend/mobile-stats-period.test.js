jest.mock('../../../backend/config/database', () => ({ query: jest.fn() }));
jest.mock('../../../backend/config/paca-database', () => ({ query: jest.fn() }));

const express = require('express');
const http = require('http');
const db = require('../../../backend/config/database');
const pacaPool = require('../../../backend/config/paca-database');

// 기존 테스트(training-log-update)와 같은 방식: 임시 포트에 띄워 한 번 호출한다.
async function get(path) {
    const app = express();
    app.use((req, _res, next) => {
        req.user = { academyId: 1, role: 'owner' };
        next();
    });
    app.use('/peak/mobile', require('../../../backend/routes/mobile'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        return await new Promise((resolve, reject) => {
            http.get({ hostname: '127.0.0.1', port: server.address().port, path }, (response) => {
                let text = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => { text += chunk; });
                response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
            }).on('error', reject);
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

// Date 만 고정한다(서버·소켓 타이머는 그대로).
function setNow(iso) {
    jest.useFakeTimers({
        now: new Date(iso),
        doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout',
            'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
    });
}

beforeEach(() => {
    db.query.mockReset();
    pacaPool.query.mockReset();
    db.query.mockResolvedValue([[]]);
    pacaPool.query.mockResolvedValue([[]]);
});

afterEach(() => {
    jest.useRealTimers();
});

describe('모바일 통계 기간은 한국 날짜로 오늘까지 포함한다', () => {
    it('새벽(01:41 KST)의 이번 주는 월요일부터 오늘까지다', async () => {
        setNow('2026-11-13T16:41:00Z'); // 2026-11-14(토) 01:41 KST

        const res = await get('/peak/mobile/stats?period=week');

        expect(res.status).toBe(200);
        expect(res.body.startDate).toBe('2026-11-09');
        expect(res.body.endDate).toBe('2026-11-14');
        expect(db.query.mock.calls[0][1]).toEqual([1, '2026-11-09', '2026-11-14']);
        expect(pacaPool.query.mock.calls[0][1]).toEqual([1, '2026-11-09', '2026-11-14']);
    });

    it('새벽의 이번 달은 1일부터 오늘까지다(전달 마지막 날이 섞이지 않음)', async () => {
        setNow('2026-11-13T16:41:00Z');

        const res = await get('/peak/mobile/stats?period=month');

        expect(res.body.startDate).toBe('2026-11-01');
        expect(res.body.endDate).toBe('2026-11-14');
    });

    it('일요일의 이번 주는 그 주 월요일부터다', async () => {
        setNow('2026-11-15T03:00:00Z'); // 2026-11-15(일) 12:00 KST

        const res = await get('/peak/mobile/stats');

        expect(res.body.startDate).toBe('2026-11-09');
        expect(res.body.endDate).toBe('2026-11-15');
    });
});
