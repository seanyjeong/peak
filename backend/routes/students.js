/**
 * Students Routes
 * v4.3.1 - Bulk Upsert로 N+1 Query 문제 해결
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
    password: process.env.PACA_DB_PASSWORD,
    database: 'paca',
    waitForConnections: true,
    connectionLimit: 5
});

/**
 * POST /peak/students/sync
 * P-ACA에서 학생 데이터 동기화 (Bulk Upsert 방식)
 */
router.post('/sync', verifyToken, async (req, res) => {
    const connection = await db.getConnection();

    try {
        const academyId = req.user.academyId;

        if (!academyId) {
            connection.release();
            return res.status(400).json({ error: '학원 ID가 필요합니다.' });
        }

        // P-ACA에서 해당 학원의 학생 목록 가져오기
        const [pacaStudents] = await pacaPool.query(`
            SELECT id, name, gender, phone, school, grade, enrollment_date, status,
                   class_days, trial_remaining, trial_dates
            FROM students
            WHERE academy_id = ? AND status IN ('active', 'paused', 'trial', 'pending')
            ORDER BY name
        `, [academyId]);

        // 0명이면 방어적 처리 (P-ACA 연결 문제일 수 있음)
        if (pacaStudents.length === 0) {
            connection.release();
            return res.json({
                success: true,
                message: '동기화할 학생이 없습니다. P-ACA 데이터를 확인하세요.',
                synced: 0,
                updated: 0,
                deactivated: 0,
                total: 0,
                warning: 'P-ACA에서 0명 반환됨'
            });
        }

        // 메모리에서 데이터 전처리
        const processedStudents = pacaStudents.map(student => {
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

            // status 변환
            let status = 'active';
            if (student.status === 'paused') status = 'paused';
            else if (student.status === 'pending') status = 'pending';
            else if (['graduated', 'withdrawn'].includes(student.status)) status = 'inactive';

            // 체험생 처리
            const isTrial = student.status === 'trial' ? 1 : 0;

            // 체험 총 횟수
            let trialTotal = 2;
            if (isTrial && student.trial_dates) {
                try {
                    const trialDates = typeof student.trial_dates === 'string'
                        ? JSON.parse(student.trial_dates || '[]')
                        : (student.trial_dates || []);
                    trialTotal = trialDates.length || 2;
                } catch (e) {
                    trialTotal = 2;
                }
            }
            const trialRemaining = student.trial_remaining ?? trialTotal;

            // class_days JSON 처리
            const classDays = student.class_days ? JSON.stringify(student.class_days) : null;

            return {
                pacaId: student.id,
                academyId,
                name: decryptedName,
                gender,
                phone: decryptedPhone,
                school: student.school,
                grade: student.grade,
                classDays,
                isTrial,
                trialTotal,
                trialRemaining,
                joinDate: student.enrollment_date,
                status
            };
        });

        await connection.beginTransaction();

        try {
            // Bulk Upsert: INSERT ... ON DUPLICATE KEY UPDATE
            // paca_student_id에 UNIQUE KEY가 있어야 함
            const upsertQuery = `
                INSERT INTO students
                    (academy_id, paca_student_id, name, gender, phone, school, grade,
                     class_days, is_trial, trial_total, trial_remaining, join_date, status)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    gender = VALUES(gender),
                    phone = VALUES(phone),
                    school = VALUES(school),
                    grade = VALUES(grade),
                    class_days = VALUES(class_days),
                    is_trial = VALUES(is_trial),
                    trial_total = VALUES(trial_total),
                    trial_remaining = VALUES(trial_remaining),
                    status = VALUES(status),
                    academy_id = VALUES(academy_id),
                    updated_at = NOW()
            `;

            const values = processedStudents.map(s => [
                s.academyId, s.pacaId, s.name, s.gender, s.phone, s.school, s.grade,
                s.classDays, s.isTrial, s.trialTotal, s.trialRemaining, s.joinDate, s.status
            ]);

            const [upsertResult] = await connection.query(upsertQuery, [values]);

            // affectedRows: INSERT는 1, UPDATE는 2로 카운트됨
            const synced = upsertResult.affectedRows - upsertResult.changedRows;
            const updated = upsertResult.changedRows;

            // P-ACA에 없는 학생 삭제 (graduated, withdrawn, orphan 등)
            const pacaStudentIds = processedStudents.map(s => s.pacaId);

            // 먼저 관련 기록 삭제
            await connection.query(`
                DELETE sr FROM student_records sr
                JOIN students s ON sr.student_id = s.id
                WHERE s.academy_id = ?
                AND s.paca_student_id IS NOT NULL
                AND s.paca_student_id NOT IN (?)
            `, [academyId, pacaStudentIds]);

            // 학생 삭제
            const [deleteResult] = await connection.query(`
                DELETE FROM students
                WHERE academy_id = ?
                AND paca_student_id IS NOT NULL
                AND paca_student_id NOT IN (?)
            `, [academyId, pacaStudentIds]);
            const deleted = deleteResult.affectedRows || 0;

            await connection.commit();

            res.json({
                success: true,
                message: `동기화 완료: ${synced}명 추가, ${updated}명 업데이트, ${deleted}명 삭제`,
                synced,
                updated,
                deleted,
                total: pacaStudents.length
            });

        } catch (err) {
            await connection.rollback();
            throw err;
        }

    } catch (error) {
        console.error('Sync students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        connection.release();
    }
});

/**
 * GET /peak/students/today
 * 오늘 수업인 학생 목록 (스케줄 기반)
 */
router.get('/today', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const today = new Date();
        const dayOfWeek = today.getDay();

        const [students] = await db.query(`
            SELECT *
            FROM students
            WHERE academy_id = ?
              AND status = 'active'
              AND class_days IS NOT NULL
              AND JSON_CONTAINS(class_days, ?)
            ORDER BY name
        `, [academyId, dayOfWeek.toString()]);

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
router.get('/schedule', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const dayOfWeek = targetDate.getDay();

        const [students] = await db.query(`
            SELECT *
            FROM students
            WHERE academy_id = ?
              AND status = 'active'
              AND (
                (class_days IS NOT NULL AND JSON_CONTAINS(class_days, ?))
                OR is_trial = 1
              )
            ORDER BY is_trial DESC, name
        `, [academyId, dayOfWeek.toString()]);

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
router.get('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { status } = req.query;
        let query = 'SELECT * FROM students WHERE academy_id = ?';
        const params = [academyId];

        if (status) {
            query += ' AND status = ?';
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
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
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
router.get('/:id/records', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const studentId = req.params.id;

        const [students] = await db.query(
            'SELECT id FROM students WHERE id = ? AND academy_id = ?',
            [studentId, academyId]
        );
        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const [records] = await db.query(`
            SELECT r.*, rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ? AND r.academy_id = ?
            ORDER BY r.measured_at DESC, rt.display_order
        `, [studentId, academyId]);

        // 날짜별로 그룹화
        const grouped = {};
        records.forEach(r => {
            let dateKey;
            if (r.measured_at instanceof Date) {
                dateKey = r.measured_at.toISOString().split('T')[0];
            } else if (typeof r.measured_at === 'string') {
                dateKey = r.measured_at.split('T')[0];
            } else {
                dateKey = String(r.measured_at);
            }
            if (!grouped[dateKey]) {
                grouped[dateKey] = { measured_at: dateKey, records: [] };
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
 */
router.get('/:id/stats', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const studentId = req.params.id;

        // 1. 학생 정보 조회
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ? AND academy_id = ?',
            [studentId, academyId]
        );
        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const student = students[0];

        // 2. 활성 종목 목록
        const [recordTypes] = await db.query(
            'SELECT * FROM record_types WHERE academy_id = ? AND is_active = 1 ORDER BY display_order',
            [academyId]
        );

        // 3. 학생의 모든 기록 조회
        const [allRecords] = await db.query(`
            SELECT r.*, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ? AND r.academy_id = ?
            ORDER BY r.measured_at DESC
        `, [studentId, academyId]);

        // 4. 종목별 배점표 조회
        const [scoreTables] = await db.query(`
            SELECT st.*, sr.score, sr.male_min, sr.male_max, sr.female_min, sr.female_max
            FROM score_tables st
            JOIN score_ranges sr ON sr.score_table_id = st.id
            WHERE st.academy_id = ?
            ORDER BY st.record_type_id, sr.score DESC
        `, [academyId]);

        // 배점표를 종목별로 그룹화
        const scoreTablesByType = {};
        scoreTables.forEach(row => {
            if (!scoreTablesByType[row.record_type_id]) {
                scoreTablesByType[row.record_type_id] = { maxScore: row.max_score, ranges: [] };
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

            const values = typeRecords.map(r => parseFloat(r.value));
            averages[rt.id] = values.reduce((a, b) => a + b, 0) / values.length;

            const isLowerBetter = rt.direction === 'lower';
            const bestValue = isLowerBetter ? Math.min(...values) : Math.max(...values);
            const bestRecord = typeRecords.find(r => parseFloat(r.value) === bestValue);
            bests[rt.id] = { value: bestValue, date: bestRecord?.measured_at };

            latests[rt.id] = { value: parseFloat(typeRecords[0].value), date: typeRecords[0].measured_at };

            // 점수 계산
            const scoreTable = scoreTablesByType[rt.id];
            if (scoreTable) {
                const latestValue = parseFloat(typeRecords[0].value);
                const ranges = scoreTable.ranges;
                let foundScore = null;

                for (const range of ranges) {
                    const min = student.gender === 'M' ? range.male_min : range.female_min;
                    const max = student.gender === 'M' ? range.male_max : range.female_max;
                    if (latestValue >= min && latestValue <= max) {
                        foundScore = range.score;
                        break;
                    }
                }

                if (foundScore === null) {
                    if (isLowerBetter) {
                        for (const range of ranges) {
                            const max = student.gender === 'M' ? range.male_max : range.female_max;
                            if (latestValue <= max) { foundScore = range.score; break; }
                        }
                        if (foundScore === null) foundScore = ranges[ranges.length - 1]?.score || 50;
                    } else {
                        for (const range of ranges) {
                            const min = student.gender === 'M' ? range.male_min : range.female_min;
                            if (latestValue >= min) { foundScore = range.score; break; }
                        }
                        if (foundScore === null) foundScore = ranges[ranges.length - 1]?.score || 50;
                    }
                }

                scores[rt.id] = foundScore;
            }

            // 추세 계산
            if (typeRecords.length >= 5) {
                const vals = typeRecords.slice(0, 5).map(r => parseFloat(r.value));
                let improvements = 0, declines = 0;

                for (let i = 0; i < 4; i++) {
                    const newer = vals[i], older = vals[i + 1];
                    if (isLowerBetter) {
                        if (newer < older) improvements++; else if (newer > older) declines++;
                    } else {
                        if (newer > older) improvements++; else if (newer < older) declines++;
                    }
                }

                const newest = vals[0], oldest = vals[4];
                if (isLowerBetter) {
                    if (newest < oldest) improvements += 2; else if (newest > oldest) declines += 2;
                } else {
                    if (newest > oldest) improvements += 2; else if (newest < oldest) declines += 2;
                }

                if (improvements > declines) trends[rt.id] = 'up';
                else if (declines > improvements) trends[rt.id] = 'down';
                else trends[rt.id] = 'stable';
            } else {
                trends[rt.id] = 'need_more';
            }
        });

        // 6. 총점 및 등급
        const scoreValues = Object.values(scores);
        const totalScore = scoreValues.reduce((a, b) => a + b, 0);
        const maxPossibleScore = scoreValues.length * 100;
        const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

        let grade = 'F';
        if (percentage >= 90) grade = 'A';
        else if (percentage >= 80) grade = 'B';
        else if (percentage >= 70) grade = 'C';
        else if (percentage >= 60) grade = 'D';

        const trendValues = Object.values(trends);
        const upCount = trendValues.filter(t => t === 'up').length;
        const downCount = trendValues.filter(t => t === 'down').length;
        const overallTrend = upCount > downCount ? 'up' : downCount > upCount ? 'down' : 'stable';

        res.json({
            success: true,
            student,
            stats: {
                averages, bests, latests, scores, trends,
                totalScore, maxPossibleScore,
                percentage: Math.round(percentage * 10) / 10,
                grade, overallTrend,
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
