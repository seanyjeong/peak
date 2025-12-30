/**
 * Stats Routes (통계 API)
 * 학원 전체 평균 등 통계 데이터
 * v4.3.3: 평균 점수 계산 추가
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

/**
 * 값을 점수로 변환하는 헬퍼 함수
 */
function valueToScore(value, ranges, gender, direction) {
    if (!ranges || ranges.length === 0) return null;

    const genderPrefix = gender === 'M' ? 'male' : 'female';

    // 범위에서 점수 찾기
    for (const range of ranges) {
        const min = range[`${genderPrefix}_min`];
        const max = range[`${genderPrefix}_max`];
        if (value >= min && value <= max) {
            return range.score;
        }
    }

    // 범위 밖인 경우
    if (direction === 'lower') {
        // 낮을수록 좋음: 최소값보다 낮으면 최고점, 최대값보다 높으면 최저점
        for (const range of ranges) {
            const max = range[`${genderPrefix}_max`];
            if (value <= max) return range.score;
        }
        return ranges[ranges.length - 1]?.score || 0;
    } else {
        // 높을수록 좋음: 최대값보다 높으면 최고점, 최소값보다 낮으면 최저점
        for (const range of ranges) {
            const min = range[`${genderPrefix}_min`];
            if (value >= min) return range.score;
        }
        return ranges[ranges.length - 1]?.score || 0;
    }
}

/**
 * GET /peak/stats/academy-average
 * 학원 전체 학생 평균 (프로필 비교용)
 */
