// 성별이 비어 있는 학생은 점수를 내지 않는다 (운영 QA Q03).
// 남/여 학생의 점수·평균·순위는 고치기 전과 한 점도 달라지지 않아야 한다.
// 학생 PDF 라이브러리는 이 시험에서 쓰지 않는다 (jsdom 에서 불러오면 깨짐)
jest.mock('pdfkit', () => jest.fn());
jest.mock('../../../backend/config/database', () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock('../../../backend/config/paca-database', () => ({ query: jest.fn() }));
jest.mock('../../../backend/middleware/auth', () => ({
    verifyToken: (req, _res, next) => {
        req.user = { academyId: 2, role: 'owner' };
        next();
    },
}));
jest.mock('../../../backend/utils/feature-permissions', () => ({
    requireFeaturePermission: () => (req, _res, next) => {
        req.user = { academyId: 2, role: 'owner' };
        next();
    },
}));
jest.mock('../../../backend/utils/encryption', () => ({ decrypt: (value) => value }));
jest.mock('../../../backend/services/assignmentBranchService', () => ({
    getPacaBranches: async () => [],
    resolveBranchId: () => null,
    liveBranchId: () => null,
}));
jest.mock('../../../backend/utils/board-access', () => ({
    BOARD_ACCESS_TOKEN_TTL_SECONDS: 60,
    createBoardAccessToken: () => 'token',
    requireBoardAccess: () => true,
    validateBoardPin: () => true,
    verifyBoardPin: () => true,
}));
jest.mock('../../../backend/utils/peak-settings', () => ({
    ...jest.requireActual('../../../backend/utils/peak-settings'),
    findBoardSettingsBySlug: async () => ({ academy_id: 2 }),
    toBoardAcademy: () => ({ id: 2, name: '시험학원', slug: 'qa' }),
}));

const express = require('express');
const http = require('http');
const peakDb = require('../../../backend/config/database');
const pacaDb = require('../../../backend/config/paca-database');

// 배점표: 같은 기록이라도 남/여 점수가 다르게 나오도록 잡는다.
// 1번 종목(높을수록 좋음) 230 → 남 90, 여 100 / 2번 종목(낮을수록 좋음) 8.5 → 남 90, 여 100
const RECORD_TYPES = [
    { id: 1, name: '제자리멀리뛰기', short_name: '제멀', unit: 'cm', direction: 'higher', display_order: 1 },
    { id: 2, name: '10m왕복', short_name: '10m', unit: '초', direction: 'lower', display_order: 2 },
];
const RANGES = {
    1: [
        { score: 100, male_min: 250, male_max: 999, female_min: 220, female_max: 999 },
        { score: 90, male_min: 220, male_max: 249.99, female_min: 190, female_max: 219.99 },
        { score: 80, male_min: 0, male_max: 219.99, female_min: 0, female_max: 189.99 },
    ],
    2: [
        { score: 100, male_min: 0, male_max: 8, female_min: 0, female_max: 9 },
        { score: 90, male_min: 8.01, male_max: 9, female_min: 9.01, female_max: 10 },
        { score: 80, male_min: 9.01, male_max: 99, female_min: 10.01, female_max: 99 },
    ],
};
const VALUES = { 1: 230, 2: 8.5 };

// 학생 셋: 남(101) · 여(102) · 성별 비어 있음(103)
const STUDENTS = [
    { id: 101, paca_gender: 'male', peak_gender: 'M', name: '남학생' },
    { id: 102, paca_gender: 'female', peak_gender: 'F', name: '여학생' },
    { id: 103, paca_gender: null, peak_gender: null, name: '성별없음' },
];

function scoreTableRows() {
    return Object.entries(RANGES).flatMap(([typeId, ranges]) => ranges.map(range => ({
        id: Number(typeId) * 10,
        record_type_id: Number(typeId),
        max_score: 100,
        min_score: 0,
        ...range,
    })));
}

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

function makeApp(mountPath, router) {
    const app = express();
    app.use(express.json());
    app.use(mountPath, router);
    return app;
}

beforeEach(() => {
    peakDb.query.mockReset();
    peakDb.getConnection.mockReset();
    pacaDb.query.mockReset();
});

describe('학생 상세 점수 (GET /students/:id/stats)', () => {
    const studentsRouter = require('../../../backend/routes/students');

    function mockStudent(student) {
        peakDb.query.mockImplementation(async (sql) => {
            if (sql.includes('JOIN paca.students ps') && sql.includes('WHERE s.id = ?')) {
                return [[{ id: student.id, paca_student_id: student.id, name: student.name, gender: student.paca_gender, school: '백마고', grade: '고3', status: 'active' }]];
            }
            if (sql.includes('FROM record_types WHERE academy_id')) return [RECORD_TYPES];
            if (sql.includes('UNION ALL')) {
                return [RECORD_TYPES.map(rt => ({
                    id: rt.id, record_type_id: rt.id, value: String(VALUES[rt.id]), measured_at: '2026-11-01',
                    record_type_name: rt.name, unit: rt.unit, direction: rt.direction, source: 'training',
                }))];
            }
            if (sql.includes('JOIN score_ranges sr')) return [scoreTableRows()];
            return [[]];
        });
    }

    it('남학생은 남자 표로, 여학생은 여자 표로 고치기 전과 같은 점수', async () => {
        const app = makeApp('/peak/students', studentsRouter);

        mockStudent(STUDENTS[0]);
        const male = await request(app, 'GET', '/peak/students/101/stats');
        expect(male.body.student.gender).toBe('M');
        expect(male.body.stats.scores).toEqual({ 1: 90, 2: 90 });
        expect(male.body.stats.totalScore).toBe(180);

        mockStudent(STUDENTS[1]);
        const female = await request(app, 'GET', '/peak/students/102/stats');
        expect(female.body.student.gender).toBe('F');
        expect(female.body.stats.scores).toEqual({ 1: 100, 2: 100 });
        expect(female.body.stats.totalScore).toBe(200);
    });

    it('성별이 비어 있으면 기록은 그대로 두고 점수는 내지 않는다', async () => {
        const app = makeApp('/peak/students', studentsRouter);
        mockStudent(STUDENTS[2]);
        const res = await request(app, 'GET', '/peak/students/103/stats');

        expect(res.body.student.gender).toBeNull();
        expect(res.body.stats.latests[1].value).toBe(230);
        expect(res.body.stats.latests[2].value).toBe(8.5);
        expect(res.body.stats.scores).toEqual({});
        expect(res.body.stats.totalScore).toBe(0);
    });
});

describe('PACA 학생 동기화 (POST /students/sync)', () => {
    const studentsRouter = require('../../../backend/routes/students');

    it('성별이 비어 있으면 여자로 바꾸지 않고 비운 채 저장한다', async () => {
        pacaDb.query.mockResolvedValue([STUDENTS.map(s => ({
            id: s.id, name: s.name, gender: s.paca_gender, phone: null, school: null, grade: null,
            enrollment_date: null, status: 'active', class_days: null, trial_remaining: null, trial_dates: null,
        }))]);
        const connection = {
            query: jest.fn(async () => [{ affectedRows: 3, changedRows: 0 }]),
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
        };
        peakDb.getConnection.mockResolvedValue(connection);

        const app = makeApp('/peak/students', studentsRouter);
        const res = await request(app, 'POST', '/peak/students/sync', {});

        expect(res.status).toBe(200);
        const upsert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO students'));
        // 값 순서: academy_id, paca_student_id, name, gender, ...
        expect(upsert[1][0].map(row => [row[1], row[3]])).toEqual([[101, 'M'], [102, 'F'], [103, null]]);
    });
});

describe('반 배치 동기화의 학생 성별 (POST /assignments/sync)', () => {
    it('성별이 비어 있으면 남자로 바꾸지 않고 비운 채 저장한다', async () => {
        const registerAssignmentSyncRoutes = require('../../../backend/routes/assignmentSyncRoutes');
        pacaDb.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM attendance a')) {
                return [STUDENTS.map((s, idx) => ({
                    attendance_id: 900 + idx, paca_student_id: s.id, student_name: s.name, gender: s.paca_gender,
                    school: null, grade: '고3', is_trial: 0, trial_remaining: 0, trial_dates: null,
                    student_status: 'active', time_slot: 'evening', attendance_status: null, is_makeup: 0,
                }))];
            }
            return [[]];
        });
        peakDb.query.mockImplementation(async (sql) => {
            if (sql.includes('INSERT INTO students')) return [{ insertId: 5000 }];
            if (sql.includes('INSERT INTO daily_assignments')) return [{ insertId: 7000 }];
            return [[]];
        });

        const router = express.Router();
        registerAssignmentSyncRoutes(router);
        const app = makeApp('/peak/assignments', router);
        const res = await request(app, 'POST', '/peak/assignments/sync', { date: '2026-11-15' });

        expect(res.status).toBe(200);
        const insert = peakDb.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO students'));
        // 값 순서: paca_student_id, name, gender, ...
        expect(insert[1][0].map(row => [row[0], row[2]])).toEqual([[101, 'M'], [102, 'F'], [103, null]]);
    });
});

