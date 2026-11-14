jest.mock('../../../backend/config/database', () => ({ query: jest.fn() }));
jest.mock('../../../backend/middleware/auth', () => ({
    verifyToken: (req, _res, next) => {
        req.user = { academyId: 1, role: 'owner' };
        next();
    },
}));
jest.mock('../../../backend/utils/feature-permissions', () => ({
    requireFeaturePermission: () => (_req, _res, next) => next(),
}));

const express = require('express');
const http = require('http');
const db = require('../../../backend/config/database');

// 기존 테스트(training-log-update)와 같은 방식: 임시 포트에 띄워 한 번 호출한다.
async function send(method, path, payload) {
    const app = express();
    app.use(express.json());
    app.use('/peak/record-types', require('../../../backend/routes/recordTypes'));
    const server = app.listen(0, '127.0.0.1');
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

const base = { name: 'QA-범위종목', unit: 'cm', direction: 'higher', is_active: 1, display_order: 0 };

beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue([{ affectedRows: 1, insertId: 183 }]);
});

describe('측정 종목 최소·최대 범위', () => {
    it('추가할 때 최소값이 최대값보다 크면 저장하지 않고 400', async () => {
        const res = await send('POST', '/peak/record-types', { ...base, min_value: 600, max_value: 500 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('최소값은 최대값보다 클 수 없습니다.');
        expect(db.query).not.toHaveBeenCalled();
    });

    it('수정할 때 최소값이 최대값보다 크면 저장하지 않고 400', async () => {
        const res = await send('PUT', '/peak/record-types/183', { ...base, min_value: 600, max_value: 500 });

        expect(res.status).toBe(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('DB 에서 온 문자열 값도 숫자로 비교한다', async () => {
        const res = await send('PUT', '/peak/record-types/183', { ...base, min_value: '90.00', max_value: '100.00' });

        expect(res.status).toBe(200);
    });

    it('최소=최대, 한쪽만 있음, 음수 최소(좌전굴 등)는 그대로 저장한다', async () => {
        for (const range of [
            { min_value: 500, max_value: 500 },
            { min_value: 600, max_value: null },
            { min_value: null, max_value: 500 },
            { min_value: -20, max_value: 40 },
        ]) {
            const res = await send('PUT', '/peak/record-types/183', { ...base, ...range });
            expect(res.status).toBe(200);
        }
    });
});