router.get('/academy-average', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        // 1. 활성 종목 목록 (해당 학원만)
        const [recordTypes] = await db.query(
            'SELECT * FROM record_types WHERE academy_id = ? AND is_active = 1 ORDER BY display_order',
            [academyId]
        );

        // 2. 배점표 조회 (score_ranges 포함)
        const [scoreTables] = await db.query(`
            SELECT st.id, st.record_type_id, sr.score, sr.male_min, sr.male_max, sr.female_min, sr.female_max
            FROM score_tables st
            LEFT JOIN score_ranges sr ON st.id = sr.score_table_id
            WHERE st.academy_id = ?
            ORDER BY st.record_type_id, sr.score DESC
        `, [academyId]);

        // 종목별 배점표 그룹화
        const scoreTablesByType = {};
        scoreTables.forEach(row => {
            if (!scoreTablesByType[row.record_type_id]) {
                scoreTablesByType[row.record_type_id] = [];
            }
            if (row.score !== null) {
                scoreTablesByType[row.record_type_id].push(row);
            }
        });

        // 3. 모든 학생의 최신 기록만 조회 (종목별 최신 1개씩) + 성별 정보 포함
        const [latestRecords] = await db.query(`
            SELECT r1.*, s.gender
            FROM student_records r1
            INNER JOIN (
                SELECT student_id, record_type_id, MAX(measured_at) as max_date
                FROM student_records
                WHERE academy_id = ?
                GROUP BY student_id, record_type_id
            ) r2 ON r1.student_id = r2.student_id
                AND r1.record_type_id = r2.record_type_id
                AND r1.measured_at = r2.max_date
            JOIN students s ON r1.student_id = s.id
            WHERE s.status = 'active' AND s.academy_id = ?
        `, [academyId, academyId]);

        // 4. 종목별 남/녀 분리 평균 계산 (원시값 + 점수)
        const maleAverages = {};
        const femaleAverages = {};
        const maleScoreAverages = {};
        const femaleScoreAverages = {};
        const maleCounts = {};
        const femaleCounts = {};

        recordTypes.forEach(rt => {
            const maleRecords = latestRecords.filter(r => r.record_type_id === rt.id && r.gender === 'M');
            const femaleRecords = latestRecords.filter(r => r.record_type_id === rt.id && r.gender === 'F');
            const ranges = scoreTablesByType[rt.id] || [];

            if (maleRecords.length > 0) {
                const values = maleRecords.map(r => parseFloat(r.value));
                maleAverages[rt.id] = values.reduce((a, b) => a + b, 0) / values.length;
                maleCounts[rt.id] = values.length;

                // 각 학생의 점수를 계산하고 평균 구하기
                const scores = values.map(v => valueToScore(v, ranges, 'M', rt.direction)).filter(s => s !== null);
                if (scores.length > 0) {
                    maleScoreAverages[rt.id] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                }
            }

            if (femaleRecords.length > 0) {
                const values = femaleRecords.map(r => parseFloat(r.value));
                femaleAverages[rt.id] = values.reduce((a, b) => a + b, 0) / values.length;
                femaleCounts[rt.id] = values.length;

                // 각 학생의 점수를 계산하고 평균 구하기
                const scores = values.map(v => valueToScore(v, ranges, 'F', rt.direction)).filter(s => s !== null);
                if (scores.length > 0) {
                    femaleScoreAverages[rt.id] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                }
            }
        });

        // 5. 전체 학생 수 (성별별)
        const [studentCount] = await db.query(
            "SELECT gender, COUNT(*) as count FROM students WHERE status = 'active' AND academy_id = ? GROUP BY gender",
            [academyId]
        );

        const genderCounts = {};
        studentCount.forEach(row => {
            genderCounts[row.gender] = row.count;
        });

        res.json({
            success: true,
            maleAverages,
            femaleAverages,
            maleScoreAverages,      // 새로 추가: 남자 평균 점수
            femaleScoreAverages,    // 새로 추가: 여자 평균 점수
            maleCounts,
            femaleCounts,
            totalStudents: {
                male: genderCounts['M'] || 0,
                female: genderCounts['F'] || 0
            },
            recordTypes: recordTypes.map(rt => ({
                id: rt.id,
                name: rt.name,
                short_name: rt.short_name,
                unit: rt.unit,
                direction: rt.direction
            }))
        });
    } catch (error) {
        console.error('Get academy average error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /peak/stats/leaderboard/:recordTypeId
 * 종목별 순위표
 */
router.get('/leaderboard/:recordTypeId', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { recordTypeId } = req.params;
        const { limit = 10, gender } = req.query;

        // 종목 정보
        const [types] = await db.query(
            'SELECT * FROM record_types WHERE id = ? AND academy_id = ?',
            [recordTypeId, academyId]
        );
        if (types.length === 0) {
            return res.status(404).json({ error: 'Record type not found' });
        }
        const recordType = types[0];

        // 최신 기록 기준 순위 - 해당 학원만
        let query = `
            SELECT r.*, s.name as student_name, s.gender, s.school, s.grade
            FROM student_records r
            INNER JOIN (
                SELECT student_id, MAX(measured_at) as max_date
                FROM student_records
                WHERE record_type_id = ? AND academy_id = ?
                GROUP BY student_id
            ) latest ON r.student_id = latest.student_id AND r.measured_at = latest.max_date
            JOIN students s ON r.student_id = s.id
            WHERE r.record_type_id = ? AND s.status = 'active' AND s.academy_id = ?
        `;
        const params = [recordTypeId, academyId, recordTypeId, academyId];

        if (gender) {
            query += ' AND s.gender = ?';
            params.push(gender);
        }

        // direction에 따라 정렬
        query += recordType.direction === 'lower'
            ? ' ORDER BY r.value ASC'
            : ' ORDER BY r.value DESC';

        query += ' LIMIT ?';
        params.push(parseInt(limit));

        const [records] = await db.query(query, params);

        res.json({
            success: true,
            recordType,
            leaderboard: records.map((r, idx) => ({
                rank: idx + 1,
                studentId: r.student_id,
                studentName: r.student_name,
                gender: r.gender,
                school: r.school,
                grade: r.grade,
                value: parseFloat(r.value),
                measuredAt: r.measured_at
            }))
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