describe('월말테스트 전체 순위 (GET /monthly-tests/:testId/all-records)', () => {
    const monthlyTestsRouter = require('../../../backend/routes/monthlyTests');

    function mockMonthlyTest() {
        peakDb.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT * FROM monthly_tests WHERE id = ?')) {
                return [[{ id: 7, test_name: '11월 월말', test_month: '2026-11', status: 'active' }]];
            }
            if (sql.includes('FROM monthly_test_types mtt')) {
                return [RECORD_TYPES.map(rt => ({ record_type_id: rt.id, name: rt.name, short_name: rt.short_name, unit: rt.unit, direction: rt.direction }))];
            }
            if (sql.includes('SELECT id, test_date FROM test_sessions')) return [[{ id: 70, test_date: '2026-11-15' }]];
            if (sql.includes('FROM test_participants tp')) {
                return [[
                    ...STUDENTS.map(s => ({ student_id: s.id, test_applicant_id: null, participant_type: 'enrolled', student_name: s.name, gender: s.paca_gender, school: null, grade: '고3' })),
                    { student_id: null, test_applicant_id: 501, participant_type: 'test_new', student_name: null, gender: null, school: null, grade: null },
                    { student_id: null, test_applicant_id: 502, participant_type: 'test_new', student_name: null, gender: null, school: null, grade: null },
                ]];
            }
            if (sql.includes('FROM test_records')) {
                const ids = [...STUDENTS.map(s => ({ student_id: s.id })), { test_applicant_id: 501 }, { test_applicant_id: 502 }];
                return [ids.flatMap(owner => RECORD_TYPES.map(rt => ({
                    student_id: owner.student_id || null, test_applicant_id: owner.test_applicant_id || null,
                    record_type_id: rt.id, value: String(VALUES[rt.id]),
                })))];
            }
            if (sql.includes('SELECT id, record_type_id, min_score FROM score_tables')) {
                return [RECORD_TYPES.map(rt => ({ id: rt.id * 10, record_type_id: rt.id, min_score: 0 }))];
            }
            if (sql.includes('FROM score_ranges sr')) {
                return [scoreTableRows().map(row => ({ ...row, score_table_id: row.id }))];
            }
            return [[]];
        });
        pacaDb.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM test_applicants')) {
                return [[
                    { id: 501, name: '신규여', gender: 'female', school: null, grade: '고2' },
                    { id: 502, name: '신규성별없음', gender: null, school: null, grade: '고2' },
                ]];
            }
            return [[]];
        });
    }

    it('남/여 참가자 점수·총점은 고치기 전과 같고, 성별 없는 참가자는 점수·총점 미산정', async () => {
        mockMonthlyTest();
        const app = makeApp('/peak/monthly-tests', monthlyTestsRouter);
        const res = await request(app, 'GET', '/peak/monthly-tests/7/all-records');

        expect(res.status).toBe(200);
        const byName = Object.fromEntries(res.body.participants.map(p => [p.name, p]));

        expect(byName['남학생']).toMatchObject({ gender: 'M', scores: { 1: 90, 2: 90 }, total_score: 180, scored_count: 2 });
        expect(byName['여학생']).toMatchObject({ gender: 'F', scores: { 1: 100, 2: 100 }, total_score: 200, scored_count: 2 });
        expect(byName['신규여']).toMatchObject({ gender: 'F', scores: { 1: 100, 2: 100 }, total_score: 200, scored_count: 2 });

        for (const name of ['성별없음', '신규성별없음']) {
            expect(byName[name].gender).toBeNull();
            expect(byName[name].records).toEqual({ 1: 230, 2: 8.5 });
            expect(byName[name].scores).toEqual({ 1: null, 2: null });
            expect(byName[name].total_score).toBeNull();
            expect(byName[name].scored_count).toBe(0);
        }
    });
});

