/**
 * Student Records Routes (기록 측정 - 동적 종목)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/records - 기록 목록
router.get('/', async (req, res) => {
    try {
        const { student_id, record_type_id, from_date, to_date } = req.query;

        let query = `
            SELECT r.*, s.name as student_name, s.gender,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN students s ON r.student_id = s.id
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE 1=1
        `;
        const params = [];

        if (student_id) {
            query += ' AND r.student_id = ?';
            params.push(student_id);
        }
        if (record_type_id) {
            query += ' AND r.record_type_id = ?';
            params.push(record_type_id);
        }
        if (from_date) {
            query += ' AND r.measured_at >= ?';
            params.push(from_date);
        }
        if (to_date) {
            query += ' AND r.measured_at <= ?';
            params.push(to_date);
        }

        query += ' ORDER BY r.measured_at DESC, rt.display_order';

        const [records] = await db.query(query, params);
        res.json({ success: true, records });
    } catch (error) {
        console.error('Get records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/records - 기록 측정 입력
router.post('/', async (req, res) => {
    try {
        const { student_id, record_type_id, measured_at, value, notes } = req.body;

        if (!student_id || !record_type_id || !measured_at || value === undefined) {
            return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
        }

        const [result] = await db.query(`
            INSERT INTO student_records
            (student_id, record_type_id, measured_at, value, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [student_id, record_type_id, measured_at, value, notes]);

        res.status(201).json({
            success: true,
            recordId: result.insertId
        });
    } catch (error) {
        console.error('Create record error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/records/batch - 여러 종목 한번에 입력 (UPSERT: 같은 날 최고 기록만 유지)
router.post('/batch', async (req, res) => {
    try {
        const { student_id, measured_at, records } = req.body;
        // records: [{ record_type_id, value, notes }, ...]

        if (!student_id || !measured_at || !records || records.length === 0) {
            return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const results = [];
            for (const record of records) {
                if (record.value === null || record.value === undefined || record.value === '') {
                    continue;
                }

                const newValue = parseFloat(record.value);

                // 종목의 direction 확인 (higher/lower)
                const [typeRows] = await connection.query(
                    'SELECT direction FROM record_types WHERE id = ?',
                    [record.record_type_id]
                );
                const direction = typeRows[0]?.direction || 'higher';

                // 해당 날짜에 기존 기록이 있는지 확인
                const [existing] = await connection.query(
                    'SELECT id, value FROM student_records WHERE student_id = ? AND record_type_id = ? AND measured_at = ?',
                    [student_id, record.record_type_id, measured_at]
                );

                if (existing.length > 0) {
                    const oldValue = parseFloat(existing[0].value);
                    // direction에 따라 더 좋은 기록인지 비교
                    const isBetter = direction === 'higher'
                        ? newValue > oldValue
                        : newValue < oldValue;

                    if (isBetter) {
                        // 더 좋은 기록이면 업데이트
                        await connection.query(
                            'UPDATE student_records SET value = ?, notes = ?, created_at = NOW() WHERE id = ?',
                            [newValue, record.notes || null, existing[0].id]
                        );
                        results.push({ id: existing[0].id, action: 'updated', oldValue, newValue });
                    } else {
                        // 기존 기록이 더 좋으면 스킵
                        results.push({ id: existing[0].id, action: 'skipped', oldValue, newValue });
                    }
                } else {
                    // 새 기록 삽입
                    const [result] = await connection.query(
                        'INSERT INTO student_records (student_id, record_type_id, measured_at, value, notes) VALUES (?, ?, ?, ?, ?)',
                        [student_id, record.record_type_id, measured_at, newValue, record.notes || null]
                    );
                    results.push({ id: result.insertId, action: 'inserted', newValue });
                }
            }
            await connection.commit();
            res.status(201).json({
                success: true,
                count: results.filter(r => r.action !== 'skipped').length,
                results
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Batch create records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/records/by-date - 특정 날짜의 학생별 기록 (기록측정 페이지에서 사용)
router.get('/by-date', async (req, res) => {
    try {
        const { date, student_ids } = req.query;
        if (!date) {
            return res.status(400).json({ error: '날짜가 필요합니다.' });
        }

        let query = `
            SELECT r.id, r.student_id, r.record_type_id, r.value, r.notes,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.measured_at = ?
        `;
        const params = [date];

        // student_ids가 있으면 해당 학생들만
        if (student_ids) {
            const ids = student_ids.split(',').map(Number);
            query += ` AND r.student_id IN (${ids.map(() => '?').join(',')})`;
            params.push(...ids);
        }

        query += ' ORDER BY r.student_id, rt.display_order';

        const [records] = await db.query(query, params);
        res.json({ success: true, date, records });
    } catch (error) {
        console.error('Get records by date error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/records/latest - 학생별 최신 기록
router.get('/latest', async (req, res) => {
    try {
        // 각 학생의 각 종목별 최신 기록
        const [records] = await db.query(`
            SELECT r.*, s.name as student_name, s.gender,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN students s ON r.student_id = s.id
            JOIN record_types rt ON r.record_type_id = rt.id
            INNER JOIN (
                SELECT student_id, record_type_id, MAX(measured_at) as max_date
                FROM student_records
                GROUP BY student_id, record_type_id
            ) latest ON r.student_id = latest.student_id
                    AND r.record_type_id = latest.record_type_id
                    AND r.measured_at = latest.max_date
            ORDER BY s.name, rt.display_order
        `);
        res.json({ success: true, records });
    } catch (error) {
        console.error('Get latest records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/records/stats/:student_id - 학생 기록 통계 (그래프용)
router.get('/stats/:student_id', async (req, res) => {
    try {
        // 종목별 기록 추이
        const [records] = await db.query(`
            SELECT r.measured_at, r.value, r.record_type_id,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ?
            ORDER BY rt.display_order, r.measured_at ASC
        `, [req.params.student_id]);

        // 종목별로 그룹화
        const grouped = {};
        records.forEach(r => {
            if (!grouped[r.record_type_id]) {
                grouped[r.record_type_id] = {
                    record_type_id: r.record_type_id,
                    name: r.record_type_name,
                    unit: r.unit,
                    direction: r.direction,
                    records: []
                };
            }
            grouped[r.record_type_id].records.push({
                measured_at: r.measured_at,
                value: r.value
            });
        });

        // 변화량 계산
        const stats = Object.values(grouped).map(type => {
            const recs = type.records;
            let improvement = null;
            if (recs.length >= 2) {
                const first = parseFloat(recs[0].value);
                const last = parseFloat(recs[recs.length - 1].value);
                const diff = last - first;
                // direction이 lower면 줄어드는게 좋음
                improvement = type.direction === 'lower' ? -diff : diff;
            }
            return {
                ...type,
                improvement,
                latest: recs.length > 0 ? recs[recs.length - 1].value : null
            };
        });

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
