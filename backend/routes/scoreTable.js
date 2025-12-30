/**
 * Score Table Routes (배점표 관리)
 * 자동 생성 + 개별 수정 지원
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET /peak/score-tables - 배점표 목록
router.get('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        const [tables] = await db.query(`
            SELECT st.*, rt.name as record_type_name, rt.unit, rt.direction
            FROM score_tables st
            JOIN record_types rt ON st.record_type_id = rt.id
            WHERE st.academy_id = ?
            ORDER BY rt.display_order
        `, [academyId]);
        res.json({ success: true, scoreTables: tables });
    } catch (error) {
        console.error('Get score tables error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/score-tables/:id - 배점표 상세 (구간 포함)
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        const [tables] = await db.query(`
            SELECT st.*, rt.name as record_type_name, rt.unit, rt.direction
            FROM score_tables st
            JOIN record_types rt ON st.record_type_id = rt.id
            WHERE st.id = ? AND st.academy_id = ?
        `, [req.params.id, academyId]);

        if (tables.length === 0) {
            return res.status(404).json({ error: 'Not Found' });
        }

        const [ranges] = await db.query(
            'SELECT * FROM score_ranges WHERE score_table_id = ? ORDER BY score DESC',
            [req.params.id]
        );

        res.json({
            success: true,
            scoreTable: tables[0],
            ranges
        });
    } catch (error) {
        console.error('Get score table error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/score-tables/by-type/:recordTypeId - 종목별 배점표
router.get('/by-type/:recordTypeId', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        const [tables] = await db.query(`
            SELECT st.*, rt.name as record_type_name, rt.unit, rt.direction
            FROM score_tables st
            JOIN record_types rt ON st.record_type_id = rt.id
            WHERE st.record_type_id = ? AND st.academy_id = ?
        `, [req.params.recordTypeId, academyId]);

        if (tables.length === 0) {
            return res.json({ success: true, scoreTable: null, ranges: [] });
        }

        const [ranges] = await db.query(
            'SELECT * FROM score_ranges WHERE score_table_id = ? ORDER BY score DESC',
            [tables[0].id]
        );

        res.json({
            success: true,
            scoreTable: tables[0],
            ranges
        });
    } catch (error) {
        console.error('Get score table by type error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/score-tables - 배점표 생성 (자동 구간 생성)
router.post('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const {
            record_type_id,
            name,
            max_score,        // 만점 점수 (100)
            min_score,        // 최소 점수 (50)
            score_step,       // 급간 점수 (2점씩)
            value_step,       // 1감점당 기록 단위 (5cm, 0.1초)
            decimal_places = 0, // 소수점 자리수 (0, 1, 2)
            male_perfect,     // 남자 만점 기록
            female_perfect    // 여자 만점 기록
        } = req.body;

        // 종목 정보 가져오기 (해당 학원 소유인지 확인)
        const [recordTypes] = await db.query(
            'SELECT * FROM record_types WHERE id = ? AND academy_id = ?',
            [record_type_id, academyId]
        );

        if (recordTypes.length === 0) {
            return res.status(400).json({ error: '종목을 찾을 수 없습니다.' });
        }

        const recordType = recordTypes[0];
        const isHigherBetter = recordType.direction === 'higher';

        // 급간 점수 검증
        if (!score_step || score_step <= 0) {
            return res.status(400).json({ error: '급간 점수는 1 이상이어야 합니다.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 기존 배점표 삭제 (있으면)
            const [existing] = await connection.query(
                'SELECT id FROM score_tables WHERE record_type_id = ? AND academy_id = ?',
                [record_type_id, academyId]
            );

            if (existing.length > 0) {
                await connection.query(
                    'DELETE FROM score_ranges WHERE score_table_id = ?',
                    [existing[0].id]
                );
                await connection.query(
                    'DELETE FROM score_tables WHERE id = ?',
                    [existing[0].id]
                );
            }

            // 배점표 생성
            const [result] = await connection.query(`
                INSERT INTO score_tables
                (academy_id, record_type_id, name, max_score, min_score, score_step, value_step, decimal_places, male_perfect, female_perfect)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [academyId, record_type_id, name, max_score, min_score, score_step, value_step, decimal_places, male_perfect, female_perfect]);

            const scoreTableId = result.insertId;

            // 배점 구간 자동 생성
            const ranges = [];
            let currentScore = max_score;
            let maleValue = parseFloat(male_perfect);
            let femaleValue = parseFloat(female_perfect);
            const step = parseFloat(value_step);

            // 소수점 자리수에 따른 최소 단위
            const precision = Math.pow(10, -decimal_places); // 0자리:1, 1자리:0.1, 2자리:0.01
            const round = (val) => Math.round(val * Math.pow(10, decimal_places)) / Math.pow(10, decimal_places);

            while (currentScore >= min_score) {
                let maleMin, maleMax, femaleMin, femaleMax;

                if (isHigherBetter) {
                    // 높을수록 좋음 (제멀, 메디신볼)
                    if (currentScore === max_score) {
                        // 만점: 만점기록 이상
                        maleMin = round(maleValue);
                        maleMax = 9999.99;
                        femaleMin = round(femaleValue);
                        femaleMax = 9999.99;
                    } else if (currentScore === min_score) {
                        // 최하점: 해당값 이하
                        maleMin = 0;
                        maleMax = round(maleValue + step - precision);
                        femaleMin = 0;
                        femaleMax = round(femaleValue + step - precision);
                    } else {
                        // 중간: 범위
                        maleMin = round(maleValue);
                        maleMax = round(maleValue + step - precision);
                        femaleMin = round(femaleValue);
                        femaleMax = round(femaleValue + step - precision);
                    }
                } else {
                    // 낮을수록 좋음 (왕복달리기)
                    if (currentScore === max_score) {
                        // 만점: 만점기록 이하
                        maleMin = 0;
                        maleMax = round(maleValue);
                        femaleMin = 0;
                        femaleMax = round(femaleValue);
                    } else if (currentScore === min_score) {
                        // 최하점: 해당값 이상
                        maleMin = round(maleValue - step + precision);
                        maleMax = 9999.99;
                        femaleMin = round(femaleValue - step + precision);
                        femaleMax = 9999.99;
                    } else {
                        // 중간: 범위
                        maleMin = round(maleValue - step + precision);
                        maleMax = round(maleValue);
                        femaleMin = round(femaleValue - step + precision);
                        femaleMax = round(femaleValue);
                    }
                }

                ranges.push({
                    score: currentScore,
                    male_min: maleMin,
                    male_max: maleMax,
                    female_min: femaleMin,
                    female_max: femaleMax
                });

                // 다음 구간
                currentScore -= score_step;
                if (isHigherBetter) {
                    maleValue -= step;
                    femaleValue -= step;
                } else {
                    maleValue += step;
                    femaleValue += step;
                }
            }

            // 구간 저장
            for (const range of ranges) {
                await connection.query(`
                    INSERT INTO score_ranges
                    (score_table_id, score, male_min, male_max, female_min, female_max)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [scoreTableId, range.score, range.male_min, range.male_max, range.female_min, range.female_max]);
            }

            await connection.commit();

            res.status(201).json({
                success: true,
                scoreTableId,
                rangesCount: ranges.length,
                message: '배점표가 생성되었습니다.'
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Create score table error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/score-tables/ranges/:id - 개별 구간 수정
router.put('/ranges/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { male_min, male_max, female_min, female_max } = req.body;

        // 해당 구간이 이 학원 소유인지 확인
        const [rangeCheck] = await db.query(`
            SELECT sr.id FROM score_ranges sr
            JOIN score_tables st ON sr.score_table_id = st.id
            WHERE sr.id = ? AND st.academy_id = ?
        `, [req.params.id, academyId]);

        if (rangeCheck.length === 0) {
            return res.status(404).json({ error: '구간을 찾을 수 없습니다.' });
        }

        await db.query(`
            UPDATE score_ranges
            SET male_min = ?, male_max = ?, female_min = ?, female_max = ?
            WHERE id = ?
        `, [male_min, male_max, female_min, female_max, req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update score range error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/score-tables/:id - 배점표 삭제
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;

        // 해당 배점표가 이 학원 소유인지 확인
        const [tableCheck] = await db.query(
            'SELECT id FROM score_tables WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );

        if (tableCheck.length === 0) {
            return res.status(404).json({ error: '배점표를 찾을 수 없습니다.' });
        }

        await db.query('DELETE FROM score_ranges WHERE score_table_id = ?', [req.params.id]);
        await db.query('DELETE FROM score_tables WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: '배점표가 삭제되었습니다.' });
    } catch (error) {
        console.error('Delete score table error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/score-tables/calculate - 기록으로 점수 계산
router.post('/calculate', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { record_type_id, value, gender } = req.body;

        const [tables] = await db.query(
            'SELECT id FROM score_tables WHERE record_type_id = ? AND academy_id = ? AND is_active = 1',
            [record_type_id, academyId]
        );

        if (tables.length === 0) {
            return res.json({ success: true, score: null, message: '배점표 없음' });
        }

        const column = gender === 'M' ? 'male' : 'female';

        const [ranges] = await db.query(`
            SELECT score FROM score_ranges
            WHERE score_table_id = ?
              AND ${column}_min <= ?
              AND ${column}_max >= ?
            ORDER BY score DESC
            LIMIT 1
        `, [tables[0].id, value, value]);

        if (ranges.length === 0) {
            return res.json({ success: true, score: null, message: '해당 범위 없음' });
        }

        res.json({ success: true, score: ranges[0].score });
    } catch (error) {
        console.error('Calculate score error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