describe('전광판 남녀 순위 (GET /public/:slug)', () => {
    const publicBoardRouter = require('../../../backend/routes/publicBoard');

    it('남/여 순위는 고치기 전과 같고, 성별 없는 참가자는 어느 쪽에도 들어가지 않는다', async () => {
        peakDb.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM monthly_tests')) return [[{ id: 7, test_month: '2026-11', test_name: '11월 월말', status: 'active' }]];
            if (sql.includes('FROM monthly_test_types mtt')) {
                return [RECORD_TYPES.map(rt => ({ record_type_id: rt.id, name: rt.name, short_name: rt.short_name, unit: rt.unit, direction: rt.direction }))];
            }
            if (sql.includes('SELECT id, record_type_id, min_score FROM score_tables')) {
                return [RECORD_TYPES.map(rt => ({ id: rt.id * 10, record_type_id: rt.id, min_score: 0 }))];
            }
            if (sql.includes('FROM score_ranges sr')) return [scoreTableRows()];
            if (sql.includes('SELECT id, test_date FROM test_sessions')) return [[{ id: 70, test_date: '2026-11-15' }]];
            if (sql.includes('FROM test_participants tp')) {
                return [[
                    ...STUDENTS.map(s => ({ id: s.id, student_id: s.id, test_applicant_id: null, participant_type: 'enrolled', name: s.name, gender: s.paca_gender, school: null, grade: '고3' })),
                    { id: 600, student_id: null, test_applicant_id: 502, participant_type: 'test_new', name: null, gender: null, school: null, grade: null },
                ]];
            }
            if (sql.includes('FROM test_records')) {
                const owners = [...STUDENTS.map(s => ({ student_id: s.id })), { test_applicant_id: 502 }];
                return [owners.flatMap(owner => RECORD_TYPES.map(rt => ({
                    student_id: owner.student_id || null, test_applicant_id: owner.test_applicant_id || null,
                    record_type_id: rt.id, value: String(VALUES[rt.id]),
                })))];
            }
            return [[]];
        });
        pacaDb.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM test_applicants')) return [[{ id: 502, name: '신규성별없음', gender: null, school: null, grade: '고2' }]];
            return [[]];
        });

        const app = makeApp('/peak/public', publicBoardRouter);
        const res = await request(app, 'GET', '/peak/public/qa');

        expect(res.status).toBe(200);
        expect(res.body.ranking.male).toEqual([{ rank: 1, name: '남학생', school: null, grade: '고3', total: 180 }]);
        expect(res.body.ranking.female).toEqual([{ rank: 1, name: '여학생', school: null, grade: '고3', total: 200 }]);
        const eventNames = res.body.events.flatMap(event => event.records.map(r => `${event.id}:${r.gender}:${r.name}:${r.score}`));
        expect(eventNames).toEqual(['1:M:남학생:90', '1:F:여학생:100', '2:M:남학생:90', '2:F:여학생:100']);
    });
});

