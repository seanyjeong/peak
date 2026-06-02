/**
 * Student Records Routes (기록 측정 - 동적 종목)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { decryptStudentFields } = require('../utils/paca-student');
const { verifyToken } = require('../middleware/auth');
const { StudentRecordScopeError, assertStudentInAcademy, saveStudentRecord } = require('../utils/student-records');

// GET /peak/records - 기록 목록
router.get('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { student_id, record_type_id, from_date, to_date } = req.query;

        let query = `
            SELECT r.*, ps.name as student_name, ps.gender,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN students s ON r.student_id = s.id
            JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.academy_id = ?
        `;
        const params = [academyId, academyId];

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
        res.json({ success: true, records: decryptStudentFields(records) });
    } catch (error) {
        console.error('Get records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/records - 기록 측정 입력
router.post('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { student_id, record_type_id, measured_at, value, notes } = req.body;

        if (!student_id || !record_type_id || !measured_at || value === undefined) {
            return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
        }

        const result = await saveStudentRecord(db, {
            academyId,
            studentId: student_id,
            recordTypeId: record_type_id,
            measuredAt: measured_at,
            value,
            notes
        });

        res.status(201).json({
            success: true,
            recordId: result.id
        });
    } catch (error) {
        if (error instanceof StudentRecordScopeError) {
            console.warn('Student record scope blocked:', error.message);
            return res.status(error.statusCode).json({
                error: error.publicMessage,
                message: error.publicMessage
            });
        }
        console.error('Create record error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/records/batch - 여러 종목 한번에 입력 (UPSERT: 같은 날 최고 기록만 유지)
router.post('/batch', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { student_id, measured_at, records } = req.body;
        // records: [{ record_type_id, value, notes }, ...]

        if (!student_id || !measured_at || !records || records.length === 0) {
            return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const results = [];
            const warnings = [];
            for (const record of records) {
                if (record.value === null || record.value === undefined || record.value === '') {
                    continue;
                }

                const newValue = parseFloat(record.value);

                // 0값은 저장하지 않음 (입력칸 터치만으로 0 저장 방지)
                if (newValue === 0) {
                    continue;
                }

                // 종목의 direction, 범위 확인
                const [typeRows] = await connection.query(
                    'SELECT direction, min_value, max_value FROM record_types WHERE id = ?',
                    [record.record_type_id]
                );
                const direction = typeRows[0]?.direction || 'higher';
                const minValue = typeRows[0]?.min_value != null ? parseFloat(typeRows[0].min_value) : null;
                const maxValue = typeRows[0]?.max_value != null ? parseFloat(typeRows[0].max_value) : null;

                // 범위 체크 (저장은 허용, warning 플래그)
                if ((minValue !== null && newValue < minValue) || (maxValue !== null && newValue > maxValue)) {
                    warnings.push({
                        record_type_id: record.record_type_id,
                        value: newValue,
                        min_value: minValue,
                        max_value: maxValue
                    });
                }

                const result = await saveStudentRecord(connection, {
                    academyId,
                    studentId: student_id,
                    recordTypeId: record.record_type_id,
                    measuredAt: measured_at,
                    value: newValue,
                    notes: record.notes || null
                });
                results.push(result);
            }
            await connection.commit();
            res.status(201).json({
                success: true,
                count: results.filter(r => r.action !== 'skipped').length,
                results,
                warnings
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error instanceof StudentRecordScopeError) {
            console.warn('Student record scope blocked:', error.message);
            return res.status(error.statusCode).json({
                error: error.publicMessage,
                message: error.publicMessage
            });
        }
        console.error('Batch create records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/records/by-date - 특정 날짜의 학생별 기록 (기록측정 페이지에서 사용)
router.get('/by-date', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { date, student_ids } = req.query;
        if (!date) {
            return res.status(400).json({ error: '날짜가 필요합니다.' });
        }

        let query = `
            SELECT r.id, r.student_id, r.record_type_id, r.value, r.notes,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.academy_id = ? AND r.measured_at = ?
        `;
        const params = [academyId, date];

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
router.get('/latest', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        // 각 학생의 각 종목별 최신 기록 - 해당 학원만
        const [records] = await db.query(`
            SELECT r.*, ps.name as student_name, ps.gender,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN students s ON r.student_id = s.id
            JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
            JOIN record_types rt ON r.record_type_id = rt.id
            INNER JOIN (
                SELECT student_id, record_type_id, MAX(measured_at) as max_date
                FROM student_records
                WHERE academy_id = ?
                GROUP BY student_id, record_type_id
            ) latest ON r.student_id = latest.student_id
                    AND r.record_type_id = latest.record_type_id
                    AND r.measured_at = latest.max_date
            WHERE r.academy_id = ?
            ORDER BY ps.name, rt.display_order
        `, [academyId, academyId, academyId]);
        res.json({ success: true, records: decryptStudentFields(records) });
    } catch (error) {
        console.error('Get latest records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/records/stats/:student_id - 학생 기록 통계 (그래프용)
router.get('/stats/:student_id', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const studentId = req.params.student_id;

        // 학생이 해당 학원 소속인지 확인
        const [students] = await db.query(
            'SELECT id FROM students WHERE id = ? AND academy_id = ?',
            [studentId, academyId]
        );
        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // 종목별 기록 추이 - 해당 학원만
        const [records] = await db.query(`
            SELECT r.measured_at, r.value, r.record_type_id,
                   rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ? AND r.academy_id = ?
            ORDER BY rt.display_order, r.measured_at ASC
        `, [studentId, academyId]);

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

// DELETE /peak/records - 특정 학생의 특정 종목 기록 삭제 (해당 날짜)
router.delete('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { student_id, record_type_id, measured_at } = req.body;

        if (!student_id || !record_type_id || !measured_at) {
            return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
        }

        await assertStudentInAcademy(db, academyId, student_id);

        const [result] = await db.query(
            'DELETE FROM student_records WHERE academy_id = ? AND student_id = ? AND record_type_id = ? AND measured_at = ?',
            [academyId, student_id, record_type_id, measured_at]
        );

        res.json({ success: true, deleted: result.affectedRows });
    } catch (error) {
        if (error instanceof StudentRecordScopeError) {
            console.warn('Student record scope blocked:', error.message);
            return res.status(error.statusCode).json({
                error: error.publicMessage,
                message: error.publicMessage
            });
        }
        console.error('Delete record error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
