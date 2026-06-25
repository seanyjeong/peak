/**
 * Analytics Routes (분석 리포트 API)
 * GET /peak/analytics/report - 학원 분석 리포트 데이터
 * v1.0.0: 종목별 평균, 순위, 트렌드 분석
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { decryptStudentFields } = require('../utils/paca-student');
const { requireFeaturePermission } = require('../utils/feature-permissions');

/**
 * 선형회귀 기울기 계산
 */
function calculateSlope(values) {
    const n = values.length;
    if (n < 2) return 0;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (values[i] - yMean);
        denominator += (i - xMean) ** 2;
    }
    return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 트렌드 판정 (ET 서버 분석과 동일 기준: ±0.5)
 */
function classifyTrend(slope, direction) {
    const THRESHOLD = 0.5;
    if (direction === 'higher') {
        if (slope > THRESHOLD) return 'improving';
        if (slope < -THRESHOLD) return 'declining';
    } else {
        if (slope < -THRESHOLD) return 'improving';
        if (slope > THRESHOLD) return 'declining';
    }
    return 'maintaining';
}

/**
 * GET /peak/analytics/report
 * 학원 전체 분석 리포트
 */
router.get('/report', requireFeaturePermission('analyticsReport'), async (req, res) => {
    try {
        const academyId = req.user.academyId;

        // 1. 요약 정보
        const [summaryRows] = await db.query(`
            SELECT
                COUNT(*) as totalRecords,
                COUNT(DISTINCT sr.student_id) as totalStudents
            FROM student_records sr
            JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
            JOIN paca.students ps ON s.paca_student_id = ps.id
            WHERE sr.academy_id = ? AND ps.status = 'active'
        `, [academyId, academyId]);

        const totalRecords = summaryRows[0].totalRecords;
        const totalStudents = summaryRows[0].totalStudents;

        // 최소 기록 조건 (FR-08)
        if (totalRecords < 200) {
            return res.status(403).json({
                error: 'INSUFFICIENT_DATA',
                message: '리포트 생성을 위해 최소 200개의 기록이 필요합니다.',
                currentCount: totalRecords
            });
        }

        // 학원명
        const [academyRows] = await db.query(
            'SELECT name FROM paca.academies WHERE id = ?', [academyId]
        );
        const academyName = academyRows[0]?.name || '학원';

        // 2. 활성 종목 목록 (동적 - 하드코딩 없음)
        const [recordTypes] = await db.query(
            'SELECT id, name, short_name, unit, direction FROM record_types WHERE academy_id = ? AND is_active = 1 ORDER BY display_order',
            [academyId]
        );

        // 3. 종목별 남/여 평균 (최신 기록 기준)
        const [avgRows] = await db.query(`
            SELECT
                rt.id as record_type_id,
                rt.name as record_type_name,
                rt.short_name,
                rt.unit,
                rt.direction,
                s.gender,
                ROUND(AVG(sr.value), 1) as avg_value,
                COUNT(DISTINCT sr.student_id) as student_count
            FROM student_records sr
            INNER JOIN (
                SELECT student_id, record_type_id, MAX(measured_at) as max_date
                FROM student_records
                WHERE academy_id = ?
                GROUP BY student_id, record_type_id
            ) latest ON sr.student_id = latest.student_id
                AND sr.record_type_id = latest.record_type_id
                AND sr.measured_at = latest.max_date
            JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
            JOIN paca.students ps ON s.paca_student_id = ps.id
            JOIN record_types rt ON sr.record_type_id = rt.id AND rt.is_active = 1
            WHERE sr.academy_id = ? AND ps.status = 'active' AND s.academy_id = ?
            GROUP BY rt.id, s.gender
            ORDER BY rt.display_order, s.gender
        `, [academyId, academyId, academyId, academyId]);

        // eventAverages 구조화
        const avgMap = {};
        avgRows.forEach(row => {
            if (!avgMap[row.record_type_id]) {
                avgMap[row.record_type_id] = {
                    recordTypeId: row.record_type_id,
                    recordTypeName: row.record_type_name,
                    shortName: row.short_name,
                    unit: row.unit,
                    direction: row.direction,
                    maleAvg: null, femaleAvg: null, totalAvg: null,
                    maleCount: 0, femaleCount: 0
                };
            }
            const g = row.gender === 'M' ? 'male' : 'female';
            avgMap[row.record_type_id][`${g}Avg`] = parseFloat(row.avg_value);
            avgMap[row.record_type_id][`${g}Count`] = row.student_count;
        });

        const eventAverages = Object.values(avgMap).map(e => {
            const mTotal = (e.maleAvg || 0) * e.maleCount;
            const fTotal = (e.femaleAvg || 0) * e.femaleCount;
            const total = e.maleCount + e.femaleCount;
            e.totalAvg = total > 0 ? parseFloat(((mTotal + fTotal) / total).toFixed(1)) : null;
            return e;
        });

        // 4. 종목별 순위 (Top 10, 남/여 구분)
        const rankings = [];
        for (const rt of recordTypes) {
            const orderDir = rt.direction === 'lower' ? 'ASC' : 'DESC';
            const [maleRank] = await db.query(`
                SELECT sr.student_id, ps.name as student_name, ps.gender, sr.value, sr.measured_at
                FROM student_records sr
                INNER JOIN (
                    SELECT student_id, MAX(measured_at) as max_date
                    FROM student_records WHERE record_type_id = ? AND academy_id = ?
                    GROUP BY student_id
                ) latest ON sr.student_id = latest.student_id AND sr.measured_at = latest.max_date
                JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
                JOIN paca.students ps ON s.paca_student_id = ps.id
                WHERE sr.academy_id = ? AND sr.record_type_id = ? AND ps.status = 'active' AND s.gender = 'M'
                ORDER BY sr.value ${orderDir}
                LIMIT 10
            `, [rt.id, academyId, academyId, academyId, rt.id]);

            const [femaleRank] = await db.query(`
                SELECT sr.student_id, ps.name as student_name, ps.gender, sr.value, sr.measured_at
                FROM student_records sr
                INNER JOIN (
                    SELECT student_id, MAX(measured_at) as max_date
                    FROM student_records WHERE record_type_id = ? AND academy_id = ?
                    GROUP BY student_id
                ) latest ON sr.student_id = latest.student_id AND sr.measured_at = latest.max_date
                JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
                JOIN paca.students ps ON s.paca_student_id = ps.id
                WHERE sr.academy_id = ? AND sr.record_type_id = ? AND ps.status = 'active' AND s.gender = 'F'
                ORDER BY sr.value ${orderDir}
                LIMIT 10
            `, [rt.id, academyId, academyId, academyId, rt.id]);

            const maleDecrypted = decryptStudentFields(maleRank);
            const femaleDecrypted = decryptStudentFields(femaleRank);

            rankings.push({
                recordTypeId: rt.id,
                recordTypeName: rt.name,
                unit: rt.unit,
                direction: rt.direction,
                male: maleDecrypted.map((r, i) => ({
                    rank: i + 1, studentId: r.student_id,
                    studentName: r.student_name || r.name, value: r.value, measuredAt: r.measured_at
                })),
                female: femaleDecrypted.map((r, i) => ({
                    rank: i + 1, studentId: r.student_id,
                    studentName: r.student_name || r.name, value: r.value, measuredAt: r.measured_at
                }))
            });
        }

        // 5. 트렌드 분석 (종목별 그룹)
        const [allRecords] = await db.query(`
            SELECT
                sr.student_id, sr.record_type_id, sr.value, sr.measured_at,
                ps.name as student_name, ps.gender as paca_gender, s.gender
            FROM student_records sr
            JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
            JOIN paca.students ps ON s.paca_student_id = ps.id
            WHERE sr.academy_id = ? AND ps.status = 'active' AND s.academy_id = ?
            ORDER BY sr.student_id, sr.record_type_id, sr.measured_at ASC
        `, [academyId, academyId, academyId]);

        const decryptedRecords = decryptStudentFields(allRecords);

        // 학생별 종목별 기록 그룹화
        const studentEventRecords = {};
        decryptedRecords.forEach(r => {
            const key = `${r.student_id}_${r.record_type_id}`;
            if (!studentEventRecords[key]) {
                studentEventRecords[key] = {
                    studentId: r.student_id,
                    studentName: r.student_name || r.name,
                    gender: r.gender,
                    recordTypeId: r.record_type_id,
                    values: []
                };
            }
            studentEventRecords[key].values.push(parseFloat(r.value));
        });

        // 종목별 트렌드 그룹
        const eventTrends = {};
        const insufficientData = [];

        recordTypes.forEach(rt => {
            eventTrends[rt.id] = {
                recordTypeId: rt.id,
                recordTypeName: rt.name,
                unit: rt.unit,
                direction: rt.direction,
                avgSlope: 0,
                avgTrend: 'maintaining',
                improving: [],
                maintaining: [],
                declining: [],
                analyzedCount: 0
            };
        });

        Object.values(studentEventRecords).forEach(entry => {
            const rt = recordTypes.find(r => r.id === entry.recordTypeId);
            if (!rt) return;

            const recent5 = entry.values.slice(-5);

            // 기록 5개 미만 → insufficientData
            if (recent5.length < 5) {
                insufficientData.push({
                    studentId: entry.studentId,
                    studentName: entry.studentName,
                    gender: entry.gender,
                    recordTypeName: rt.name,
                    recordCount: recent5.length
                });
                return;
            }

            const slope = calculateSlope(recent5);
            const trend = classifyTrend(slope, rt.direction);
            const latestValue = recent5[recent5.length - 1];

            const studentTrend = {
                studentId: entry.studentId,
                studentName: entry.studentName,
                gender: entry.gender,
                slope: parseFloat(slope.toFixed(2)),
                latestValue,
                recentValues: recent5
            };

            eventTrends[rt.id][trend].push(studentTrend);
            eventTrends[rt.id].analyzedCount++;
        });

        // 종목별 평균 기울기 & 종합 추세 계산
        Object.values(eventTrends).forEach(et => {
            const allSlopes = [
                ...et.improving.map(s => s.slope),
                ...et.maintaining.map(s => s.slope),
                ...et.declining.map(s => s.slope)
            ];
            if (allSlopes.length > 0) {
                et.avgSlope = parseFloat((allSlopes.reduce((a, b) => a + b, 0) / allSlopes.length).toFixed(2));
                const rt = recordTypes.find(r => r.id === et.recordTypeId);
                et.avgTrend = classifyTrend(et.avgSlope, rt?.direction || 'higher');
            }
            // 하락 학생을 기울기 절대값 내림차순 정렬 (심한 하락 우선)
            et.declining.sort((a, b) => Math.abs(b.slope) - Math.abs(a.slope));
        });

        // 전체 학생별 종합 추세 (요약용)
        const studentOverallMap = {};
        Object.values(eventTrends).forEach(et => {
            ['improving', 'maintaining', 'declining'].forEach(trend => {
                et[trend].forEach(s => {
                    if (!studentOverallMap[s.studentId]) {
                        studentOverallMap[s.studentId] = { improving: 0, maintaining: 0, declining: 0 };
                    }
                    studentOverallMap[s.studentId][trend]++;
                });
            });
        });

        let overallImproving = 0, overallMaintaining = 0, overallDeclining = 0;
        Object.values(studentOverallMap).forEach(counts => {
            const total = counts.improving + counts.maintaining + counts.declining;
            const score = (counts.improving - counts.declining) / total;
            if (score > 0.15) overallImproving++;
            else if (score < -0.15) overallDeclining++;
            else overallMaintaining++;
        });

        // 6. insufficientData 그룹화 (학생별)
        const insuffMap = {};
        insufficientData.forEach(d => {
            if (!insuffMap[d.studentId]) {
                insuffMap[d.studentId] = {
                    studentId: d.studentId,
                    studentName: d.studentName,
                    gender: d.gender,
                    events: []
                };
            }
            insuffMap[d.studentId].events.push({
                recordTypeName: d.recordTypeName,
                recordCount: d.recordCount
            });
        });

        res.json({
            summary: {
                totalRecords,
                totalStudents,
                academyName,
                reportDate: new Date().toISOString().split('T')[0],
                totalEvents: recordTypes.length,
                overallTrend: { improving: overallImproving, maintaining: overallMaintaining, declining: overallDeclining }
            },
            eventAverages,
            rankings,
            eventTrends: Object.values(eventTrends),
            insufficientData: Object.values(insuffMap)
        });

    } catch (error) {
        console.error('Analytics report error:', error);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: '리포트 생성 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
