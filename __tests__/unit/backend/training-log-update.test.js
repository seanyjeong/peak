jest.mock('../../../backend/config/database', () => ({ query: jest.fn() }));
jest.mock('../../../backend/middleware/auth', () => ({
    verifyToken: (req, _res, next) => {
        req.user = { academyId: 2 };
        next();
    },
}));

const express = require('express');
const http = require('http');
const db = require('../../../backend/config/database');

// 기존 테스트(assignment-sync-retention)와 같은 방식: 임시 포트에 띄워 한 번 호출한다.
async function put(path, payload) {
    const app = express();
    app.use(express.json());
    app.use('/peak/training', require('../../../backend/routes/training'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        return await new Promise((resolve, reject) => {
            const body = JSON.stringify(payload);
            const req = http.request({
                hostname: '127.0.0.1', port: server.address().port, path, method: 'PUT',
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

beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue([{ affectedRows: 1 }]);
});

describe('수업 기록 수정은 보낸 칸만 바꾼다', () => {
    it('컨디션만 보내면 메모·온습도는 건드리지 않는다', async () => {
        const res = await put('/peak/training/553', { condition_score: 3 });

        expect(res.status).toBe(200);
        expect(db.query).toHaveBeenCalledWith(
            'UPDATE training_logs SET condition_score = ? WHERE id = ? AND academy_id = ?',
            [3, '553', 2]
        );
    });

    it('메모만 보내면 컨디션은 건드리지 않는다', async () => {
        await put('/peak/training/553', { notes: '메모' });

        expect(db.query.mock.calls[0][0]).toBe('UPDATE training_logs SET notes = ? WHERE id = ? AND academy_id = ?');
    });

    it('PC 처럼 컨디션과 메모를 같이 보내면 둘 다 바꾸고, 온습도는 그대로 둔다', async () => {
        await put('/peak/training/553', { condition_score: null, notes: '' });

        expect(db.query).toHaveBeenCalledWith(
            'UPDATE training_logs SET condition_score = ?, notes = ? WHERE id = ? AND academy_id = ?',
            [null, '', '553', 2]
        );
    });

    it('바꿀 칸이 없으면 DB 를 건드리지 않고 400', async () => {
        const res = await put('/peak/training/553', {});

        expect(res.status).toBe(400);
        expect(db.query).not.toHaveBeenCalled();
    });
});