describe('분석 리포트 남녀 평균·Top10 (GET /analytics/report)', () => {
    const analyticsRouter = require('../../../backend/routes/analytics');

    it('남/여 평균·순위는 고치기 전과 같고, 성별 없는 학생 평균은 여자 평균에 섞이지 않는다', async () => {
        // DB 가 성별별로 묶어 준 평균 (성별 없는 학생은 gender NULL 묶음)
        const avgRows = [
            { record_type_id: 1, record_type_name: '제자리멀리뛰기', short_name: '제멀', unit: 'cm', direction: 'higher', gender: null, avg_value: '300.0', student_count: 1 },
            { record_type_id: 1, record_type_name: '제자리멀리뛰기', short_name: '제멀', unit: 'cm', direction: 'higher', gender: 'F', avg_value: '200.0', student_count: 1 },
            { record_type_id: 1, record_type_name: '제자리멀리뛰기', short_name: '제멀', unit: 'cm', direction: 'higher', gender: 'M', avg_value: '230.0', student_count: 1 },
            // 2번 종목은 여학생 기록이 없고 성별 없는 학생 기록만 있다
            { record_type_id: 2, record_type_name: '10m왕복', short_name: '10m', unit: '초', direction: 'lower', gender: null, avg_value: '9.5', student_count: 1 },
            { record_type_id: 2, record_type_name: '10m왕복', short_name: '10m', unit: '초', direction: 'lower', gender: 'M', avg_value: '8.5', student_count: 1 },
        ];
        const latest = STUDENTS.map(s => ({ student_id: s.id, student_name: s.name, gender: s.paca_gender, peak_gender: s.peak_gender, value: VALUES[1], measured_at: '2026-11-01' }));
        peakDb.query.mockImplementation(async (sql) => {
            if (sql.includes('COUNT(*) as totalRecords')) return [[{ totalRecords: 300, totalStudents: 3 }]];
            if (sql.includes('paca.academies')) return [[{ name: '시험학원' }]];
            if (sql.includes('FROM record_types WHERE academy_id')) return [RECORD_TYPES];
            if (sql.includes('ROUND(AVG(sr.value), 1)')) return [avgRows];
            // 순위 SQL 은 s.gender = 'M' / 'F' 로 거른다 (NULL 은 어느 쪽에도 안 맞는다)
            if (sql.includes("s.gender = 'M'")) return [latest.filter(r => r.peak_gender === 'M')];
            if (sql.includes("s.gender = 'F'")) return [latest.filter(r => r.peak_gender === 'F')];
            return [[]];
        });

        const app = makeApp('/peak/analytics', analyticsRouter);
        const res = await request(app, 'GET', '/peak/analytics/report');

        expect(res.status).toBe(200);
        expect(res.body.eventAverages).toEqual([
            expect.objectContaining({ recordTypeId: 1, maleAvg: 230, femaleAvg: 200, maleCount: 1, femaleCount: 1, totalAvg: 215 }),
            expect.objectContaining({ recordTypeId: 2, maleAvg: 8.5, femaleAvg: null, maleCount: 1, femaleCount: 0, totalAvg: 8.5 }),
        ]);
        expect(res.body.rankings[0].male.map(r => r.studentName)).toEqual(['남학생']);
        expect(res.body.rankings[0].female.map(r => r.studentName)).toEqual(['여학생']);
    });
});

