/**
 * Students Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const mysql = require('mysql2/promise');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');

// P-ACA DB 연결 (환경변수 필수)
const pacaPool = mysql.createPool({
    host: process.env.PACA_DB_HOST || 'localhost',
    user: process.env.PACA_DB_USER || 'paca',
    password: process.env.PACA_DB_PASSWORD,  // 필수 - fallback 제거
    database: 'paca',
    waitForConnections: true,
    connectionLimit: 5
});

/**
 * POST /peak/students/sync
 * P-ACA에서 학생 데이터 동기화
 */
router.post('/sync', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;  // 토큰에서 학원 ID

        if (!academyId) {
            return res.status(400).json({ error: '학원 ID가 필요합니다.' });
        }

        // P-ACA에서 해당 학원의 학생 목록 가져오기 (재원생, 휴원생, 체험생, 미등록관리)
        // withdrawn(퇴원), graduated(졸업) 제외
        const [pacaStudents] = await pacaPool.query(`
            SELECT id, name, gender, phone, school, grade, enrollment_date, status,
                   class_days, trial_remaining, trial_dates
            FROM students
            WHERE academy_id = ? AND status IN ('active', 'paused', 'trial', 'pending')
            ORDER BY name
        `, [academyId]);

        let synced = 0;
        let updated = 0;

        for (const student of pacaStudents) {
            // 이름 복호화
            let decryptedName = student.name;
            try {
                if (student.name && student.name.startsWith('ENC:')) {
                    decryptedName = decrypt(student.name);
                }
            } catch (e) {
                console.error('Name decryption error:', e);
            }

            // 전화번호 복호화
            let decryptedPhone = student.phone;
            try {
                if (student.phone && student.phone.startsWith('ENC:')) {
                    decryptedPhone = decrypt(student.phone);
                }
            } catch (e) {
                console.error('Phone decryption error:', e);
            }

            // gender 변환 (male/female -> M/F)
            const gender = student.gender === 'male' ? 'M' : 'F';

            // status 변환 (P-ACA -> P-EAK)
            // P-ACA: active, paused, trial, pending
            // P-EAK: active, inactive, pending
            let status = 'active';
            if (student.status === 'paused') status = 'inactive';
            if (student.status === 'pending') status = 'pending';

            // 체험생 상태 처리 - P-ACA status='trial'인 경우에만 체험생
            const isTrial = student.status === 'trial' ? 1 : 0;

            // 체험 총 횟수: trial_dates 배열 길이 기반 동적 계산
            let trialTotal = 2;  // 기본값
            if (isTrial && student.trial_dates) {
                try {
                    const trialDates = typeof student.trial_dates === 'string'
                        ? JSON.parse(student.trial_dates || '[]')
                        : (student.trial_dates || []);
                    trialTotal = trialDates.length || 2;
                } catch (e) {
                    trialTotal = 2;  // 파싱 실패 시 기본값
                }
            }
            const trialRemaining = student.trial_remaining ?? trialTotal;

            // 이미 있는지 확인
            const [existing] = await db.query(
                'SELECT id FROM students WHERE paca_student_id = ?',
                [student.id]
            );

            // class_days JSON 처리
            const classDays = student.class_days ? JSON.stringify(student.class_days) : null;

            if (existing.length > 0) {
                // 업데이트
                await db.query(`
                    UPDATE students SET
                        name = ?, gender = ?, phone = ?, school = ?, grade = ?,
                        class_days = ?, is_trial = ?, trial_total = ?, trial_remaining = ?,
                        status = ?, updated_at = NOW()
                    WHERE paca_student_id = ?
                `, [decryptedName, gender, decryptedPhone, student.school, student.grade,
                    classDays, isTrial, trialTotal, trialRemaining,
                    status, student.id]);
                updated++;
            } else {
                // 새로 추가
                await db.query(`
                    INSERT INTO students (paca_student_id, name, gender, phone, school, grade,
                                          class_days, is_trial, trial_total, trial_remaining,
                                          join_date, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [student.id, decryptedName, gender, decryptedPhone, student.school, student.grade,
                    classDays, isTrial, trialTotal, trialRemaining,
                    student.enrollment_date, status]);
                synced++;
            }
        }

        // P-ACA에 없는 학생(퇴원/졸업) 비활성화
        const pacaStudentIds = pacaStudents.map(s => s.id);
        let deactivated = 0;
        if (pacaStudentIds.length > 0) {
            const [deactivateResult] = await db.query(`
                UPDATE students
                SET status = 'inactive', updated_at = NOW()
                WHERE paca_student_id IS NOT NULL
                AND paca_student_id NOT IN (?)
                AND status = 'active'
            `, [pacaStudentIds]);
            deactivated = deactivateResult.affectedRows || 0;
        }

        res.json({
            success: true,
            message: `동기화 완료: ${synced}명 추가, ${updated}명 업데이트, ${deactivated}명 비활성화`,
            synced,
            updated,
            deactivated,
            total: pacaStudents.length
        });

    } catch (error) {
        console.error('Sync students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /peak/students/today
 * 오늘 수업인 학생 목록 (스케줄 기반)
 */
router.get('/today', async (req, res) => {
    try {
        // 오늘 요일 구하기 (0=일요일, 1=월요일, ... 6=토요일)
        const today = new Date();
        const dayOfWeek = today.getDay();

        // class_days에 오늘 요일이 포함된 학생만 조회
        // JSON_CONTAINS를 사용하여 배열에서 요일 확인
        const [students] = await db.query(`
            SELECT *
            FROM students
            WHERE status = 'active'
              AND class_days IS NOT NULL
              AND JSON_CONTAINS(class_days, ?)
            ORDER BY name
        `, [dayOfWeek.toString()]);

        res.json({
            success: true,
            date: today.toISOString().split('T')[0],
            dayOfWeek,
            students
        });
    } catch (error) {
        console.error('Get today students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /peak/students/schedule
 * 특정 날짜의 학생 목록 (스케줄 기반)
 */
router.get('/schedule', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const dayOfWeek = targetDate.getDay();

        // class_days에 해당 요일이 포함된 학생 + 체험생
        const [students] = await db.query(`
            SELECT *
            FROM students
            WHERE status = 'active'
              AND (
                (class_days IS NOT NULL AND JSON_CONTAINS(class_days, ?))
                OR is_trial = 1
              )
            ORDER BY is_trial DESC, name
        `, [dayOfWeek.toString()]);

        res.json({
            success: true,
            date: targetDate.toISOString().split('T')[0],
            dayOfWeek,
            students
        });
    } catch (error) {
        console.error('Get schedule students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students - 학생 목록
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT * FROM students';
        const params = [];

        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }
        query += ' ORDER BY name';

        const [students] = await db.query(query, params);
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students/:id - 학생 상세
router.get('/:id', async (req, res) => {
    try {
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [req.params.id]
        );
        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found' });
        }
        res.json({ success: true, student: students[0] });
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students/:id/records - 학생 기록 히스토리 (동적 종목)
router.get('/:id/records', async (req, res) => {
    try {
        const [records] = await db.query(`
            SELECT r.*, rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ?
            ORDER BY r.measured_at DESC, rt.display_order
        `, [req.params.id]);

        // 날짜별로 그룹화해서 반환
        const grouped = {};
        records.forEach(r => {
            // measured_at이 Date 객체일 수도 있고 문자열일 수도 있음
            let dateKey;
            if (r.measured_at instanceof Date) {
                dateKey = r.measured_at.toISOString().split('T')[0];
            } else if (typeof r.measured_at === 'string') {
                dateKey = r.measured_at.split('T')[0];
            } else {
                dateKey = String(r.measured_at);
            }
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    measured_at: dateKey,
                    records: []
                };
            }
            grouped[dateKey].records.push({
                record_type_id: r.record_type_id,
                record_type_name: r.record_type_name,
                unit: r.unit,
                direction: r.direction,
                value: r.value,
                notes: r.notes
            });
        });

        res.json({
            success: true,
            records: Object.values(grouped).sort((a, b) =>
                new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
            )
        });
    } catch (error) {
        console.error('Get student records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /peak/students/:id/stats - 학생 종합 통계
 * 프로필 페이지용 데이터
 */
router.get('/:id/stats', async (req, res) => {
    try {
        const studentId = req.params.id;

        // 1. 학생 정보 조회
        const [students] = await db.query('SELECT * FROM students WHERE id = ?', [studentId]);
        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const student = students[0];

        // 2. 활성 종목 목록
        const [recordTypes] = await db.query(
            'SELECT * FROM record_types WHERE is_active = 1 ORDER BY display_order'
        );

        // 3. 학생의 모든 기록 조회
        const [allRecords] = await db.query(`
            SELECT r.*, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ?
            ORDER BY r.measured_at DESC
        `, [studentId]);

        // 4. 종목별 배점표 조회
        const [scoreTables] = await db.query(`
            SELECT st.*, sr.score, sr.male_min, sr.male_max, sr.female_min, sr.female_max
            FROM score_tables st
            JOIN score_ranges sr ON sr.score_table_id = st.id
            ORDER BY st.record_type_id, sr.score DESC
        `);

        // 배점표를 종목별로 그룹화
        const scoreTablesByType = {};
        scoreTables.forEach(row => {
            if (!scoreTablesByType[row.record_type_id]) {
                scoreTablesByType[row.record_type_id] = {
                    maxScore: row.max_score,
                    ranges: []
                };
            }
            scoreTablesByType[row.record_type_id].ranges.push({
                score: row.score,
                male_min: parseFloat(row.male_min),
                male_max: parseFloat(row.male_max),
                female_min: parseFloat(row.female_min),
                female_max: parseFloat(row.female_max)
            });
        });

        // 5. 종목별 통계 계산
        const averages = {};
        const bests = {};
        const latests = {};
        const scores = {};
        const trends = {};

        recordTypes.forEach(rt => {
            const typeRecords = allRecords.filter(r => r.record_type_id === rt.id);
            if (typeRecords.length === 0) return;

            // 평균
            const values = typeRecords.map(r => parseFloat(r.value));
            averages[rt.id] = values.reduce((a, b) => a + b, 0) / values.length;

            // 최고 기록 (direction 고려)
            const isLowerBetter = rt.direction === 'lower';
            const bestValue = isLowerBetter ? Math.min(...values) : Math.max(...values);
            const bestRecord = typeRecords.find(r => parseFloat(r.value) === bestValue);
            bests[rt.id] = {
                value: bestValue,
                date: bestRecord?.measured_at
            };

            // 최신 기록
            latests[rt.id] = {
                value: parseFloat(typeRecords[0].value),
                date: typeRecords[0].measured_at
            };

            // 점수 계산 (최신 기록 기준)
            const scoreTable = scoreTablesByType[rt.id];
            if (scoreTable) {
                const latestValue = parseFloat(typeRecords[0].value);
                const ranges = scoreTable.ranges; // 점수 내림차순 정렬됨 (100, 95, 90, ...)
                let foundScore = null;

                // 1. 정확히 범위에 맞는 점수 찾기
                for (const range of ranges) {
                    const min = student.gender === 'M' ? range.male_min : range.female_min;
                    const max = student.gender === 'M' ? range.male_max : range.female_max;
                    if (latestValue >= min && latestValue <= max) {
                        foundScore = range.score;
                        break;
                    }
                }

                // 2. 못 찾았으면 방향에 따라 적절한 점수 찾기
                if (foundScore === null) {
                    if (isLowerBetter) {
                        // 낮을수록 좋음: 기록이 max 이하인 가장 높은 점수 찾기
                        for (const range of ranges) {
                            const max = student.gender === 'M' ? range.male_max : range.female_max;
                            if (latestValue <= max) {
                                foundScore = range.score;
                                break;
                            }
                        }
                        // 그래도 못 찾으면 (모든 범위보다 나쁨) 최저점
                        if (foundScore === null) {
                            foundScore = ranges[ranges.length - 1]?.score || 50;
                        }
                    } else {
                        // 높을수록 좋음: 기록이 min 이상인 가장 높은 점수 찾기
                        for (const range of ranges) {
                            const min = student.gender === 'M' ? range.male_min : range.female_min;
                            if (latestValue >= min) {
                                foundScore = range.score;
                                break;
                            }
                        }
                        // 그래도 못 찾으면 (모든 범위보다 나쁨) 최저점
                        if (foundScore === null) {
                            foundScore = ranges[ranges.length - 1]?.score || 50;
                        }
                    }
                }

                scores[rt.id] = foundScore;
            }

            // 추세 계산 (최근 5개 기록의 연속 변화 + 처음↔마지막 비교)
            if (typeRecords.length >= 5) {
                // 최근 5개 기록: [0]=최신, [1], [2], [3], [4]=가장 오래됨
                const vals = typeRecords.slice(0, 5).map(r => parseFloat(r.value));

                // 연속 비교: 개선 횟수 vs 하락 횟수 (4번 비교)
                let improvements = 0;
                let declines = 0;

                for (let i = 0; i < 4; i++) {
                    const newer = vals[i];
                    const older = vals[i + 1];

                    if (isLowerBetter) {
                        if (newer < older) improvements++;
                        else if (newer > older) declines++;
                    } else {
                        if (newer > older) improvements++;
                        else if (newer < older) declines++;
                    }
                }

                // 처음 vs 마지막 비교 추가 (가중치 적용)
                const newest = vals[0];
                const oldest = vals[4];
                if (isLowerBetter) {
                    if (newest < oldest) improvements += 2;  // 가중치 2
                    else if (newest > oldest) declines += 2;
                } else {
                    if (newest > oldest) improvements += 2;
                    else if (newest < oldest) declines += 2;
                }

                // 최종 판정
                if (improvements > declines) trends[rt.id] = 'up';
                else if (declines > improvements) trends[rt.id] = 'down';
                else trends[rt.id] = 'stable';
            } else {
                // 기록이 5개 미만이면 추세 판단 불가
                trends[rt.id] = 'need_more';
            }
        });

        // 6. 총점 및 등급 계산
        const scoreValues = Object.values(scores);
        const totalScore = scoreValues.reduce((a, b) => a + b, 0);
        const maxPossibleScore = scoreValues.length * 100; // 각 종목 만점 100점 가정
        const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

        let grade = 'F';
        if (percentage >= 90) grade = 'A';
        else if (percentage >= 80) grade = 'B';
        else if (percentage >= 70) grade = 'C';
        else if (percentage >= 60) grade = 'D';

        // 7. 전체 추세 (점수가 있는 종목들의 추세 종합)
        const trendValues = Object.values(trends);
        const upCount = trendValues.filter(t => t === 'up').length;
        const downCount = trendValues.filter(t => t === 'down').length;
        const overallTrend = upCount > downCount ? 'up' : downCount > upCount ? 'down' : 'stable';

        res.json({
            success: true,
            student,
            stats: {
                averages,
                bests,
                latests,
                scores,
                trends,
                totalScore,
                maxPossibleScore,
                percentage: Math.round(percentage * 10) / 10,
                grade,
                overallTrend,
                recordCount: allRecords.length,
                typesWithRecords: Object.keys(averages).length
            }
        });
    } catch (error) {
        console.error('Get student stats error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
