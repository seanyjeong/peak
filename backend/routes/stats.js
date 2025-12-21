/**
 * Stats Routes (통계 API)
 * 학원 전체 평균 등 통계 데이터
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /peak/stats/academy-average
 * 학원 전체 학생 평균 (프로필 비교용)
 */
router.get('/academy-average', async (req, res) => {
    try {
        // 1. 활성 종목 목록
        const [recordTypes] = await db.query(
            'SELECT * FROM record_types WHERE is_active = 1 ORDER BY display_order'
        );

        // 2. 모든 학생의 최신 기록만 조회 (종목별 최신 1개씩)
        const [latestRecords] = await db.query(`
            SELECT r1.*
            FROM student_records r1
            INNER JOIN (
                SELECT student_id, record_type_id, MAX(measured_at) as max_date
                FROM student_records
                GROUP BY student_id, record_type_id
            ) r2 ON r1.student_id = r2.student_id
                AND r1.record_type_id = r2.record_type_id
                AND r1.measured_at = r2.max_date
        `);

        // 3. 종목별 평균 계산
        const averages = {};
        const counts = {};

        recordTypes.forEach(rt => {
            const typeRecords = latestRecords.filter(r => r.record_type_id === rt.id);
            if (typeRecords.length > 0) {
                const values = typeRecords.map(r => parseFloat(r.value));
                averages[rt.id] = values.reduce((a, b) => a + b, 0) / values.length;
                counts[rt.id] = values.length;
            }
        });

        // 4. 전체 학생 수
        const [studentCount] = await db.query(
            "SELECT COUNT(*) as count FROM students WHERE status = 'active'"
        );

        res.json({
            success: true,
            averages,
            counts, // 종목별 기록 보유 학생 수
            totalStudents: studentCount[0].count,
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
router.get('/leaderboard/:recordTypeId', async (req, res) => {
    try {
        const { recordTypeId } = req.params;
        const { limit = 10, gender } = req.query;

        // 종목 정보
        const [types] = await db.query(
            'SELECT * FROM record_types WHERE id = ?',
            [recordTypeId]
        );
        if (types.length === 0) {
            return res.status(404).json({ error: 'Record type not found' });
        }
        const recordType = types[0];

        // 최신 기록 기준 순위
        let query = `
            SELECT r.*, s.name as student_name, s.gender, s.school, s.grade
            FROM student_records r
            INNER JOIN (
                SELECT student_id, MAX(measured_at) as max_date
                FROM student_records
                WHERE record_type_id = ?
                GROUP BY student_id
            ) latest ON r.student_id = latest.student_id AND r.measured_at = latest.max_date
            JOIN students s ON r.student_id = s.id
            WHERE r.record_type_id = ? AND s.status = 'active'
        `;
        const params = [recordTypeId, recordTypeId];

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
