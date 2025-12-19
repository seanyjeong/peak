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

// POST /peak/records/batch - 여러 종목 한번에 입력
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
            const insertedIds = [];
            for (const record of records) {
                if (record.value !== null && record.value !== undefined && record.value !== '') {
                    const [result] = await connection.query(
                        'INSERT INTO student_records (student_id, record_type_id, measured_at, value, notes) VALUES (?, ?, ?, ?, ?)',
                        [student_id, record.record_type_id, measured_at, record.value, record.notes || null]
                    );
                    insertedIds.push(result.insertId);
                }
            }
            await connection.commit();
            res.status(201).json({
                success: true,
                count: insertedIds.length,
                recordIds: insertedIds
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
