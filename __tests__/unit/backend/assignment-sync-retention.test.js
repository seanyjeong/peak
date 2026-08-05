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
const registerAssignmentSyncRoutes = require('../../../backend/routes/assignmentSyncRoutes');

function makeApp() {
    const app = express();
    const router = express.Router();
    app.use(express.json());
    registerAssignmentSyncRoutes(router);
    app.use('/peak/assignments', router);
    return app;
}

async function postJson(app, path, payload) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();

    try {
        return await new Promise((resolve, reject) => {
            const body = JSON.stringify(payload);
            const request = http.request({
                hostname: '127.0.0.1',
                port: address.port,
                path,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(body),
                },
            }, (response) => {
                let responseBody = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => { responseBody += chunk; });
                response.on('end', () => resolve({
                    status: response.statusCode,
                    body: JSON.parse(responseBody),
                }));
            });
            request.on('error', reject);
            request.end(body);
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

beforeEach(() => {
    peakDb.query.mockReset();
    pacaDb.query.mockReset();
});

describe('POST /peak/assignments/sync trial retention', () => {
    it('preserves an existing trial row while removing an unrelated missing regular row', async () => {
        peakDb.query
            .mockResolvedValueOnce([[
                {
                    id: 8649,
                    student_id: 140199,
                    time_slot: 'evening',
                    class_id: 4,
                    paca_attendance_id: 53800,
                    is_trial: 1,
                    trial_total: 1,
                    trial_remaining: 1,
                },
                {
                    id: 8650,
                    student_id: 140200,
                    time_slot: 'evening',
                    class_id: 4,
                    paca_attendance_id: 53801,
                    is_trial: 0,
                    trial_total: 0,
                    trial_remaining: 0,
                },
            ]])
            .mockResolvedValueOnce([[
                { id: 140199, paca_student_id: 10773 },
            ]])
            .mockResolvedValue([{ affectedRows: 1 }]);
        pacaDb.query.mockResolvedValueOnce([[
            {
                attendance_id: 53800,
                paca_student_id: 10773,
                student_name: 'encrypted-name',
                gender: 'male',
                school: 'school',
                grade: 'grade',
                is_trial: 0,
                trial_remaining: 0,
                trial_dates: '[{"date":"2026-08-05","time_slot":"evening","attended":true}]',
                student_status: 'pending',
                time_slot: 'evening',
                attendance_status: 'present',
                is_makeup: 0,
            },
        ]]);

        const response = await postJson(makeApp(), '/peak/assignments/sync', {
            date: '2026-08-05',
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true, removed: 1 });
        expect(peakDb.query).toHaveBeenCalledTimes(5);
        expect(peakDb.query).toHaveBeenLastCalledWith(
            'DELETE FROM daily_assignments WHERE id = ? AND academy_id = ?',
            [8650, 2]
        );
    });
});
