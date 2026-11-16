// 전광판 테마(1~5): 설정 저장, 설정 읽기, 공개 전광판 응답
jest.mock('../../../backend/config/database', () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock('../../../backend/utils/feature-permissions', () => ({
    requireFeaturePermission: () => (_req, _res, next) => next(),
}));

const express = require('express');
const http = require('http');
const pool = require('../../../backend/config/database');
const {
    normalizeBoardTheme,
    serializePeakSettings,
    toBoardAcademy,
} = require('../../../backend/utils/peak-settings');

async function request(app, method, path, payload) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    try {
        return await new Promise((resolve, reject) => {
            const body = payload ? JSON.stringify(payload) : '';
            const req = http.request({
                hostname: '127.0.0.1',
                port: address.port,
                path,
                method,
                headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
            }, (response) => {
                let responseBody = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => { responseBody += chunk; });
                response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(responseBody) }));
            });
            req.on('error', reject);
            req.end(body);
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

function settingsApp() {
    const router = require('../../../backend/routes/peakSettings');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user = { academyId: 2, role: 'owner' };
        next();
    });
    app.use('/settings', router);
    return app;
}

describe('전광판 테마 값', () => {
    it('1~5 만 그대로 두고 나머지는 1(스포츠 중계)로 본다', () => {
        expect([1, 2, 3, 4, 5].map(normalizeBoardTheme)).toEqual([1, 2, 3, 4, 5]);
        expect([0, 6, null, undefined, 'x', '3'].map(normalizeBoardTheme)).toEqual([1, 1, 1, 1, 1, 3]);
    });

    it('설정이 없는 학원도 테마 1 로 읽힌다', () => {
        expect(serializePeakSettings(null, 7).board_theme).toBe(1);
    });

    it('공개 전광판 학원 정보에 테마가 실린다 (PIN 해시는 설정 응답에 안 실린다)', () => {
        const row = { academy_id: 2, slug: 'ilsanmax', academy_name: '일산', board_pin_hash: 'hash', board_theme: 4 };
        expect(toBoardAcademy(row).theme).toBe(4);
        const serialized = serializePeakSettings(row, 2);
        expect(serialized.board_theme).toBe(4);
        expect(serialized.board_pin_hash).toBeUndefined();
    });
});

describe('PATCH /settings/board-theme', () => {
    beforeEach(() => {
        pool.query.mockReset();
    });

    it('학원 행의 테마만 바꾸고 대표 행 순서(updated_at)는 그대로 둔다', async () => {
        pool.query
            .mockResolvedValueOnce([[{ id: 5, academy_id: 2, slug: 'ilsanmax', academy_name: '일산', board_theme: 1 }]])
            .mockResolvedValueOnce([{ affectedRows: 2 }]);

        const response = await request(settingsApp(), 'PATCH', '/settings/board-theme', { board_theme: 3 });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true, board_theme: 3 });
        const [sql, params] = pool.query.mock.calls[1];
        expect(sql).toContain('SET board_theme = ?, updated_at = updated_at WHERE academy_id = ?');
        expect(params).toEqual([3, 2]);
    });

    it.each([0, 6, 'abc', null])('없는 테마(%p)는 400 으로 거절하고 DB 를 건드리지 않는다', async (value) => {
        const response = await request(settingsApp(), 'PATCH', '/settings/board-theme', { board_theme: value });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('전광판 테마를 다시 골라주세요.');
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('전광판 주소가 없으면 저장하지 않는다', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(settingsApp(), 'PATCH', '/settings/board-theme', { board_theme: 2 });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('전광판 주소를 먼저 저장해주세요.');
        expect(pool.query).toHaveBeenCalledTimes(1);
    });
});