describe('배점 계산 (POST /score-tables/calculate)', () => {
    const scoreTableRouter = require('../../../backend/routes/scoreTable');

    function mockScoreTable() {
        peakDb.query.mockImplementation(async (sql, params) => {
            if (sql.includes('SELECT id FROM score_tables')) return [[{ id: 10 }]];
            if (sql.includes('FROM score_ranges')) {
                const column = sql.includes('male_min <= ?') && !sql.includes('female_min') ? 'male' : 'female';
                const value = params[1];
                const hit = RANGES[1].find(r => r[`${column}_min`] <= value && r[`${column}_max`] >= value);
                return [hit ? [{ score: hit.score }] : []];
            }
            return [[]];
        });
    }

    it('남/여는 고치기 전과 같은 점수, 성별이 없으면 점수 없음', async () => {
        mockScoreTable();
        const app = makeApp('/peak/score-tables', scoreTableRouter);

        const male = await request(app, 'POST', '/peak/score-tables/calculate', { record_type_id: 1, value: 230, gender: 'M' });
        const female = await request(app, 'POST', '/peak/score-tables/calculate', { record_type_id: 1, value: 230, gender: 'F' });
        const missing = await request(app, 'POST', '/peak/score-tables/calculate', { record_type_id: 1, value: 230, gender: null });

        expect(male.body.score).toBe(90);
        expect(female.body.score).toBe(100);
        expect(missing.body.score).toBeNull();
    });
});
